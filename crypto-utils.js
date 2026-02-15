/**
 * 密码加密工具
 * 使用 Web Crypto API 进行 AES-GCM 加密
 * 符合 Chrome Extension Manifest V3 规范
 */

export class CryptoUtils {
  constructor() {
    this.algorithm = {
      name: 'AES-GCM',
      length: 256
    };
    this.keyUsage = ['encrypt', 'decrypt'];
  }
  
  /**
   * 生成加密密钥（从用户密码派生）
   * 使用 PBKDF2 派生密钥
   */
  async deriveKey(password, salt) {
    try {
      // 导入密码
      const encoder = new TextEncoder();
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
          iterations: 100000,
          hash: 'SHA-256'
        },
        passwordKey,
        this.algorithm,
        false,
        this.keyUsage
      );
      
      return key;
    } catch (error) {
      console.error('密钥派生失败:', error);
      throw new Error('密钥派生失败');
    }
  }
  
  /**
   * 生成随机盐值
   */
  generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  }
  
  /**
   * 生成随机IV（初始化向量）
   */
  generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
  }
  
  /**
   * 加密数据
   */
  async encrypt(plaintext, password) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      
      // 生成盐和IV
      const salt = this.generateSalt();
      const iv = this.generateIV();
      
      // 派生密钥
      const key = await this.deriveKey(password, salt);
      
      // 加密
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        data
      );
      
      // 组合结果：salt + iv + encrypted data
      const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      result.set(salt, 0);
      result.set(iv, salt.length);
      result.set(new Uint8Array(encrypted), salt.length + iv.length);
      
      // 转换为Base64字符串
      return this.arrayBufferToBase64(result.buffer);
    } catch (error) {
      console.error('加密失败:', error);
      throw new Error('加密失败');
    }
  }
  
  /**
   * 解密数据
   */
  async decrypt(ciphertext, password) {
    try {
      // 从Base64解码
      const data = this.base64ToArrayBuffer(ciphertext);
      
      // 提取salt、IV和加密数据
      const salt = data.slice(0, 16);
      const iv = data.slice(16, 28);
      const encrypted = data.slice(28);
      
      // 派生密钥
      const key = await this.deriveKey(password, salt);
      
      // 解密
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encrypted
      );
      
      // 转换为字符串
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('解密失败:', error);
      throw new Error('解密失败：密码可能不正确');
    }
  }
  
  /**
   * ArrayBuffer 转 Base64
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
   * 使用密钥加密账号密码
   * @param {string} password - 原始密码
   * @param {CryptoKey} key - 加密密钥（从 SecurityManager 获取）
   * @returns {Promise<string>} 加密后的密码
   * @throws {Error} 加密失败时抛出异常
   */
  async encryptPassword(password, key = null) {
    // 强制要求提供密钥，不降级为明文
    if (!key) {
      throw new Error('未提供加密密钥，无法加密密码');
    }

    // 加密失败时抛出异常，不降级为明文
    const encrypted = await this.encrypt(password, key);
    return encrypted;
  }
  
  /**
   * 使用密钥解密账号密码
   * @param {string} encryptedPassword - 加密的密码
   * @param {CryptoKey} key - 解密密钥（从 SecurityManager 获取）
   * @returns {Promise<string>} 解密后的密码
   * @throws {Error} 解密失败时抛出异常
   */
  async decryptPassword(encryptedPassword, key = null) {
    // 检查是否为加密格式
    if (!this.isBase64(encryptedPassword)) {
      throw new Error('密码格式不正确，不是有效的加密数据');
    }

    // 强制要求提供密钥
    if (!key) {
      throw new Error('未提供解密密钥，无法解密密码');
    }

    // 解密失败时抛出异常
    const decrypted = await this.decrypt(encryptedPassword, key);
    return decrypted;
  }
  
  /**
   * 注意：主密码管理已迁移到 SecurityManager
   * 不再在 CryptoUtils 中存储或获取主密码
   * 请使用 window.securityManager.initializeMasterPassword()
   * 和 window.securityManager.verifyMasterPassword()
   */
  
  /**
   * 检查字符串是否为Base64格式的加密数据
   * @param {string} str - 待检查的字符串
   * @returns {boolean} 是否为有效的加密数据
   */
  isBase64(str) {
    try {
      // 基础检查
      if (!str || typeof str !== 'string') {
        return false;
      }

      // Base64 长度必须是 4 的倍数
      if (str.length % 4 !== 0) {
        return false;
      }

      // 严格的 Base64 正则（必须包含有效字符）
      const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
      if (!base64Regex.test(str)) {
        return false;
      }

      // 尝试解码并验证最小长度
      // 加密数据格式：salt(16) + iv(12) + ciphertext(>=16) = 至少 44 字节
      // Base64 编码后约为 60+ 字符
      const decoded = atob(str);
      if (decoded.length < 28) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}

// 导出单例（ES6 module）
export const cryptoUtils = new CryptoUtils();
