/**
 * 表单验证工具
 * 提供各种验证函数
 */

/**
 * 验证主密码强度
 * @param {string} password - 待验证的密码
 * @returns {{valid: boolean, message: string}} 验证结果
 */
export function validateMasterPassword(password) {
  const minLength = 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!password || typeof password !== 'string') {
    return { valid: false, message: '密码不能为空' };
  }

  if (password.length < minLength) {
    return { valid: false, message: `主密码至少需要 ${minLength} 位` };
  }

  if (!hasUpper || !hasLower || !hasNumber) {
    return { valid: false, message: '主密码需包含大小写字母和数字' };
  }

  return { valid: true, message: '密码强度符合要求' };
}

/**
 * 验证网站信息
 * @param {Object} env - 网站对象
 * @returns {{valid: boolean, errors: Array}} 验证结果
 */
export function validateEnvironment(env) {
  const errors = [];

  if (!env.name || env.name.trim() === '') {
    errors.push({ field: 'name', message: '网站名称不能为空' });
  }

  if (!env.loginUrl || env.loginUrl.trim() === '') {
    errors.push({ field: 'loginUrl', message: '登录页面 URL 不能为空' });
  } else {
    // 验证 URL 格式
    try {
      new URL(env.loginUrl);
    } catch {
      errors.push({ field: 'loginUrl', message: '登录页面 URL 格式不正确' });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证账号信息
 * @param {Object} account - 账号对象
 * @returns {{valid: boolean, errors: Array}} 验证结果
 */
export function validateAccount(account) {
  const errors = [];

  if (!account.username || account.username.trim() === '') {
    errors.push({ field: 'username', message: '用户名不能为空' });
  }

  if (!account.account || account.account.trim() === '') {
    errors.push({ field: 'account', message: '账号不能为空' });
  }

  if (!account.password || account.password.trim() === '') {
    errors.push({ field: 'password', message: '密码不能为空' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证 Email 格式
 * @param {string} email - Email 地址
 * @returns {boolean} 是否有效
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证 URL 格式
 * @param {string} url - URL 地址
 * @returns {boolean} 是否有效
 */
export function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查密码强度
 * @param {string} password - 密码
 * @returns {{strength: string, score: number}} 强度评估
 */
export function checkPasswordStrength(password) {
  if (!password) {
    return { strength: '无', score: 0 };
  }

  let score = 0;

  // 长度评分
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // 复杂度评分
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  // 评级
  let strength;
  if (score <= 2) {
    strength = '弱';
  } else if (score <= 4) {
    strength = '中等';
  } else if (score <= 6) {
    strength = '强';
  } else {
    strength = '非常强';
  }

  return { strength, score };
}
