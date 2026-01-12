/**
 * 密码加密工具
 * 使用 Web Crypto API 进行 AES-GCM 加密
 * 符合 Chrome Extension Manifest V3 规范
 */

class CryptoUtils {
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
   * 使用主密码加密账号密码
   * 主密码存储在扩展的storage中（可选：使用用户输入的主密码）
   */
  async encryptPassword(password, masterPassword = null) {
    // 如果没有提供主密码，使用默认密钥（不安全，仅作示例）
    // 实际应用中应该要求用户设置主密码
    const master = masterPassword || await this.getMasterPassword();
    
    if (!master) {
      // 如果没有主密码，返回原密码（不加密）
      // 实际应用中应该强制要求设置主密码
      console.warn('未设置主密码，密码将以明文存储（不安全）');
      return password;
    }
    
    try {
      return await this.encrypt(password, master);
    } catch (error) {
      console.error('密码加密失败:', error);
      // 加密失败时返回原密码
      return password;
    }
  }
  
  /**
   * 解密账号密码
   */
  async decryptPassword(encryptedPassword, masterPassword = null) {
    // 如果密码不是加密格式（Base64），直接返回
    if (!this.isBase64(encryptedPassword)) {
      return encryptedPassword;
    }
    
    const master = masterPassword || await this.getMasterPassword();
    
    if (!master) {
      console.warn('未设置主密码，无法解密');
      return encryptedPassword;
    }
    
    try {
      return await this.decrypt(encryptedPassword, master);
    } catch (error) {
      console.error('密码解密失败:', error);
      return encryptedPassword;
    }
  }
  
  /**
   * 获取主密码（从storage或提示用户输入）
   */
  async getMasterPassword() {
    try {
      const result = await chrome.storage.local.get('masterPassword');
      return result.masterPassword || null;
    } catch (error) {
      console.error('获取主密码失败:', error);
      return null;
    }
  }
  
  /**
   * 设置主密码
   */
  async setMasterPassword(password) {
    try {
      await chrome.storage.local.set({ masterPassword: password });
      return true;
    } catch (error) {
      console.error('设置主密码失败:', error);
      return false;
    }
  }
  
  /**
   * 检查字符串是否为Base64格式
   */
  isBase64(str) {
    try {
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      return base64Regex.test(str) && str.length > 0;
    } catch {
      return false;
    }
  }
}

// 导出单例
const cryptoUtils = new CryptoUtils();

// 如果在浏览器环境中，挂载到window
if (typeof window !== 'undefined') {
  window.cryptoUtils = cryptoUtils;
}

// 如果在Service Worker环境中，使用self
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.cryptoUtils = cryptoUtils;
}
