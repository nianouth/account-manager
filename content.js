/**
 * 账号管理器 - 内容脚本
 * 符合 Chrome Extension Manifest V3 规范
 * 修复XSS风险，改进DOM操作，添加拖拽功能
 */

// 工具函数：安全的文本内容设置（防止XSS）
const safeSetTextContent = (element, text) => {
  if (element && text !== null && text !== undefined) {
    element.textContent = String(text);
  }
};

// 工具函数：创建元素（避免使用innerHTML）
const createElement = (tag, attributes = {}, children = []) => {
  const element = document.createElement(tag);
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key === 'class') {
      element.className = value;
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, value);
    } else {
      element[key] = value;
    }
  });
  
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  });
  
  return element;
};

// 工具函数：显示成功提示
const showSuccessMessage = (message, duration = 2000) => {
  // 移除已存在的提示
  const existingToast = document.getElementById('floating-success-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = createElement('div', {
    id: 'floating-success-toast',
    style: {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#518EFF',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: '1000001',
      fontSize: '14px',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      whiteSpace: 'nowrap'
    }
  }, [message]);
  
  // 添加动画
  toast.style.animation = 'slideDown 0.3s ease-out';
  
  // 确保动画样式存在
  if (!document.getElementById('floating-toast-animations')) {
    const style = createElement('style', {
      id: 'floating-toast-animations'
    });
    style.textContent = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      @keyframes slideUp {
        from {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        to {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // 自动移除
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
};

// 拖拽功能（纯 GPU 合成：translate3d + pointer events）
class PanelDragger {
  constructor(panel, header) {
    this.panel = panel;
    this.header = header;
    this.isDragging = false;
    this.currentX = 0;
    this.currentY = 0;
    // 拖拽开始时的鼠标与面板偏移
    this.grabOffsetX = 0;
    this.grabOffsetY = 0;
    // 缓存面板尺寸（拖拽开始时读取一次，避免拖拽中触发 reflow）
    this.panelW = 0;
    this.panelH = 0;
    this.rafId = null;
    this.needsUpdate = false;
    this.targetX = 0;
    this.targetY = 0;

    this.init();
  }

  init() {
    this.header.style.cursor = 'move';

    // 使用 pointer events 统一鼠标和触摸
    this.header.addEventListener('pointerdown', this._onDown = (e) => {
      if (this.panel.classList.contains('collapsed')) return;
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;

      e.preventDefault();
      this.header.setPointerCapture(e.pointerId);

      this.isDragging = true;
      this.panel.classList.add('dragging');

      // 仅在拖拽开始时读一次布局（唯一的 reflow）
      const rect = this.panel.getBoundingClientRect();
      this.panelW = rect.width;
      this.panelH = rect.height;
      this.grabOffsetX = e.clientX - rect.left;
      this.grabOffsetY = e.clientY - rect.top;
    });

    this.header.addEventListener('pointermove', this._onMove = (e) => {
      if (!this.isDragging) return;

      const maxX = window.innerWidth - this.panelW;
      const maxY = window.innerHeight - this.panelH;
      this.targetX = Math.max(0, Math.min(e.clientX - this.grabOffsetX, maxX));
      this.targetY = Math.max(0, Math.min(e.clientY - this.grabOffsetY, maxY));

      // 标记需要更新，rAF 循环会处理
      if (!this.needsUpdate) {
        this.needsUpdate = true;
        this.scheduleRender();
      }
    });

    this.header.addEventListener('pointerup', this._onUp = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.panel.classList.remove('dragging');

      // 最终位置写入
      this.currentX = this.targetX;
      this.currentY = this.targetY;
      this.applyPosition(this.currentX, this.currentY);
      this.savePosition(this.currentX, this.currentY);

      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.needsUpdate = false;
    });

    this.header.addEventListener('lostpointercapture', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.panel.classList.remove('dragging');
      }
    });

    // 恢复位置
    this.loadPosition();
  }

  scheduleRender() {
    this.rafId = requestAnimationFrame(() => {
      if (this.needsUpdate && this.isDragging) {
        this.applyPosition(this.targetX, this.targetY);
        this.needsUpdate = false;
        // 持续调度直到拖拽结束
        if (this.isDragging) {
          this.scheduleRender();
        }
      }
      this.rafId = null;
    });
  }

  applyPosition(x, y) {
    // translate3d 触发 GPU 合成层，不经过布局/绘制阶段
    this.panel.style.setProperty('transform', `translate3d(${x}px, ${y}px, 0)`, 'important');
  }

  savePosition(x, y) {
    try {
      localStorage.setItem('account-manager-panel-position', JSON.stringify({ x, y }));
    } catch (error) {
      console.debug('保存面板位置失败:', error);
    }
  }

  loadPosition() {
    try {
      const saved = localStorage.getItem('account-manager-panel-position');
      if (saved) {
        const { x, y } = JSON.parse(saved);
        this.currentX = x;
        this.currentY = y;
        this.applyPosition(x, y);
      }
    } catch (error) {
      console.debug('加载面板位置失败:', error);
    }
  }
}

// 悬浮面板管理器
class FloatingPanel {
  constructor() {
    this.panel = null;
    this.dragger = null;
    this.currentEnvId = null;
    this.isCollapsed = false;
    this.lastCheckedUrl = null;
    this.urlCheckInterval = null;
    this.init();
  }
  
  init() {
    if (document.getElementById('account-manager-panel')) {
      return; // 已存在
    }
    
    this.createPanel();
    this.setupEventListeners();
    this.loadEnvironments();
    
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'switchEnv') {
        this.switchEnvironment(request.envId);
        sendResponse({ success: true });
      }
      return true;
    });
    
    // 监听网站变化，如果当前域名不再匹配网站，隐藏面板
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.environments) {
        this.checkDomainMatch();
      }
    });
    
    // 监听URL变化（包括SPA路由变化）
    this.setupUrlChangeListener();
  }
  
  setupUrlChangeListener() {
    // 记录初始URL
    this.lastCheckedUrl = window.location.href;
    
    // 监听popstate事件（浏览器前进/后退）
    window.addEventListener('popstate', () => {
      this.checkDomainMatch();
    });
    
    // 监听pushstate和replacestate（SPA路由变化）
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    const self = this;
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(() => self.checkDomainMatch(), 100);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => self.checkDomainMatch(), 100);
    };
    
    // 定期检查URL变化（作为备用方案，处理其他可能的URL变化）
    this.urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastCheckedUrl) {
        this.lastCheckedUrl = currentUrl;
        this.checkDomainMatch();
      }
    }, 1000);
  }
  
  async checkDomainMatch() {
    const currentUrl = window.location.href;
    if (!currentUrl || !currentUrl.startsWith('http')) {
      this.hidePanel();
      this.lastCheckedUrl = currentUrl;
      return;
    }
    
    // 如果URL没有变化，跳过检查（避免重复检查）
    if (currentUrl === this.lastCheckedUrl) {
      return;
    }
    
    this.lastCheckedUrl = currentUrl;
    
    const matchedEnv = await matchEnvironment(currentUrl);
    if (!matchedEnv) {
      // URL不匹配任何网站的登录页面，隐藏面板
      console.debug('URL不匹配登录页面，隐藏悬浮面板:', currentUrl);
      this.hidePanel();
    } else {
      // 如果面板已隐藏，重新显示
      if (this.panel && this.panel.style.display === 'none') {
        this.showPanel();
      }
      // 切换到匹配的网站
      this.switchEnvironment(matchedEnv.id);
    }
  }
  
  hidePanel() {
    if (this.panel) {
      // 如果面板处于折叠状态，先恢复展开状态（以便下次显示时状态正确）
      if (this.isCollapsed) {
        this.expandFromCircle();
      }
      // 隐藏面板
      this.panel.style.display = 'none';
    }
  }
  
  showPanel() {
    if (this.panel) {
      this.panel.style.display = 'flex';
    }
  }
  
  createPanel() {
    this.panel = createElement('div', {
      id: 'account-manager-panel',
      style: {
        position: 'fixed',
        top: '10px',
        right: '10px',
        width: '300px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '999999',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        display: 'flex',
        flexDirection: 'column'
      }
    });
    
    // 头部
    const header = createElement('div', {
      class: 'panel-header',
      style: {
        padding: '10px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        cursor: 'move'
      }
    });
    
    const title = createElement('h3', {
      style: {
        margin: '0 0 10px 0',
        fontSize: '16px',
        color: '#333333'
      }
    }, ['账号管理器']);
    
    const envSelect = createElement('select', {
      id: 'env-select',
      style: {
        width: '100%',
        padding: '5px',
        border: '1px solid #E0E0E0',
        borderRadius: '4px',
        fontSize: '14px'
      }
    });
    const defaultOption = createElement('option', { value: '' }, ['选择网站']);
    envSelect.appendChild(defaultOption);
    
    header.appendChild(title);
    header.appendChild(envSelect);
    
    // 账号列表
    const accountList = createElement('div', {
      id: 'account-list',
      style: {
        maxHeight: '300px',
        overflowY: 'auto',
        padding: '10px'
      }
    });
    
    // 底部
    const footer = createElement('div', {
      style: {
        padding: '10px',
        borderTop: '1px solid #E0E0E0'
      }
    });
    
    const addBtn = createElement('button', {
      id: 'add-account-btn',
      style: {
        width: '100%',
        padding: '8px',
        backgroundColor: '#518EFF',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px'
      }
    }, ['添加账号']);
    
    footer.appendChild(addBtn);
    
    this.panel.appendChild(header);
    this.panel.appendChild(accountList);
    this.panel.appendChild(footer);
    
    document.body.appendChild(this.panel);
    
    // 初始化拖拽
    this.dragger = new PanelDragger(this.panel, header);
  }
  
  setupEventListeners() {
    const envSelect = document.getElementById('env-select');
    const addBtn = document.getElementById('add-account-btn');
    
    envSelect?.addEventListener('change', (e) => {
      this.switchEnvironment(e.target.value);
    });
    
    addBtn?.addEventListener('click', () => {
      this.showAddAccountForm();
    });
  }
  
  showAddAccountForm() {
    if (!this.currentEnvId) {
      alert('请先选择网站');
      return;
    }
    
    // 创建表单模态框
    const formModal = document.getElementById('floating-add-account-modal');
    if (formModal) {
      formModal.style.display = 'flex';
      return;
    }
    
    // 创建模态框
    const modal = createElement('div', {
      id: 'floating-add-account-modal',
      style: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: '1000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    });
    
    const formContent = createElement('div', {
      style: {
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '400px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }
    });
    
    const title = createElement('h3', {
      style: {
        margin: '0 0 15px 0',
        fontSize: '16px',
        color: '#333333'
      }
    }, ['添加账号']);
    
    const form = createElement('form', {
      id: 'floating-account-form'
    });
    
    // 用户名输入
    const usernameGroup = createElement('div', {
      style: {
        marginBottom: '15px'
      }
    });
    const usernameLabel = createElement('label', {
      style: {
        display: 'block',
        marginBottom: '5px',
        fontSize: '13px',
        color: '#666666'
      }
    }, ['用户名 *']);
    const usernameInput = createElement('input', {
      type: 'text',
      id: 'floating-username',
      required: true,
      style: {
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #E0E0E0',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box'
      }
    });
    usernameGroup.appendChild(usernameLabel);
    usernameGroup.appendChild(usernameInput);
    
    // 账号输入
    const accountGroup = createElement('div', {
      style: {
        marginBottom: '15px'
      }
    });
    const accountLabel = createElement('label', {
      style: {
        display: 'block',
        marginBottom: '5px',
        fontSize: '13px',
        color: '#666666'
      }
    }, ['账号 *']);
    const accountInput = createElement('input', {
      type: 'text',
      id: 'floating-account',
      required: true,
      style: {
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #E0E0E0',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box'
      }
    });
    accountGroup.appendChild(accountLabel);
    accountGroup.appendChild(accountInput);
    
    // 密码输入
    const passwordGroup = createElement('div', {
      style: {
        marginBottom: '15px'
      }
    });
    const passwordLabel = createElement('label', {
      style: {
        display: 'block',
        marginBottom: '5px',
        fontSize: '13px',
        color: '#666666'
      }
    }, ['密码 *']);
    
    // 密码输入框容器
    const passwordWrapper = createElement('div', {
      style: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
      }
    });
    
    const passwordInput = createElement('input', {
      type: 'password',
      id: 'floating-password',
      required: true,
      style: {
        width: '100%',
        padding: '8px 40px 8px 12px',
        border: '1px solid #E0E0E0',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box'
      }
    });
    
    // 眼睛图标按钮
    const passwordToggle = createElement('button', {
      type: 'button',
      id: 'floating-password-toggle',
      'aria-label': '显示/隐藏密码',
      style: {
        position: 'absolute',
        right: '4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666666',
        borderRadius: '4px',
        width: '28px',
        height: '28px',
        transition: 'all 0.2s'
      }
    });
    
    // 眼睛图标 SVG
    const eyeOpenSvg = createElement('svg', {
      width: '18',
      height: '18',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      class: 'eye-icon eye-open',
      style: {
        display: 'block'
      }
    });
    eyeOpenSvg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    
    const eyeClosedSvg = createElement('svg', {
      width: '18',
      height: '18',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      class: 'eye-icon eye-closed',
      style: {
        display: 'none'
      }
    });
    eyeClosedSvg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    
    passwordToggle.appendChild(eyeOpenSvg);
    passwordToggle.appendChild(eyeClosedSvg);
    
    // 切换密码显示/隐藏
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      if (isPassword) {
        eyeOpenSvg.style.display = 'none';
        eyeClosedSvg.style.display = 'block';
        passwordToggle.setAttribute('aria-label', '隐藏密码');
        passwordToggle.classList.add('show-password');
      } else {
        eyeOpenSvg.style.display = 'block';
        eyeClosedSvg.style.display = 'none';
        passwordToggle.setAttribute('aria-label', '显示密码');
        passwordToggle.classList.remove('show-password');
      }
    });
    
    // 悬停效果
    passwordToggle.addEventListener('mouseenter', () => {
      passwordToggle.style.backgroundColor = '#E6EFFB';
      passwordToggle.style.color = '#333333';
    });
    passwordToggle.addEventListener('mouseleave', () => {
      passwordToggle.style.backgroundColor = 'transparent';
      passwordToggle.style.color = '#666666';
    });
    
    passwordWrapper.appendChild(passwordInput);
    passwordWrapper.appendChild(passwordToggle);
    
    passwordGroup.appendChild(passwordLabel);
    passwordGroup.appendChild(passwordWrapper);
    
    // 备注输入
    const noteGroup = createElement('div', {
      style: {
        marginBottom: '15px'
      }
    });
    const noteLabel = createElement('label', {
      style: {
        display: 'block',
        marginBottom: '5px',
        fontSize: '13px',
        color: '#666666'
      }
    }, ['备注']);
    const noteInput = createElement('textarea', {
      id: 'floating-note',
      rows: '2',
      placeholder: '可选，添加备注信息...',
      style: {
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #E0E0E0',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        resize: 'vertical',
        minHeight: '60px'
      }
    });
    noteGroup.appendChild(noteLabel);
    noteGroup.appendChild(noteInput);
    
    // 按钮组
    const buttonGroup = createElement('div', {
      style: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end',
        marginTop: '20px'
      }
    });
    
    const cancelBtn = createElement('button', {
      type: 'button',
      style: {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        backgroundColor: '#E6EFFB',
        color: '#333333'
      }
    }, ['取消']);
    cancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    const submitBtn = createElement('button', {
      type: 'submit',
      style: {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        backgroundColor: '#518EFF',
        color: 'white'
      }
    }, ['保存']);
    
    buttonGroup.appendChild(cancelBtn);
    buttonGroup.appendChild(submitBtn);
    
    form.appendChild(usernameGroup);
    form.appendChild(accountGroup);
    form.appendChild(passwordGroup);
    form.appendChild(noteGroup);
    form.appendChild(buttonGroup);
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAddAccountSubmit();
      modal.style.display = 'none';
    });
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    formContent.appendChild(title);
    formContent.appendChild(form);
    modal.appendChild(formContent);
    document.body.appendChild(modal);
  }
  
  async handleAddAccountSubmit() {
    const username = document.getElementById('floating-username').value.trim();
    const account = document.getElementById('floating-account').value.trim();
    const password = document.getElementById('floating-password').value;
    const note = document.getElementById('floating-note')?.value.trim() || '';
    
    if (!username || !account || !password) {
      alert('请填写所有必填字段');
      return;
    }
    
    if (!this.currentEnvId) {
      alert('网站ID无效');
      return;
    }
    
    try {
      // 加密密码（如果可用）
      let encryptedPassword = password;
      if (window.cryptoUtils) {
        try {
          encryptedPassword = await window.cryptoUtils.encryptPassword(password);
        } catch (error) {
          console.warn('密码加密失败，使用明文存储:', error);
          encryptedPassword = password;
        }
      }
      
      const result = await chrome.storage.local.get('accounts');
      const accounts = result.accounts || [];
      
      const newAccount = {
        id: Date.now().toString(),
        envId: this.currentEnvId,
        username: username,
        account: account,
        password: encryptedPassword,
        note: note,
        createdAt: Date.now()
      };
      
      accounts.push(newAccount);
      await chrome.storage.local.set({ accounts });
      
      // 刷新账号列表
      await this.loadAccounts(this.currentEnvId);
      
      // 清空表单
      document.getElementById('floating-username').value = '';
      document.getElementById('floating-account').value = '';
      document.getElementById('floating-password').value = '';
      const noteInput = document.getElementById('floating-note');
      if (noteInput) noteInput.value = '';
      
      // 显示成功提示
      showSuccessMessage('账号添加成功');
      
      console.log('账号添加成功:', newAccount);
    } catch (error) {
      console.error('保存账号失败:', error);
      alert('保存失败: ' + error.message);
    }
  }
  
  async loadEnvironments() {
    try {
      const result = await chrome.storage.local.get('environments');
      const environments = result.environments || [];
      const envSelect = document.getElementById('env-select');
      
      if (!envSelect) return;
      
      // 清空现有选项（保留默认选项）
      while (envSelect.children.length > 1) {
        envSelect.removeChild(envSelect.lastChild);
      }
      
      environments.forEach(env => {
        const option = createElement('option', { value: env.id }, [env.name || '未命名网站']);
        envSelect.appendChild(option);
      });
    } catch (error) {
      console.error('加载网站失败:', error);
    }
  }
  
  switchEnvironment(envId) {
    this.currentEnvId = envId;
    const envSelect = document.getElementById('env-select');
    if (envSelect) {
      envSelect.value = envId;
    }
    this.loadAccounts(envId);
  }
  
  async loadAccounts(envId) {
    if (!envId) {
      const accountList = document.getElementById('account-list');
      if (accountList) {
        accountList.innerHTML = '';
        const emptyMsg = createElement('div', {
          style: {
            padding: '20px',
            textAlign: 'center',
            color: '#666666',
            fontSize: '14px'
          }
        }, ['请先选择网站']);
        accountList.appendChild(emptyMsg);
      }
      return;
    }
    
    try {
      const result = await chrome.storage.local.get('accounts');
      const accounts = result.accounts || [];
      const envAccounts = accounts.filter(account => account.envId === envId);
      const accountList = document.getElementById('account-list');
      
      if (!accountList) return;
      
      accountList.innerHTML = '';
      
      if (envAccounts.length === 0) {
        const emptyMsg = createElement('div', {
          style: {
            padding: '20px',
            textAlign: 'center',
            color: '#666666',
            fontSize: '14px'
          }
        }, ['该网站暂无账号']);
        accountList.appendChild(emptyMsg);
        return;
      }
      
      envAccounts.forEach(account => {
        const accountItem = this.createAccountItem(account);
        accountList.appendChild(accountItem);
      });
    } catch (error) {
      console.error('加载账号失败:', error);
    }
  }
  
  createAccountItem(account) {
    const item = createElement('div', {
      class: 'account-item',
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px'
      }
    });
    
    // 账号信息容器
    const accountInfoContainer = createElement('div', {
      style: {
        flex: '1',
        minWidth: '0',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }
    });
    
    // 用户名（账号）合并显示
    const accountInfo = createElement('div', {
      style: {
        fontSize: '13px',
        color: '#333333',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    });
    
    const username = account.username || '未命名';
    const accountText = account.account || '';
    const displayText = accountText ? `${username}（${accountText}）` : username;
    safeSetTextContent(accountInfo, displayText);
    
    accountInfoContainer.appendChild(accountInfo);
    
    // 备注信息
    if (account.note && account.note.trim()) {
      const accountNote = createElement('div', {
        style: {
          fontSize: '9px',
          color: '#CCCCCC',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          opacity: '0.7',
          lineHeight: '1.3'
        }
      });
      safeSetTextContent(accountNote, account.note.trim());
      accountInfoContainer.appendChild(accountNote);
    }
    
    const loginBtn = createElement('button', {
      class: 'login-btn',
      'data-account-id': account.id,
      style: {
        padding: '4px 12px',
        backgroundColor: '#518EFF',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        flexShrink: '0',
        whiteSpace: 'nowrap'
      }
    }, ['登录']);
    
    loginBtn.addEventListener('click', () => {
      this.handleLogin(account.id);
    });
    
    item.appendChild(accountInfoContainer);
    item.appendChild(loginBtn);
    
    return item;
  }
  
  async handleLogin(accountId) {
    try {
      const result = await chrome.storage.local.get('accounts');
      const accounts = result.accounts || [];
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        console.error('账号不存在');
        return;
      }
      
      // 智能查找登录表单
      const loginForm = this.findLoginForm();
      if (!loginForm) {
        alert('未找到登录表单，请确保当前页面包含登录表单');
        return;
      }
      
      // 填充表单
      this.fillLoginForm(loginForm, account);
      
      // 获取当前网站的登录按钮配置
      const envResult = await chrome.storage.local.get('environments');
      const environments = envResult.environments || [];
      const currentEnv = environments.find(e => e.id === this.currentEnvId);
      const loginButtonId = currentEnv?.loginButtonId || 'ch_login_btn';
      const loginButtonClass = currentEnv?.loginButtonClass || 'formBtn';
      
      // 直接提交登录表单
      this.submitLoginForm(loginForm, loginButtonId, loginButtonClass);
    } catch (error) {
      console.error('登录失败:', error);
      alert('登录失败: ' + error.message);
    }
  }
  
  findLoginForm() {
    // 多种方式查找登录表单
    const selectors = [
      'form[action*="login"]',
      'form[action*="signin"]',
      'form[action*="auth"]',
      'form'
    ];
    
    for (const selector of selectors) {
      const form = document.querySelector(selector);
      if (form) {
        const hasPassword = form.querySelector('input[type="password"]');
        if (hasPassword) {
          return form;
        }
      }
    }
    
    return null;
  }
  
  fillLoginForm(form, account) {
    // 查找用户名/账号输入框（包括 email 类型，因为很多网站使用 email 作为登录字段）
    const usernameSelectors = [
      'input[name="username"]',
      'input[name="email"]', // 很多网站使用 email 作为登录字段
      'input[name="user"]',
      'input[type="email"]', // 很多网站使用 email 类型
      'input[type="text"]',
      'input[id*="user"]',
      'input[id*="email"]', // 很多网站使用 email 作为 id
      'input[id*="login"]'
    ];
    
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[name="pass"]',
      'input[id*="password"]',
      'input[id*="pass"]'
    ];
    
    let filled = false;
    
    // 填充用户名
    for (const selector of usernameSelectors) {
      const input = form.querySelector(selector);
      if (input && !input.disabled && !input.readOnly) {
        input.value = account.account || account.username || '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled = true;
        break;
      }
    }
    
    // 填充密码
    for (const selector of passwordSelectors) {
      const input = form.querySelector(selector);
      if (input && !input.disabled && !input.readOnly) {
        input.value = account.password || '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filled = true;
        break;
      }
    }
    
    return filled;
  }
  
  submitLoginForm(form, loginButtonId, loginButtonClass) {
    const defaultId = loginButtonId || 'ch_login_btn';
    const defaultClass = loginButtonClass || 'formBtn';
    
    // 优先使用配置的按钮选择器
    let submitButton = null;
    
    // 1. 优先使用ID（在整个文档中查找）
    if (defaultId) {
      submitButton = document.getElementById(defaultId);
    }
    
    // 2. 如果ID没找到，使用Class（在整个文档中查找）
    if (!submitButton && defaultClass) {
      // 处理多个类名（用空格分隔）
      const classes = defaultClass.split(/\s+/).filter(c => c).map(c => `.${c}`).join('');
      submitButton = document.querySelector(classes || `.${defaultClass}`);
    }
    
    // 3. 如果都没找到，在表单内查找提交按钮
    if (!submitButton) {
      submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    }
    
    // 4. 如果还是没找到，尝试查找其他可能的提交按钮
    if (!submitButton) {
      submitButton = form.querySelector('button:not([type]), button[type="button"]');
    }
    
    // 5. 如果找到按钮，点击它
    if (submitButton) {
      submitButton.click();
      return true;
    }
    
    // 6. 如果还是没找到，尝试提交表单
    try {
      form.submit();
      return true;
    } catch (error) {
      console.error('提交表单失败:', error);
      return false;
    }
  }
  
  collapseToCircle() {
    if (!this.panel) return;
    
    // 保存当前状态
    this.isCollapsed = true;
    
    // 添加折叠类
    this.panel.classList.add('collapsed');
    
    // 设置圆形样式
    const rect = this.panel.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    this.panel.style.width = '50px';
    this.panel.style.height = '50px';
    this.panel.style.borderRadius = '50%';
    this.panel.style.left = `${centerX - 25}px`;
    this.panel.style.top = `${centerY - 25}px`;
    this.panel.style.right = 'auto';
    this.panel.style.transition = 'all 0.5s ease-in-out';
    this.panel.style.overflow = 'hidden';
    
    // 隐藏内容，只显示图标
    const header = this.panel.querySelector('.panel-header');
    const accountList = this.panel.querySelector('#account-list');
    const footer = this.panel.querySelector('div:last-child');
    
    if (header) header.style.display = 'none';
    if (accountList) accountList.style.display = 'none';
    if (footer) footer.style.display = 'none';
    
    // 创建圆形图标
    let circleIcon = this.panel.querySelector('.circle-icon');
    if (!circleIcon) {
      circleIcon = createElement('div', {
        class: 'circle-icon',
        style: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #A0C3FF 0%, #518EFF 100%)',
          borderRadius: '50%',
          cursor: 'pointer',
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold',
          userSelect: 'none',
          boxShadow: '0 4px 12px rgba(81, 142, 255, 0.4)',
          transition: 'transform 0.2s'
        }
      }, ['✓']);
      this.panel.appendChild(circleIcon);
      
      // 悬停效果
      circleIcon.addEventListener('mouseenter', () => {
        circleIcon.style.transform = 'scale(1.1)';
      });
      circleIcon.addEventListener('mouseleave', () => {
        circleIcon.style.transform = 'scale(1)';
      });
    }
    circleIcon.style.display = 'flex';
    
    // 点击圆形图标展开
    circleIcon.onclick = (e) => {
      e.stopPropagation();
      this.expandFromCircle();
    };
    
    // 添加提示文字
    circleIcon.title = '点击展开账号管理器';
  }
  
  expandFromCircle() {
    if (!this.panel) return;
    
    this.isCollapsed = false;
    this.panel.classList.remove('collapsed');
    
    // 恢复原始样式
    this.panel.style.width = '300px';
    this.panel.style.height = 'auto';
    this.panel.style.borderRadius = '8px';
    this.panel.style.transition = 'all 0.5s ease-in-out';
    
    // 显示内容
    const header = this.panel.querySelector('.panel-header');
    const accountList = this.panel.querySelector('#account-list');
    const footer = this.panel.querySelector('div:last-child');
    
    if (header) header.style.display = '';
    if (accountList) accountList.style.display = '';
    if (footer) footer.style.display = '';
    
    // 隐藏圆形图标
    const circleIcon = this.panel.querySelector('.circle-icon');
    if (circleIcon) {
      circleIcon.style.display = 'none';
    }
    
    // 恢复位置（如果需要）
    const savedPosition = this.dragger?.loadPosition();
    if (savedPosition) {
      // 位置已在 dragger 中处理
    }
  }
}

// 匹配网站（根据登录页面URL）
const matchEnvironment = async (currentUrl) => {
  if (!currentUrl) return null;
  
  try {
    const result = await chrome.storage.local.get('environments');
    const environments = result.environments || [];
    
    // 规范化当前URL（移除末尾的斜杠、查询参数、hash等，只保留协议+域名+路径）
    let normalizedCurrentUrl = currentUrl;
    try {
      const url = new URL(currentUrl);
      normalizedCurrentUrl = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '');
    } catch (error) {
      console.debug('URL规范化失败，使用原始URL:', error);
    }
    
    // 遍历所有网站，检查当前URL是否匹配登录页面URL
    for (const env of environments) {
      if (!env.loginUrl) continue;
      
      try {
        // 规范化网站的登录URL
        const envUrl = new URL(env.loginUrl);
        const normalizedEnvUrl = `${envUrl.protocol}//${envUrl.host}${envUrl.pathname}`.replace(/\/$/, '');
        
        // 精确匹配
        if (normalizedCurrentUrl === normalizedEnvUrl) {
          console.debug('URL精确匹配:', normalizedCurrentUrl, '===', normalizedEnvUrl);
          return env;
        }
        
        // 路径匹配（支持通配符，如 /login/*）
        if (normalizedEnvUrl.endsWith('/*')) {
          const baseUrl = normalizedEnvUrl.slice(0, -2);
          if (normalizedCurrentUrl.startsWith(baseUrl)) {
            console.debug('URL通配符匹配:', normalizedCurrentUrl, 'startsWith', baseUrl);
            return env;
          }
        }
        
        // 不再使用包含匹配，因为太宽松会导致误匹配
        // 例如：登录URL是 https://example.com，当前URL是 https://example.com/dashboard 也会匹配
      } catch (error) {
        console.debug('网站URL解析失败:', env.loginUrl, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('网站匹配失败:', error);
    return null;
  }
};

// 初始化
let floatingPanel = null;

const initFloatingPanel = async () => {
  // 避免在特殊页面注入
  if (window.location.protocol === 'chrome:' || 
      window.location.protocol === 'chrome-extension:') {
    return;
  }
  
  // 获取当前URL
  const currentUrl = window.location.href;
  if (!currentUrl || !currentUrl.startsWith('http')) {
    console.debug('无法获取有效URL，不显示悬浮面板');
    return;
  }
  
  // 检查当前URL是否匹配网站的登录页面URL
  const matchedEnv = await matchEnvironment(currentUrl);
  if (!matchedEnv) {
    console.debug('当前URL未匹配到任何网站的登录页面，不显示悬浮面板:', currentUrl);
    return;
  }
  
  console.debug('URL匹配到网站:', matchedEnv.name, '登录URL:', matchedEnv.loginUrl);
  
  // 等待DOM加载完成
  const initPanel = () => {
    floatingPanel = new FloatingPanel();
    // 自动切换到匹配的网站
    if (floatingPanel && matchedEnv.id) {
      // 延迟一下确保面板已创建
      setTimeout(() => {
        floatingPanel.switchEnvironment(matchedEnv.id);
      }, 100);
    }
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPanel);
  } else {
    initPanel();
  }
};

// 启动
initFloatingPanel();