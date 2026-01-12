/**
 * 全房通账号管理器V1.0.0 - 弹出窗口脚本
 * 符合 Chrome Extension Manifest V3 规范
 * 添加输入验证、改进UI交互、错误处理
 */

// 工具函数：安全的文本内容设置
const safeSetTextContent = (element, text) => {
  if (element && text !== null && text !== undefined) {
    element.textContent = String(text);
  }
};

// 工具函数：显示错误消息
const showError = (elementId, message) => {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
  }
};

// 工具函数：隐藏错误消息
const hideError = (elementId) => {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.classList.remove('show');
  }
};

// 工具函数：显示成功提示
const showSuccessMessage = (message, duration = 2000) => {
  // 移除已存在的提示
  const existingToast = document.getElementById('success-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.id = 'success-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #518EFF;
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-size: 14px;
    animation: slideDown 0.3s ease-out;
  `;
  toast.textContent = message;
  
  // 添加动画样式
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
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


// 模态框管理
class ModalManager {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    this.isOpen = false;
  }
  
  open() {
    if (this.modal) {
      this.modal.classList.add('active');
      this.isOpen = true;
    }
  }
  
  close() {
    if (this.modal) {
      this.modal.classList.remove('active');
      this.isOpen = false;
    }
  }
  
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

// 全房通账号管理器V1.0.0类
class AccountManager {
  constructor() {
    this.currentEnvId = null;
    this.currentAccountId = null;
    this.currentEnvIdForEdit = null; // 用于编辑环境
    this.searchTerm = '';
    this.envModal = new ModalManager('envModal');
    this.accountModal = new ModalManager('accountModal');
    this.envListExpanded = true; // 默认展开
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.loadEnvironments();
    // 初始化环境列表显示状态
    const envListContainer = document.getElementById('envListContainer');
    const envList = document.getElementById('envList');
    const toggleBtn = document.getElementById('toggleEnvList');
    
    if (envListContainer) {
      envListContainer.style.display = 'block'; // 始终显示容器（包含 header）
    }
    if (envList) {
      envList.style.display = this.envListExpanded ? 'flex' : 'none'; // 只控制列表内容
    }
    if (toggleBtn) {
      toggleBtn.textContent = this.envListExpanded ? '收起' : '展开';
    }
  }
  
  setupEventListeners() {
    // 环境选择
    const envSelect = document.getElementById('envSelect');
    envSelect?.addEventListener('change', (e) => {
      this.switchEnvironment(e.target.value);
    });
    
    // 添加环境按钮
    const addEnvBtn = document.getElementById('addEnvBtn');
    addEnvBtn?.addEventListener('click', () => {
      this.openEnvModal();
    });
    
    // 切换环境列表显示
    const toggleEnvList = document.getElementById('toggleEnvList');
    toggleEnvList?.addEventListener('click', () => {
      this.toggleEnvList();
    });
    
    // 添加账号按钮
    const addAccountBtn = document.getElementById('addAccountBtn');
    addAccountBtn?.addEventListener('click', () => {
      this.openAccountModal();
    });
    
    // 搜索框
    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.loadAccounts(this.currentEnvId);
    });
    
    // 环境表单
    const envForm = document.getElementById('envForm');
    envForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleEnvSubmit();
    });
    
    // 账号表单
    const accountForm = document.getElementById('accountForm');
    accountForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAccountSubmit();
    });
    
    // 取消按钮
    document.getElementById('envCancelBtn')?.addEventListener('click', () => {
      this.envModal.close();
      this.resetEnvForm();
    });
    
    document.getElementById('accountCancelBtn')?.addEventListener('click', () => {
      this.accountModal.close();
      this.resetAccountForm();
    });
    
    // 点击模态框外部关闭
    this.envModal.modal?.addEventListener('click', (e) => {
      if (e.target === this.envModal.modal) {
        this.envModal.close();
        this.resetEnvForm();
      }
    });
    
    this.accountModal.modal?.addEventListener('click', (e) => {
      if (e.target === this.accountModal.modal) {
        this.accountModal.close();
        this.resetAccountForm();
      }
    });
    
    // 密码显示/隐藏切换
    const passwordToggle = document.getElementById('accountPasswordToggle');
    const passwordInput = document.getElementById('accountPassword');
    if (passwordToggle && passwordInput) {
      passwordToggle.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggle.classList.toggle('show-password', isPassword);
        passwordToggle.setAttribute('aria-label', isPassword ? '隐藏密码' : '显示密码');
      });
    }
    
    // 导出按钮
    const exportBtn = document.getElementById('exportBtn');
    exportBtn?.addEventListener('click', () => {
      this.exportData();
    });
    
    // 导入按钮
    const importBtn = document.getElementById('importBtn');
    const importFileInput = document.getElementById('importFileInput');
    importBtn?.addEventListener('click', () => {
      importFileInput?.click();
    });
    
    // 文件选择监听
    importFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.importData(file);
        // 清空文件选择，以便可以重复选择同一文件
        e.target.value = '';
      }
    });
  }
  
  async loadEnvironments() {
    try {
      const result = await chrome.storage.local.get('environments');
      const environments = result.environments || [];
      const envSelect = document.getElementById('envSelect');
      
      if (!envSelect) return;
      
      // 清空现有选项（保留默认选项）
      while (envSelect.children.length > 1) {
        envSelect.removeChild(envSelect.lastChild);
      }
      
      environments.forEach(env => {
        const option = document.createElement('option');
        option.value = env.id;
        option.textContent = env.name || '未命名环境';
        envSelect.appendChild(option);
      });
      
      // 更新环境列表显示
      this.renderEnvList(environments);
    } catch (error) {
      console.error('加载环境失败:', error);
    }
  }
  
  renderEnvList(environments) {
    const envList = document.getElementById('envList');
    const envListContainer = document.getElementById('envListContainer');
    
    if (!envList || !envListContainer) return;
    
    if (environments.length === 0) {
      envList.innerHTML = `
        <div class="empty-state" style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
          暂无环境，点击"+"添加
        </div>
      `;
      return;
    }
    
    envList.innerHTML = '';
    environments.forEach(env => {
      const envItem = this.createEnvItem(env);
      envList.appendChild(envItem);
    });
  }
  
  createEnvItem(env) {
    const item = document.createElement('div');
    item.className = 'env-item';
    item.dataset.envId = env.id;
    if (env.id === this.currentEnvId) {
      item.classList.add('active');
    }
    
    const envInfo = document.createElement('div');
    envInfo.className = 'env-info';
    
    const envName = document.createElement('div');
    envName.className = 'env-name';
    safeSetTextContent(envName, env.name || '未命名环境');
    
    const envLoginUrl = document.createElement('div');
    envLoginUrl.className = 'env-domain';
    safeSetTextContent(envLoginUrl, env.loginUrl || '');
    
    envInfo.appendChild(envName);
    envInfo.appendChild(envLoginUrl);
    
    const envActions = document.createElement('div');
    envActions.className = 'env-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-env-edit';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openEnvModal(env.id);
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-env-delete';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleDeleteEnv(env.id);
    });
    
    // 点击环境项切换环境
    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        this.switchEnvironment(env.id);
        const envSelect = document.getElementById('envSelect');
        if (envSelect) {
          envSelect.value = env.id;
        }
      }
    });
    
    envActions.appendChild(editBtn);
    envActions.appendChild(deleteBtn);
    
    item.appendChild(envInfo);
    item.appendChild(envActions);
    
    return item;
  }
  
  toggleEnvList() {
    const envListContainer = document.getElementById('envListContainer');
    const envList = document.getElementById('envList');
    const toggleBtn = document.getElementById('toggleEnvList');
    
    if (!envListContainer || !envList || !toggleBtn) return;
    
    this.envListExpanded = !this.envListExpanded;
    
    if (this.envListExpanded) {
      // 展开：显示列表内容
      envListContainer.style.display = 'block';
      envList.style.display = 'flex';
      toggleBtn.textContent = '收起';
    } else {
      // 收起：只隐藏列表内容，保留 header 可见
      envList.style.display = 'none';
      toggleBtn.textContent = '展开';
    }
  }
  
  switchEnvironment(envId) {
    this.currentEnvId = envId;
    this.loadAccounts(envId);
    // 更新环境列表中的活动状态
    this.updateEnvListActiveState();
  }
  
  updateEnvListActiveState() {
    const envItems = document.querySelectorAll('.env-item');
    envItems.forEach(item => {
      const envId = item.dataset.envId;
      if (envId === this.currentEnvId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
  
  async loadAccounts(envId) {
    const accountList = document.getElementById('accountList');
    if (!accountList) return;
    
    if (!envId) {
      accountList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div>请先选择环境</div>
        </div>
      `;
      return;
    }
    
    try {
      const result = await chrome.storage.local.get('accounts');
      const accounts = result.accounts || [];
      let envAccounts = accounts.filter(account => account.envId === envId);
      
      // 搜索过滤
      if (this.searchTerm) {
        envAccounts = envAccounts.filter(account => 
          (account.username || '').toLowerCase().includes(this.searchTerm) ||
          (account.account || '').toLowerCase().includes(this.searchTerm)
        );
      }
      
      if (envAccounts.length === 0) {
        accountList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div>${this.searchTerm ? '未找到匹配的账号' : '该环境暂无账号'}</div>
          </div>
        `;
        return;
      }
      
      accountList.innerHTML = '';
      envAccounts.forEach(account => {
        const accountItem = this.createAccountItem(account);
        accountList.appendChild(accountItem);
      });
    } catch (error) {
      console.error('加载账号失败:', error);
      accountList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div>加载失败，请重试</div>
        </div>
      `;
    }
  }
  
  createAccountItem(account) {
    const item = document.createElement('div');
    item.className = 'account-item';
    
    const accountInfo = document.createElement('div');
    accountInfo.className = 'account-info';
    
    const username = document.createElement('div');
    username.className = 'username';
    safeSetTextContent(username, account.username || '未命名');
    
    const accountText = document.createElement('div');
    accountText.className = 'account-text';
    safeSetTextContent(accountText, account.account || '');
    
    accountInfo.appendChild(username);
    accountInfo.appendChild(accountText);
    
    // 备注信息
    if (account.note && account.note.trim()) {
      const accountNote = document.createElement('div');
      accountNote.className = 'account-note';
      safeSetTextContent(accountNote, account.note.trim());
      accountInfo.appendChild(accountNote);
    }
    
    const accountActions = document.createElement('div');
    accountActions.className = 'account-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => {
      this.openAccountModal(account.id);
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => {
      this.handleDeleteAccount(account.id);
    });
    
    accountActions.appendChild(editBtn);
    accountActions.appendChild(deleteBtn);
    
    item.appendChild(accountInfo);
    item.appendChild(accountActions);
    
    return item;
  }
  
  async handleLogin(accountId) {
    try {
      const result = await chrome.storage.local.get('accounts');
      const accounts = result.accounts || [];
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        alert('账号不存在');
        return;
      }
      
      // 解密密码（如果已加密）
      let decryptedPassword = account.password;
      if (window.cryptoUtils && account.password) {
        try {
          decryptedPassword = await window.cryptoUtils.decryptPassword(account.password);
        } catch (error) {
          console.warn('密码解密失败，使用原密码:', error);
          // 如果解密失败，使用原密码（可能是未加密的）
          decryptedPassword = account.password;
        }
      }
      
      // 创建账号副本，使用解密后的密码
      const accountWithDecryptedPassword = {
        ...account,
        password: decryptedPassword
      };
      
      // 获取当前环境的登录按钮配置
      const envResult = await chrome.storage.local.get('environments');
      const environments = envResult.environments || [];
      const currentEnv = environments.find(e => e.id === account.envId);
      const loginButtonId = currentEnv?.loginButtonId || 'ch_login_btn';
      const loginButtonClass = currentEnv?.loginButtonClass || 'formBtn';
      
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        alert('无法获取当前标签页');
        return;
      }
      
      // 注入登录脚本
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.fillLoginForm,
        args: [accountWithDecryptedPassword, loginButtonId, loginButtonClass]
      });
      
      // 关闭popup
      window.close();
    } catch (error) {
      console.error('登录失败:', error);
      alert('登录失败: ' + error.message);
    }
  }
  
  // 这个函数会在页面上下文中执行
  // 注意：由于在页面上下文中执行，无法直接访问cryptoUtils
  // 需要先解密密码，然后传递给这个函数
  fillLoginForm(account, loginButtonId, loginButtonClass) {
    // 查找登录表单
    const selectors = [
      'form[action*="login"]',
      'form[action*="signin"]',
      'form[action*="auth"]',
      'form'
    ];
    
    let form = null;
    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (found && found.querySelector('input[type="password"]')) {
        form = found;
        break;
      }
    }
    
    if (!form) {
      alert('未找到登录表单');
      return;
    }
    
    // 填充用户名/账号
    const usernameSelectors = [
      'input[name="username"]',
      'input[name="email"]', // 很多网站使用 email 作为登录字段
      'input[name="user"]',
      'input[type="email"]', // 很多网站使用 email 类型
      'input[type="text"]'
    ];
    
      for (const selector of usernameSelectors) {
        const input = form.querySelector(selector);
        if (input && !input.disabled && !input.readOnly) {
          input.value = account.account || account.username || '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    
    // 填充密码（account.password 应该已经是解密后的）
    const passwordInput = form.querySelector('input[type="password"]');
    if (passwordInput && !passwordInput.disabled && !passwordInput.readOnly) {
      passwordInput.value = account.password || '';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // 使用配置的按钮选择器提交登录表单
    const defaultId = loginButtonId || 'ch_login_btn';
    const defaultClass = loginButtonClass || 'formBtn';
    
    // 优先使用配置的选择器
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
    } else {
      // 6. 如果还是没找到，尝试提交表单
      form.submit();
    }
  }
  
  openEnvModal(envId = null) {
    const title = document.getElementById('envModalTitle');
    if (title) {
      title.textContent = envId ? '编辑环境' : '添加环境';
    }
    
    this.currentEnvIdForEdit = envId;
    
    if (envId) {
      // 编辑模式：加载环境数据
      chrome.storage.local.get('environments', (result) => {
        const environments = result.environments || [];
        const env = environments.find(e => e.id === envId);
        if (env) {
          document.getElementById('envName').value = env.name || '';
          document.getElementById('envLoginUrl').value = env.loginUrl || '';
          document.getElementById('envLoginButtonId').value = env.loginButtonId || 'ch_login_btn';
          document.getElementById('envLoginButtonClass').value = env.loginButtonClass || 'formBtn';
        }
      });
    } else {
      // 添加模式：清空表单
      this.resetEnvForm();
    }
    
    this.envModal.open();
  }
  
  async handleDeleteEnv(envId) {
    if (!envId) return;
    
    // 检查是否有关联的账号
    const result = await chrome.storage.local.get('accounts');
    const accounts = result.accounts || [];
    const relatedAccounts = accounts.filter(acc => acc.envId === envId);
    
    if (relatedAccounts.length > 0) {
      const confirmMsg = `该环境下有 ${relatedAccounts.length} 个账号，删除环境将同时删除这些账号。确定要删除吗？`;
      if (!confirm(confirmMsg)) {
        return;
      }
      
      // 删除关联的账号
      const filteredAccounts = accounts.filter(acc => acc.envId !== envId);
      await chrome.storage.local.set({ accounts: filteredAccounts });
    } else {
      if (!confirm('确定要删除这个环境吗？')) {
        return;
      }
    }
    
    try {
      const envResult = await chrome.storage.local.get('environments');
      const environments = envResult.environments || [];
      const filtered = environments.filter(e => e.id !== envId);
      await chrome.storage.local.set({ environments: filtered });
      
      // 如果删除的是当前选中的环境，清空选择
      if (this.currentEnvId === envId) {
        this.currentEnvId = null;
        const envSelect = document.getElementById('envSelect');
        if (envSelect) {
          envSelect.value = '';
        }
        this.loadAccounts(null);
      }
      
      await this.loadEnvironments();
    } catch (error) {
      console.error('删除环境失败:', error);
      alert('删除失败: ' + error.message);
    }
  }
  
  openAccountModal(accountId = null) {
    if (!this.currentEnvId) {
      alert('请先选择环境');
      return;
    }
    
    const title = document.getElementById('accountModalTitle');
    if (title) {
      title.textContent = accountId ? '编辑账号' : '添加账号';
    }
    
    // 先重置表单，清除之前的错误提示
    this.resetAccountForm();
    
    if (accountId) {
      // 编辑模式：加载账号数据
      chrome.storage.local.get('accounts', async (result) => {
        const accounts = result.accounts || [];
        const account = accounts.find(a => a.id === accountId);
        if (account) {
          document.getElementById('accountUsername').value = account.username || '';
          document.getElementById('accountAccount').value = account.account || '';
          
          // 解密密码用于编辑（如果已加密）
          let decryptedPassword = account.password;
          if (window.cryptoUtils && account.password) {
            try {
              decryptedPassword = await window.cryptoUtils.decryptPassword(account.password);
            } catch (error) {
              console.warn('密码解密失败，使用原密码:', error);
              decryptedPassword = account.password;
            }
          }
          
          document.getElementById('accountPassword').value = decryptedPassword || '';
          document.getElementById('accountNote').value = account.note || '';
          this.currentAccountId = accountId;
        }
      });
    } else {
      // 添加模式：确保表单是空的
      this.currentAccountId = null;
      document.getElementById('accountUsername').value = '';
      document.getElementById('accountAccount').value = '';
      document.getElementById('accountPassword').value = '';
      document.getElementById('accountNote').value = '';
    }
    
    this.accountModal.open();
  }
  
  resetEnvForm() {
    document.getElementById('envForm')?.reset();
    hideError('envNameError');
    hideError('envLoginUrlError');
    hideError('envLoginButtonIdError');
    hideError('envLoginButtonClassError');
    this.currentEnvIdForEdit = null;
  }
  
  resetAccountForm() {
    document.getElementById('accountForm')?.reset();
    hideError('accountUsernameError');
    hideError('accountAccountError');
    hideError('accountPasswordError');
    hideError('accountNoteError');
    this.currentAccountId = null;
    
    // 重置密码显示/隐藏状态
    const passwordInput = document.getElementById('accountPassword');
    const passwordToggle = document.getElementById('accountPasswordToggle');
    if (passwordInput && passwordToggle) {
      passwordInput.type = 'password';
      passwordToggle.classList.remove('show-password');
      passwordToggle.setAttribute('aria-label', '显示密码');
    }
    
    // 清空备注
    const noteInput = document.getElementById('accountNote');
    if (noteInput) {
      noteInput.value = '';
    }
  }
  
  async handleEnvSubmit() {
    const name = document.getElementById('envName').value.trim();
    const loginUrl = document.getElementById('envLoginUrl').value.trim();
    const loginButtonId = document.getElementById('envLoginButtonId').value.trim() || 'ch_login_btn';
    const loginButtonClass = document.getElementById('envLoginButtonClass').value.trim() || 'formBtn';
    
    // 验证
    let isValid = true;
    
    hideError('envNameError');
    hideError('envLoginUrlError');
    hideError('envLoginButtonIdError');
    hideError('envLoginButtonClassError');
    
    if (!name) {
      showError('envNameError', '环境名称不能为空');
      isValid = false;
    }
    
    if (!loginUrl) {
      showError('envLoginUrlError', '登录页面URL不能为空');
      isValid = false;
    } else {
      // 验证URL格式
      try {
        new URL(loginUrl);
      } catch (error) {
        showError('envLoginUrlError', 'URL格式不正确，请输入完整的URL（如：https://example.com/login）');
        isValid = false;
      }
    }
    
    if (!isValid) return;
    
    try {
      const result = await chrome.storage.local.get('environments');
      const environments = result.environments || [];
      
      if (this.currentEnvIdForEdit) {
        // 编辑模式
        const index = environments.findIndex(e => e.id === this.currentEnvIdForEdit);
        if (index !== -1) {
          environments[index] = {
            ...environments[index],
            name: name,
            loginUrl: loginUrl,
            loginButtonId: loginButtonId,
            loginButtonClass: loginButtonClass,
            updatedAt: Date.now()
          };
          await chrome.storage.local.set({ environments });
          await this.loadEnvironments();
          
          // 如果编辑的是当前选中的环境，更新选择器
          if (this.currentEnvId === this.currentEnvIdForEdit) {
            const envSelect = document.getElementById('envSelect');
            if (envSelect) {
              envSelect.value = this.currentEnvIdForEdit;
            }
          }
          
          this.envModal.close();
          this.resetEnvForm();
          
          // 显示成功提示
          showSuccessMessage('环境更新成功');
        }
      } else {
        // 添加模式
        const newEnv = {
          id: Date.now().toString(),
          name: name,
          loginUrl: loginUrl,
          loginButtonId: loginButtonId,
          loginButtonClass: loginButtonClass,
          createdAt: Date.now()
        };
        environments.push(newEnv);
        await chrome.storage.local.set({ environments });
        
        // 先设置当前环境ID，这样渲染时能正确显示活动状态
        this.currentEnvId = newEnv.id;
        
        // 更新环境选择器
        const envSelect = document.getElementById('envSelect');
        if (envSelect) {
          envSelect.value = newEnv.id;
        }
        
        // 重新加载环境列表（此时currentEnvId已设置，会正确显示活动状态）
        await this.loadEnvironments();
        
        // 加载该环境的账号列表
        await this.loadAccounts(newEnv.id);
        
        this.envModal.close();
        this.resetEnvForm();
        
        // 显示成功提示
        showSuccessMessage('环境添加成功');
      }
    } catch (error) {
      console.error('保存环境失败:', error);
      alert('保存失败: ' + error.message);
    }
  }
  
  async handleAccountSubmit() {
    const username = document.getElementById('accountUsername').value.trim();
    const account = document.getElementById('accountAccount').value.trim();
    const password = document.getElementById('accountPassword').value;
    const note = document.getElementById('accountNote').value.trim();
    
    // 验证
    let isValid = true;
    
    hideError('accountUsernameError');
    hideError('accountAccountError');
    hideError('accountPasswordError');
    hideError('accountNoteError');
    
    if (!username) {
      showError('accountUsernameError', '用户名不能为空');
      isValid = false;
    }
    
    if (!account) {
      showError('accountAccountError', '账号不能为空');
      isValid = false;
    }
    
    if (!password) {
      showError('accountPasswordError', '密码不能为空');
      isValid = false;
    }
    
    if (!isValid) return;
    
    // 再次检查环境ID（防止在添加过程中环境被删除）
    if (!this.currentEnvId) {
      alert('环境已不存在，请重新选择环境');
      this.accountModal.close();
      return;
    }
    
    try {
      // 加密密码（如果cryptoUtils可用）
      let encryptedPassword = password;
      if (window.cryptoUtils) {
        try {
          encryptedPassword = await window.cryptoUtils.encryptPassword(password);
        } catch (error) {
          console.warn('密码加密失败，使用明文存储:', error);
          // 如果加密失败，使用明文（向后兼容）
          encryptedPassword = password;
        }
      }
      
      const result = await chrome.storage.local.get('accounts');
      const accounts = result.accounts || [];
      
      if (this.currentAccountId) {
        // 编辑模式
        const index = accounts.findIndex(a => a.id === this.currentAccountId);
        if (index !== -1) {
          accounts[index] = {
            ...accounts[index],
            username: username,
            account: account,
            password: encryptedPassword,
            note: note || '',
            updatedAt: Date.now()
          };
          await chrome.storage.local.set({ accounts });
          await this.loadAccounts(this.currentEnvId);
          this.accountModal.close();
          this.resetAccountForm();
          
          // 显示成功提示
          showSuccessMessage('账号更新成功');
        }
      } else {
        // 添加模式
        // 再次确认环境ID有效
        if (!this.currentEnvId) {
          alert('环境ID无效，请重新选择环境');
          this.accountModal.close();
          return;
        }
        
        const newAccount = {
          id: Date.now().toString(),
          envId: this.currentEnvId,
          username: username,
          account: account,
          password: encryptedPassword,
          note: note || '',
          createdAt: Date.now()
        };
        
        accounts.push(newAccount);
        await chrome.storage.local.set({ accounts });
        
        // 刷新账号列表
        await this.loadAccounts(this.currentEnvId);
        
        // 关闭模态框并重置表单
        this.accountModal.close();
        this.resetAccountForm();
        
        // 显示成功提示
        showSuccessMessage('账号添加成功');
        
        console.log('账号添加成功:', newAccount);
      }
    } catch (error) {
      console.error('保存账号失败:', error);
      alert('保存失败: ' + error.message);
    }
  }
  
  async handleDeleteAccount(accountId) {
    // 获取账号信息用于提示
    const result = await chrome.storage.local.get('accounts');
    const accounts = result.accounts || [];
    const account = accounts.find(a => a.id === accountId);
    const accountName = account ? (account.username || '未命名') : '账号';
    
    if (!confirm(`确定要删除账号"${accountName}"吗？`)) {
      return;
    }
    
    try {
      const filtered = accounts.filter(a => a.id !== accountId);
      await chrome.storage.local.set({ accounts: filtered });
      await this.loadAccounts(this.currentEnvId);
      
      // 显示成功提示
      showSuccessMessage('账号删除成功');
    } catch (error) {
      console.error('删除账号失败:', error);
      alert('删除失败: ' + error.message);
    }
  }
  
  // 导出数据为JSON文件
  async exportData() {
    try {
      const result = await chrome.storage.local.get(['environments', 'accounts']);
      const environments = result.environments || [];
      const accounts = result.accounts || [];
      
      // 构建导出数据
      const exportData = {
        version: '1.0.0',
        exportTime: new Date().toISOString(),
        environments: environments,
        accounts: accounts
      };
      
      // 转换为JSON字符串（格式化）
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // 创建Blob并下载
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `account-manager-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showSuccessMessage('配置导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败: ' + error.message);
    }
  }
  
  // 导入数据
  async importData(file) {
    try {
      // 读取文件内容
      const text = await this.readFileAsText(file);
      
      // 解析JSON
      let importData;
      try {
        importData = JSON.parse(text);
      } catch (error) {
        alert('JSON格式错误，请检查文件格式');
        return;
      }
      
      // 验证数据格式
      const validationResult = this.validateImportData(importData);
      if (!validationResult.valid) {
        alert('数据格式验证失败：' + validationResult.error);
        return;
      }
      
      // 确认导入
      const envCount = importData.environments?.length || 0;
      const accountCount = importData.accounts?.length || 0;
      const confirmMsg = `即将导入 ${envCount} 个环境和 ${accountCount} 个账号。\n\n` +
                        `注意：导入会合并现有数据，相同ID的项目会被覆盖。\n\n` +
                        `确定要继续吗？`;
      
      if (!confirm(confirmMsg)) {
        return;
      }
      
      // 合并数据
      await this.mergeImportData(importData);
      
      // 重新加载界面
      await this.loadEnvironments();
      if (this.currentEnvId) {
        await this.loadAccounts(this.currentEnvId);
      }
      
      showSuccessMessage(`导入成功：${envCount} 个环境，${accountCount} 个账号`);
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败: ' + error.message);
    }
  }
  
  // 读取文件为文本
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }
  
  // 验证导入数据格式
  validateImportData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: '数据格式无效' };
    }
    
    // 验证环境数据
    if (data.environments) {
      if (!Array.isArray(data.environments)) {
        return { valid: false, error: 'environments 必须是数组' };
      }
      
      for (let i = 0; i < data.environments.length; i++) {
        const env = data.environments[i];
        if (!env.name || !env.loginUrl) {
          return { valid: false, error: `环境 ${i + 1} 缺少必需字段（name, loginUrl）` };
        }
      }
    }
    
    // 验证账号数据
    if (data.accounts) {
      if (!Array.isArray(data.accounts)) {
        return { valid: false, error: 'accounts 必须是数组' };
      }
      
      for (let i = 0; i < data.accounts.length; i++) {
        const account = data.accounts[i];
        if (!account.username || !account.account || !account.password || !account.envId) {
          return { valid: false, error: `账号 ${i + 1} 缺少必需字段（username, account, password, envId）` };
        }
      }
    }
    
    return { valid: true };
  }
  
  // 合并导入数据
  async mergeImportData(importData) {
    try {
      // 获取现有数据
      const result = await chrome.storage.local.get(['environments', 'accounts']);
      const existingEnvironments = result.environments || [];
      const existingAccounts = result.accounts || [];
      
      // 合并环境数据
      let mergedEnvironments = [...existingEnvironments];
      if (importData.environments && importData.environments.length > 0) {
        importData.environments.forEach(importEnv => {
          const existingIndex = mergedEnvironments.findIndex(e => e.id === importEnv.id);
          if (existingIndex !== -1) {
            // 更新现有环境
            mergedEnvironments[existingIndex] = {
              ...importEnv,
              updatedAt: Date.now()
            };
          } else {
            // 添加新环境（如果没有ID，生成新ID）
            const newEnv = {
              ...importEnv,
              id: importEnv.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
              createdAt: importEnv.createdAt || Date.now(),
              updatedAt: Date.now()
            };
            mergedEnvironments.push(newEnv);
          }
        });
      }
      
      // 合并账号数据
      let mergedAccounts = [...existingAccounts];
      if (importData.accounts && importData.accounts.length > 0) {
        importData.accounts.forEach(importAccount => {
          const existingIndex = mergedAccounts.findIndex(a => a.id === importAccount.id);
          if (existingIndex !== -1) {
            // 更新现有账号
            mergedAccounts[existingIndex] = {
              ...importAccount,
              updatedAt: Date.now()
            };
          } else {
            // 添加新账号（如果没有ID，生成新ID）
            const newAccount = {
              ...importAccount,
              id: importAccount.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
              createdAt: importAccount.createdAt || Date.now(),
              updatedAt: Date.now()
            };
            mergedAccounts.push(newAccount);
          }
        });
      }
      
      // 保存合并后的数据
      await chrome.storage.local.set({
        environments: mergedEnvironments,
        accounts: mergedAccounts
      });
    } catch (error) {
      console.error('合并数据失败:', error);
      throw error;
    }
  }
}

// 初始化
let accountManager = null;

document.addEventListener('DOMContentLoaded', () => {
  accountManager = new AccountManager();
});
