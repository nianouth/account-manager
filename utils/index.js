/**
 * 工具函数统一导出入口
 * 方便在其他文件中导入所有工具函数
 */

// DOM 操作工具
export {
  safeSetTextContent,
  createElement,
  getElement,
  getElements,
  addClass,
  removeClass,
  toggleClass
} from './dom-utils.js';

// Toast 提示工具
export {
  showToast,
  showSuccessMessage,
  showErrorMessage,
  showWarningMessage,
  showInfoMessage
} from './toast.js';

// 验证工具
export {
  validateMasterPassword,
  validateEnvironment,
  validateAccount,
  validateEmail,
  validateUrl,
  checkPasswordStrength
} from './validation.js';

// URL 匹配工具
export {
  normalizeUrl,
  matchEnvironment,
  isUrlMatched
} from './url-matcher.js';
