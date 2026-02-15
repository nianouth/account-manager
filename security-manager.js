/**
 * 安全管理器 - 主密码管理与会话控制
 * 符合 Chrome Extension Manifest V3 规范
 *
 * 核心安全设计：
 * 1. 主密码不以明文存储，使用派生密钥验证
 * 2. 通过加密测试数据来验证主密码正确性
 * 3. 会话管理：派生密钥临时存储在 Service Worker 内存中
 * 4. 支持从旧版本（明文主密码）安全迁移
 */

export class SecurityManager {
  constructor() {
    // 验证数据常量（用于测试主密码是否正确）
    this.VERIFICATION_TEXT = 'account-manager-security-v2';

    // PBKDF2 参数
    this.PBKDF2_ITERATIONS = 120000; // 提高到 120000 次迭代（从 100000）
    this.SALT_LENGTH = 16; // 128 bits

    // 会话超时时间（毫秒）
    this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 分钟

    // 主密码强度要求
    this.PASSWORD_MIN_LENGTH = 8;
    this.PASSWORD_REQUIRE_UPPER = true;
    this.PASSWORD_REQUIRE_LOWER = true;
    this.PASSWORD_REQUIRE_NUMBER = true;
  }

  /**
   * 验证主密码强度
   * @param {string} password - 待验证的密码
   * @returns {{valid: boolean, message: string}} 验证结果
   */
  validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, message: '密码不能为空' };
    }

    if (password.length < this.PASSWORD_MIN_LENGTH) {
      return {
        valid: false,
        message: `主密码至少需要 ${this.PASSWORD_MIN_LENGTH} 位`
      };
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (this.PASSWORD_REQUIRE_UPPER && !hasUpper) {
      return { valid: false, message: '主密码需包含至少一个大写字母' };
    }

    if (this.PASSWORD_REQUIRE_LOWER && !hasLower) {
      return { valid: false, message: '主密码需包含至少一个小写字母' };
    }

    if (this.PASSWORD_REQUIRE_NUMBER && !hasNumber) {
      return { valid: false, message: '主密码需包含至少一个数字' };
    }

    return { valid: true, message: '密码强度符合要求' };
  }

  /**
   * 生成随机盐值
   * @returns {Uint8Array} 随机盐值
   */
  generateSalt() {
    return crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
  }

  /**
   * ArrayBuffer 转 Base64
   * @param {ArrayBuffer} buffer - 要转换的 buffer
   * @returns {string} Base64 字符串
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Base64 转 ArrayBuffer
   * @param {string} base64 - Base64 字符串
   * @returns {Uint8Array} 字节数组
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * 使用 PBKDF2 派生密钥
   * @param {string} password - 主密码
   * @param {Uint8Array} salt - 盐值
   * @returns {Promise<CryptoKey>} 派生的密钥
   */
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();

    // 导入密码
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // 派生密钥
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true, // 可导出（用于会话管理）
      ['encrypt', 'decrypt']
    );

    return key;
  }

  /**
   * 使用密钥加密数据
   * @param {string} plaintext - 明文
   * @param {CryptoKey} key - 加密密钥
   * @returns {Promise<string>} Base64 编码的加密数据
   */
  async encrypt(plaintext, key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // 生成随机 IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 加密
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    // 组合 IV + 加密数据
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);

    return this.arrayBufferToBase64(result.buffer);
  }

  /**
   * 使用密钥解密数据
   * @param {string} ciphertext - Base64 编码的加密数据
   * @param {CryptoKey} key - 解密密钥
   * @returns {Promise<string>} 解密后的明文
   */
  async decrypt(ciphertext, key) {
    const data = this.base64ToArrayBuffer(ciphertext);

    // 提取 IV 和加密数据
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);

    // 解密
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * 初始化主密码（首次使用）
   * @param {string} masterPassword - 用户设置的主密码
   * @returns {Promise<{success: boolean, message: string}>} 初始化结果
   */
  async initializeMasterPassword(masterPassword) {
    try {
      // 1. 验证密码强度
      const validation = this.validatePasswordStrength(masterPassword);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      // 2. 生成随机盐值
      const salt = this.generateSalt();

      // 3. 派生密钥
      const key = await this.deriveKey(masterPassword, salt);

      // 4. 加密验证数据
      const verificationData = await this.encrypt(this.VERIFICATION_TEXT, key);

      // 5. 存储配置（不存储主密码本身）
      const securityConfig = {
        version: '2.0',
        salt: this.arrayBufferToBase64(salt.buffer),
        iterations: this.PBKDF2_ITERATIONS,
        verificationData: verificationData,
        createdAt: Date.now()
      };

      await chrome.storage.local.set({ securityConfig });

      // 6. 通知 background.js 设置会话密钥
      const exportedKey = await crypto.subtle.exportKey('raw', key);
      await chrome.runtime.sendMessage({
        action: 'setSessionKey',
        keyData: this.arrayBufferToBase64(exportedKey),
        mode: 'default'
      });

      return { success: true, message: '主密码设置成功' };
    } catch (error) {
      console.error('初始化主密码失败:', error);
      return { success: false, message: '初始化失败：' + error.message };
    }
  }

  /**
   * 验证主密码
   * @param {string} inputPassword - 用户输入的密码
   * @param {string} sessionMode - 会话模式：'default'(30分钟) | 'today'(今日有效) | 'browser'(关闭浏览器前有效)
   * @returns {Promise<{success: boolean, message: string, key?: CryptoKey}>} 验证结果和密钥
   */
  async verifyMasterPassword(inputPassword, sessionMode = 'default') {
    try {
      // 1. 获取安全配置
      const result = await chrome.storage.local.get('securityConfig');
      if (!result.securityConfig) {
        return { success: false, message: '未找到安全配置，请先设置主密码' };
      }

      const config = result.securityConfig;

      // 2. 解析盐值
      const salt = this.base64ToArrayBuffer(config.salt);

      // 3. 派生密钥
      const key = await this.deriveKey(inputPassword, salt);

      // 4. 尝试解密验证数据
      try {
        const decrypted = await this.decrypt(config.verificationData, key);

        if (decrypted === this.VERIFICATION_TEXT) {
          // 验证成功，通知 background.js 设置会话密钥
          const exportedKey = await crypto.subtle.exportKey('raw', key);
          await chrome.runtime.sendMessage({
            action: 'setSessionKey',
            keyData: this.arrayBufferToBase64(exportedKey),
            mode: sessionMode
          });

          return { success: true, message: '主密码验证成功', key };
        } else {
          return { success: false, message: '主密码错误' };
        }
      } catch (decryptError) {
        // 解密失败意味着密码错误
        return { success: false, message: '主密码错误' };
      }
    } catch (error) {
      console.error('验证主密码失败:', error);
      return { success: false, message: '验证失败：' + error.message };
    }
  }

  /**
   * 检查是否已设置主密码
   * @returns {Promise<boolean>} 是否已设置
   */
  async hasSecurityConfig() {
    const result = await chrome.storage.local.get('securityConfig');
    return !!result.securityConfig;
  }

  /**
   * 检查是否需要从旧版本迁移
   * @returns {Promise<boolean>} 是否需要迁移
   */
  async needsMigration() {
    const result = await chrome.storage.local.get('masterPassword');
    return !!result.masterPassword;
  }

  /**
   * 从旧版本迁移数据
   * @param {string} oldMasterPassword - 旧版本的主密码（明文）
   * @param {string} newMasterPassword - 新的主密码
   * @returns {Promise<{success: boolean, message: string}>} 迁移结果
   */
  async migrateFromOldVersion(oldMasterPassword, newMasterPassword) {
    try {
      // 1. 验证旧主密码
      const oldData = await chrome.storage.local.get(['masterPassword', 'accounts']);
      if (!oldData.masterPassword) {
        return { success: false, message: '未找到旧版本数据' };
      }

      if (oldData.masterPassword !== oldMasterPassword) {
        return { success: false, message: '旧主密码错误' };
      }

      // 2. 获取所有账号
      const accounts = oldData.accounts || [];

      // 3. 使用旧主密码解密所有密码
      const decryptedAccounts = [];
      for (const account of accounts) {
        try {
          // 旧版本使用 window.cryptoUtils
          if (window.cryptoUtils && account.password) {
            const decrypted = await window.cryptoUtils.decrypt(
              account.password,
              oldMasterPassword
            );
            decryptedAccounts.push({
              ...account,
              decryptedPassword: decrypted
            });
          } else {
            decryptedAccounts.push({
              ...account,
              decryptedPassword: account.password
            });
          }
        } catch (error) {
          console.warn(`账号 ${account.username} 解密失败:`, error);
          decryptedAccounts.push({
            ...account,
            decryptedPassword: account.password
          });
        }
      }

      // 4. 初始化新的主密码系统
      const initResult = await this.initializeMasterPassword(newMasterPassword);
      if (!initResult.success) {
        return initResult;
      }

      // 5. 使用新主密码重新加密所有密码
      const newSalt = this.base64ToArrayBuffer(
        (await chrome.storage.local.get('securityConfig')).securityConfig.salt
      );
      const newKey = await this.deriveKey(newMasterPassword, newSalt);

      const reEncryptedAccounts = [];
      for (const account of decryptedAccounts) {
        const encrypted = await this.encrypt(account.decryptedPassword, newKey);
        reEncryptedAccounts.push({
          ...account,
          password: encrypted,
          decryptedPassword: undefined // 删除明文密码
        });
      }

      // 6. 保存重新加密的账号
      await chrome.storage.local.set({ accounts: reEncryptedAccounts });

      // 7. 删除旧的主密码字段
      await chrome.storage.local.remove('masterPassword');

      return { success: true, message: '数据迁移成功' };
    } catch (error) {
      console.error('数据迁移失败:', error);
      return { success: false, message: '迁移失败：' + error.message };
    }
  }

  /**
   * 从 background.js 获取会话密钥
   * @returns {Promise<CryptoKey|null>} 会话密钥（如果有效）
   */
  async getSessionKey() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSessionKey' });
      if (response && response.keyData) {
        const keyBuffer = this.base64ToArrayBuffer(response.keyData);
        const key = await crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        return key;
      }
      return null;
    } catch (error) {
      console.debug('获取会话密钥失败:', error);
      return null;
    }
  }

  /**
   * 清除会话（登出）
   * @returns {Promise<void>}
   */
  async clearSession() {
    try {
      await chrome.runtime.sendMessage({ action: 'clearSession' });
    } catch (error) {
      console.debug('清除会话失败:', error);
    }
  }
}

// 导出单例（ES6 module）
export const securityManager = new SecurityManager();
