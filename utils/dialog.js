/**
 * 自定义对话框工具
 * 替代原生 prompt / alert / confirm，与 iOS 风格 UI 保持一致
 * 所有函数返回 Promise，支持 async/await
 */

let dialogCounter = 0;

/**
 * 创建对话框基础结构
 */
function createDialogDOM(title, bodyContent, buttons, options = {}) {
  const id = `dialog-${++dialogCounter}`;

  // 遮罩层
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'modal active dialog-modal';
  overlay.style.zIndex = '10002';

  // 内容容器
  const content = document.createElement('div');
  content.className = 'modal-content dialog-content';

  // 标题
  if (title) {
    const header = document.createElement('div');
    header.className = 'modal-header';
    const h2 = document.createElement('h2');
    h2.textContent = title;
    header.appendChild(h2);
    content.appendChild(header);
  }

  // 正文
  if (bodyContent) {
    const body = document.createElement('div');
    body.className = 'dialog-body';
    if (typeof bodyContent === 'string') {
      // 支持换行：将 \n 转为 <br> 安全方式
      bodyContent.split('\n').forEach((line, i, arr) => {
        body.appendChild(document.createTextNode(line));
        if (i < arr.length - 1) {
          body.appendChild(document.createElement('br'));
        }
      });
    } else {
      body.appendChild(bodyContent);
    }
    content.appendChild(body);
  }

  // 按钮区域
  if (buttons && buttons.length > 0) {
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    buttons.forEach(btn => actions.appendChild(btn));
    content.appendChild(actions);
  }

  overlay.appendChild(content);
  return { overlay, content, id };
}

/**
 * 移除对话框（带动画）
 */
function removeDialog(overlay) {
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 150ms ease-out';
  setTimeout(() => overlay.remove(), 150);
}

/**
 * 显示提示框（替代 alert）
 * @param {string} title - 标题
 * @param {string} message - 消息内容
 * @returns {Promise<void>}
 */
export function showAlert(title, message) {
  return new Promise(resolve => {
    const okBtn = document.createElement('button');
    okBtn.className = 'btn-submit';
    okBtn.textContent = '确定';
    okBtn.style.minWidth = '100%';

    const { overlay } = createDialogDOM(title, message, [okBtn]);

    okBtn.addEventListener('click', () => {
      removeDialog(overlay);
      resolve();
    });

    // Esc 关闭
    const onKey = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        removeDialog(overlay);
        resolve();
      }
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    okBtn.focus();
  });
}

/**
 * 显示确认框（替代 confirm）
 * @param {string} title - 标题
 * @param {string} message - 消息内容
 * @param {Object} options - 选项
 * @param {string} options.confirmText - 确认按钮文字（默认 '确定'）
 * @param {string} options.cancelText - 取消按钮文字（默认 '取消'）
 * @param {boolean} options.dangerous - 是否为危险操作（确认按钮变红）
 * @returns {Promise<boolean>}
 */
export function showConfirm(title, message, options = {}) {
  const {
    confirmText = '确定',
    cancelText = '取消',
    dangerous = false
  } = options;

  return new Promise(resolve => {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = dangerous ? 'btn-submit btn-danger' : 'btn-submit';
    confirmBtn.textContent = confirmText;

    const { overlay } = createDialogDOM(title, message, [cancelBtn, confirmBtn]);

    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      removeDialog(overlay);
      resolve(result);
    };

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    // Esc = 取消
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}

/**
 * 显示输入框（替代 prompt）
 * @param {string} title - 标题
 * @param {string} message - 提示消息
 * @param {Object} options - 选项
 * @param {string} options.inputType - 输入类型（'text' | 'password'，默认 'text'）
 * @param {string} options.placeholder - 占位符
 * @param {string} options.defaultValue - 默认值
 * @param {boolean} options.required - 是否必填（默认 true）
 * @param {string} options.confirmText - 确认按钮文字
 * @param {string} options.cancelText - 取消按钮文字
 * @param {boolean} options.allowCancel - 是否允许取消（默认 true）
 * @returns {Promise<string|null>} 输入值，取消返回 null
 */
export function showPrompt(title, message, options = {}) {
  const {
    inputType = 'text',
    placeholder = '',
    defaultValue = '',
    required = true,
    confirmText = '确定',
    cancelText = '取消',
    allowCancel = true
  } = options;

  return new Promise(resolve => {
    // 构建表单内容
    const body = document.createElement('div');

    // 消息
    if (message) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'dialog-message';
      message.split('\n').forEach((line, i, arr) => {
        msgDiv.appendChild(document.createTextNode(line));
        if (i < arr.length - 1) {
          msgDiv.appendChild(document.createElement('br'));
        }
      });
      body.appendChild(msgDiv);
    }

    // 输入框
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    formGroup.style.marginBottom = '0';

    const input = document.createElement('input');
    input.type = inputType;
    input.placeholder = placeholder;
    input.value = defaultValue;
    input.className = 'dialog-input';

    if (inputType === 'password') {
      const wrapper = document.createElement('div');
      wrapper.className = 'password-input-wrapper';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'password-toggle-btn';
      toggleBtn.setAttribute('aria-label', '显示/隐藏密码');
      toggleBtn.innerHTML = `
        <svg class="eye-icon eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <svg class="eye-icon eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
      toggleBtn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggleBtn.classList.toggle('show-password', isPassword);
      });

      wrapper.appendChild(input);
      wrapper.appendChild(toggleBtn);
      formGroup.appendChild(wrapper);
    } else {
      formGroup.appendChild(input);
    }

    body.appendChild(formGroup);

    // 错误提示区域
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.marginTop = '8px';
    body.appendChild(errorDiv);

    // 按钮
    const buttons = [];
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = cancelText;
    if (allowCancel) {
      buttons.push(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-submit';
    confirmBtn.textContent = confirmText;
    buttons.push(confirmBtn);

    const { overlay } = createDialogDOM(title, body, buttons);

    const close = (value) => {
      document.removeEventListener('keydown', onKey);
      removeDialog(overlay);
      resolve(value);
    };

    const submit = () => {
      const value = input.value.trim();
      if (required && !value) {
        errorDiv.textContent = '此项不能为空';
        errorDiv.classList.add('show');
        input.focus();
        return;
      }
      close(value || null);
    };

    confirmBtn.addEventListener('click', submit);
    if (allowCancel) {
      cancelBtn.addEventListener('click', () => close(null));
    }

    // Enter 提交
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });

    // 点击遮罩
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && allowCancel) close(null);
    });

    // Esc
    const onKey = (e) => {
      if (e.key === 'Escape' && allowCancel) close(null);
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    // 延迟 focus 确保动画完成后输入框可用
    setTimeout(() => input.focus(), 50);
  });
}
