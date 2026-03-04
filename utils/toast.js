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
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
  },
  error: {
    background: 'linear-gradient(135deg, #FF3B30 0%, #FF6961 100%)',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
  },
  warning: {
    background: 'linear-gradient(135deg, #FF9500 0%, #FFAC33 100%)',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
  },
  info: {
    background: 'linear-gradient(135deg, #007AFF 0%, #5AC8FA 100%)',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
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
    display: flex;
    align-items: center;
  `;
  iconSpan.innerHTML = config.icon;

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
