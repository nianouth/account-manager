/**
 * Toast 提示消息工具
 * 统一的消息提示系统，支持多种类型
 */

/**
 * Toast 消息类型的颜色配置
 */
const TOAST_COLORS = {
  success: {
    background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
    icon: '✓'
  },
  error: {
    background: 'linear-gradient(135deg, #F44336 0%, #EF5350 100%)',
    icon: '✕'
  },
  warning: {
    background: 'linear-gradient(135deg, #FF9800 0%, #FFA726 100%)',
    icon: '⚠'
  },
  info: {
    background: 'linear-gradient(135deg, #2196F3 0%, #42A5F5 100%)',
    icon: 'ℹ'
  }
};

/**
 * 确保动画样式已注入
 */
function ensureToastStyles() {
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1);
        }
      }
      @keyframes slideUp {
        from {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px) scale(0.9);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * 显示 Toast 消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (success, error, warning, info)
 * @param {number} duration - 显示时长（毫秒）
 */
export function showToast(message, type = 'success', duration = 2000) {
  // 移除已存在的 Toast
  const existingToast = document.getElementById('toast-message');
  if (existingToast) {
    existingToast.remove();
  }

  // 确保样式已注入
  ensureToastStyles();

  // 获取配置
  const config = TOAST_COLORS[type] || TOAST_COLORS.success;

  // 创建 Toast 元素
  const toast = document.createElement('div');
  toast.id = 'toast-message';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${config.background};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    animation: slideDown 0.3s ease-out;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 90%;
  `;

  // 添加图标
  const iconSpan = document.createElement('span');
  iconSpan.style.cssText = `
    font-size: 16px;
    font-weight: bold;
  `;
  iconSpan.textContent = config.icon;

  // 添加消息文本
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(messageSpan);
  document.body.appendChild(toast);

  // 自动移除
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

/**
 * 显示成功消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长（毫秒）
 */
export function showSuccessMessage(message, duration = 2000) {
  showToast(message, 'success', duration);
}

/**
 * 显示错误消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长（毫秒）
 */
export function showErrorMessage(message, duration = 2000) {
  showToast(message, 'error', duration);
}

/**
 * 显示警告消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长（毫秒）
 */
export function showWarningMessage(message, duration = 2000) {
  showToast(message, 'warning', duration);
}

/**
 * 显示信息消息
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长（毫秒）
 */
export function showInfoMessage(message, duration = 2000) {
  showToast(message, 'info', duration);
}
