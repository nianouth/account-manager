/**
 * 账号管理器 - 弹出窗口脚本
 * 符合 Chrome Extension Manifest V3 规范
 * v2.0: 使用 ES6 modules
 */

// ES6 模块导入
// cryptoUtils 通过 <script src="crypto-utils.js"> 全局加载（兼容 content_scripts）
const { cryptoUtils } = window;
import { securityManager } from './security-manager.js';
import {
  safeSetTextContent,
  createElement
} from './utils/dom-utils.js';
import {
  showSuccessMessage,
  showErrorMessage,
  showInfoMessage
} from './utils/toast.js';
import {
  validateEnvironment,
  validateAccount,
  checkPasswordStrength
} from './utils/validation.js';

// 表单验证专用工具函数
const showError = (elementId, message) => {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
  }
};

const hideError = (elementId) => {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.classList.remove('show');
  }
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

// 账号管理器类
class AccountManager {
  constructor() {
    this.currentEnvId = null;
    this.currentAccountId = null;
    this.currentEnvIdForEdit = null;
    this.searchTerm = '';
    this.envModal = new ModalManager('envModal');
    this.accountModal = new ModalManager('accountModal');
    this.currentTab = 'accounts';
    this.init();
  }

  async init() {
    // 先加载界面，不阻塞
    this.setupTabNavigation();
    this.setupEventListeners();

    // v2.0: 初始化安全配置（仅首次使用或迁移时弹窗）
    await this.initializeSecurity();

    // 加载数据（账号列表只显示用户名，不解密密码，无需主密码）
    this.loadEnvironments();
  }

  /**
   * Tab 导航切换
   */
  setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // 更新 Tab 按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // 更新 Tab 内容
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });

    // 切换到网站页面时刷新网站列表
    if (tabName === 'sites') {
      this.renderEnvironmentList();
    }
  }
  
  setupEventListeners() {
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K: 聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Ctrl/Cmd + N: 添加新账号
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.openAccountModal();
      }

      // Esc: 关闭模态框
      if (e.key === 'Escape') {
        if (this.envModal.isOpen) {
          this.envModal.close();
          this.resetEnvForm();
        }
        if (this.accountModal.isOpen) {
          this.accountModal.close();
          this.resetAccountForm();
        }
      }
    });

    // 网站选择
    const envSelect = document.getElementById('envSelect');
    envSelect?.addEventListener('change', (e) => {
      this.switchEnvironment(e.target.value);
    });
    
    // 添加网站按钮
    const addEnvBtn = document.getElementById('addEnvBtn');
    addEnvBtn?.addEventListener('click', () => {
      this.openEnvModal();
    });
    
    // 设置页面 - 修改主密码
    document.getElementById('changeMasterPasswordBtn')?.addEventListener('click', () => {
      this.promptMasterPasswordVerification();
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
    
    // 网站表单
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

      // 密码强度检测
      passwordInput.addEventListener('input', (e) => {
        this.checkPasswordStrength(e.target.value);
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
        option.textContent = env.name || '未命名网站';
        envSelect.appendChild(option);
      });

      // 如果当前在网站 Tab，刷新网站列表
      if (this.currentTab === 'sites') {
        this.renderEnvironmentList();
      }
    } catch (error) {
      console.error('加载网站失败:', error);
    }
  }
  
  /**
   * 渲染"网站"Tab 中的网站列表
   */
  renderEnvironmentList() {
    const envList = document.getElementById('envList');
    if (!envList) return;

    chrome.storage.local.get('environments', (result) => {
      const environments = result.environments || [];
      envList.innerHTML = '';

      if (environments.length === 0) {
        envList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🌐</div>
            <div>还没有添加网站</div>
          </div>`;
        return;
      }

      environments.forEach(env => {
        const item = document.createElement('div');
        item.className = `env-item${env.id === this.currentEnvId ? ' active' : ''}`;

        const info = createElement('div', { className: 'env-info' });
        const nameEl = createElement('div', { className: 'env-name' });
        safeSetTextContent(nameEl, env.name);
        const domainEl = createElement('div', { className: 'env-domain' });
        safeSetTextContent(domainEl, env.loginUrl || '');
        info.appendChild(nameEl);
        info.appendChild(domainEl);

        const actions = document.createElement('div');
        actions.className = 'env-actions';
        actions.innerHTML = `
          <button class="btn-edit" title="编辑">✏️</button>
          <button class="btn-delete" title="删除">🗑️</button>`;

        item.appendChild(info);
        item.appendChild(actions);

        // 点击选择网站并切换到账号 Tab
        item.addEventListener('click', (e) => {
          if (e.target.closest('.env-actions')) return;
          this.switchEnvironment(env.id);
          this.switchTab('accounts');
          // 更新下拉框
          const envSelect = document.getElementById('envSelect');
          if (envSelect) envSelect.value = env.id;
        });

        // 编辑按钮
        item.querySelector('.btn-edit').addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEnvModal(env.id);
        });

        // 删除按钮
        item.querySelector('.btn-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleDeleteEnv(env.id);
        });

        envList.appendChild(item);
      });
    });
  }
  
  switchEnvironment(envId) {
    this.currentEnvId = envId;
    this.loadAccounts(envId);
    // 更新网站列表中的活动状态
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
          <div class="empty-state-icon">🌐</div>
          <h3 class="empty-state-title">未选择网站</h3>
          <p class="empty-state-description">请在上方选择一个网站，或者创建一个新的网站</p>
          <div class="empty-state-action">
            <button onclick="document.getElementById('addEnvBtn').click()">➕ 创建网站</button>
          </div>
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

      // 排序：收藏的账号在前
      envAccounts.sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return 0;
      });

      if (envAccounts.length === 0) {
        if (this.searchTerm) {
          accountList.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <h3 class="empty-state-title">未找到账号</h3>
              <p class="empty-state-description">没有找到匹配"${this.searchTerm}"的账号</p>
            </div>
          `;
        } else {
          accountList.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">📝</div>
              <h3 class="empty-state-title">还没有账号</h3>
              <p class="empty-state-description">点击下方按钮添加您的第一个账号</p>
              <div class="empty-state-action">
                <button onclick="document.getElementById('addAccountBtn').click()">➕ 添加账号</button>
              </div>
            </div>
          `;
        }
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

    // 收藏按钮
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'btn-favorite';
    favoriteBtn.innerHTML = account.favorite ? '⭐' : '☆';
    favoriteBtn.title = account.favorite ? '取消收藏' : '收藏';
    if (account.favorite) {
      favoriteBtn.classList.add('active');
    }
    favoriteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFavorite(account.id);
    });

    const accountInfo = document.createElement('div');
    accountInfo.className = 'account-info';
    accountInfo.style.flex = '1';
    accountInfo.style.minWidth = '0';

    // 用户名行
    const usernameRow = document.createElement('div');
    usernameRow.style.display = 'flex';
    usernameRow.style.alignItems = 'center';
    usernameRow.style.marginBottom = '4px';

    const username = document.createElement('div');
    username.className = 'username';
    username.style.marginBottom = '0';
    safeSetTextContent(username, account.username || '未命名');
    usernameRow.appendChild(username);

    accountInfo.appendChild(usernameRow);

    // 账号行（带复制按钮）
    const accountRow = document.createElement('div');
    accountRow.className = 'account-info-row';

    const accountLabel = document.createElement('span');
    accountLabel.className = 'account-info-label';
    accountLabel.textContent = '账号:';

    const accountValue = document.createElement('span');
    accountValue.className = 'account-info-value';
    safeSetTextContent(accountValue, account.account || '');

    const copyAccountBtn = document.createElement('button');
    copyAccountBtn.className = 'btn-copy';
    copyAccountBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    copyAccountBtn.title = '复制账号';
    copyAccountBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyToClipboard(account.account || '', '账号已复制');
    });

    accountRow.appendChild(accountLabel);
    accountRow.appendChild(accountValue);
    accountRow.appendChild(copyAccountBtn);
    accountInfo.appendChild(accountRow);

    // 密码行（带复制按钮）
    const passwordRow = document.createElement('div');
    passwordRow.className = 'account-info-row';

    const passwordLabel = document.createElement('span');
    passwordLabel.className = 'account-info-label';
    passwordLabel.textContent = '密码:';

    const passwordValue = document.createElement('span');
    passwordValue.className = 'account-info-value';
    passwordValue.textContent = '••••••••';

    const copyPasswordBtn = document.createElement('button');
    copyPasswordBtn.className = 'btn-copy';
    copyPasswordBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    copyPasswordBtn.title = '复制密码';
    copyPasswordBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // 解密密码
      let decryptedPassword = account.password;
      if (cryptoUtils && account.password) {
        try {
          // 确保会话密钥存在
          const sessionKey = await this.ensureSessionKey();
          if (!sessionKey) {
            showErrorMessage('无法获取会话密钥');
            return;
          }
          decryptedPassword = await cryptoUtils.decryptPassword(account.password, sessionKey);
        } catch (error) {
          console.error('密码解密失败:', error);
          showErrorMessage('密码解密失败：' + error.message);
          return;
        }
      }
      this.copyToClipboard(decryptedPassword || '', '密码已复制');
    });

    passwordRow.appendChild(passwordLabel);
    passwordRow.appendChild(passwordValue);
    passwordRow.appendChild(copyPasswordBtn);
    accountInfo.appendChild(passwordRow);

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

    item.appendChild(favoriteBtn);
    item.appendChild(accountInfo);
    item.appendChild(accountActions);

    return item;
  }

  // 复制到剪贴板
  copyToClipboard(text, message = '已复制') {
    navigator.clipboard.writeText(text).then(() => {
      showSuccessMessage(message, 1500);
    }).catch(err => {
      console.error('复制失败:', err);
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showSuccessMessage(message, 1500);
      } catch (err) {
        alert('复制失败，请手动复制');
      }
      document.body.removeChild(textarea);
    });
  }

  // 切换收藏状态
  async toggleFavorite(accountId) {
    try {
      const result = await chrome.storage.local.get('accounts');
      const accounts = result.accounts || [];
      const accountIndex = accounts.findIndex(a => a.id === accountId);

      if (accountIndex !== -1) {
        accounts[accountIndex].favorite = !accounts[accountIndex].favorite;
        await chrome.storage.local.set({ accounts });
        await this.loadAccounts(this.currentEnvId);
        showSuccessMessage(accounts[accountIndex].favorite ? '已收藏' : '已取消收藏', 1500);
      }
    } catch (error) {
      console.error('切换收藏失败:', error);
    }
  }

  // 检测密码强度
  checkPasswordStrength(password) {
    const strengthIndicator = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('passwordStrengthText');
    const strengthBars = document.querySelectorAll('.strength-bar');

    if (!password || password.length === 0) {
      if (strengthIndicator) strengthIndicator.style.display = 'none';
      return;
    }

    if (strengthIndicator) strengthIndicator.style.display = 'block';

    let strength = 0;
    let strengthLabel = '';
    let strengthColor = '';

    // 长度检查
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;

    // 字符类型检查
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++; // 大小写
    if (/[0-9]/.test(password)) strength++; // 数字
    if (/[^a-zA-Z0-9]/.test(password)) strength++; // 特殊字符

    // 计算最终强度等级（1-4）
    let level = Math.min(4, Math.ceil(strength / 1.5));

    // 设置标签和颜色
    switch (level) {
      case 1:
        strengthLabel = '弱';
        strengthColor = 'var(--danger-color)';
        break;
      case 2:
        strengthLabel = '中等';
        strengthColor = 'var(--warning-color)';
        break;
      case 3:
        strengthLabel = '强';
        strengthColor = 'var(--info-color)';
        break;
      case 4:
        strengthLabel = '非常强';
        strengthColor = 'var(--success-color)';
        break;
    }

    // 更新强度条
    strengthBars.forEach((bar, index) => {
      if (index < level) {
        bar.classList.add('active');
      } else {
        bar.classList.remove('active');
      }
    });

    // 更新文本
    if (strengthText) {
      strengthText.textContent = `密码强度：${strengthLabel}`;
      strengthText.style.color = strengthColor;
    }
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
      if (cryptoUtils && account.password) {
        try {
          // 确保会话密钥存在
          const sessionKey = await this.ensureSessionKey();
          if (!sessionKey) {
            showErrorMessage('无法获取会话密钥');
            return;
          }
          decryptedPassword = await cryptoUtils.decryptPassword(account.password, sessionKey);
        } catch (error) {
          console.error('密码解密失败:', error);
          showErrorMessage('密码解密失败：' + error.message);
          return;
        }
      }

      // 创建账号副本，使用解密后的密码
      const accountWithDecryptedPassword = {
        ...account,
        password: decryptedPassword
      };
      
      // 获取当前网站的登录按钮配置
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
      title.textContent = envId ? '编辑网站' : '添加网站';
    }
    
    this.currentEnvIdForEdit = envId;
    
    if (envId) {
      // 编辑模式：加载网站数据
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
      const confirmMsg = `该网站下有 ${relatedAccounts.length} 个账号，删除网站将同时删除这些账号。确定要删除吗？`;
      if (!confirm(confirmMsg)) {
        return;
      }
      
      // 删除关联的账号
      const filteredAccounts = accounts.filter(acc => acc.envId !== envId);
      await chrome.storage.local.set({ accounts: filteredAccounts });
    } else {
      if (!confirm('确定要删除这个网站吗？')) {
        return;
      }
    }
    
    try {
      const envResult = await chrome.storage.local.get('environments');
      const environments = envResult.environments || [];
      const filtered = environments.filter(e => e.id !== envId);
      await chrome.storage.local.set({ environments: filtered });
      
      // 如果删除的是当前选中的网站，清空选择
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
      console.error('删除网站失败:', error);
      alert('删除失败: ' + error.message);
    }
  }
  
  openAccountModal(accountId = null) {
    if (!this.currentEnvId) {
      alert('请先选择网站');
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
      (async () => {
        const result = await chrome.storage.local.get('accounts');
        const accounts = result.accounts || [];
        const account = accounts.find(a => a.id === accountId);
        if (account) {
          document.getElementById('accountUsername').value = account.username || '';
          document.getElementById('accountAccount').value = account.account || '';

          // 解密密码用于编辑（如果已加密）
          let decryptedPassword = account.password;
          if (cryptoUtils && account.password) {
            try {
              // 确保会话密钥存在
              const sessionKey = await this.ensureSessionKey();
              if (!sessionKey) {
                showErrorMessage('无法获取会话密钥');
                this.accountModal.close();
                return;
              }
              decryptedPassword = await cryptoUtils.decryptPassword(account.password, sessionKey);
            } catch (error) {
              console.error('密码解密失败:', error);
              showErrorMessage('密码解密失败：' + error.message);
              this.accountModal.close();
              return;
            }
          }

          document.getElementById('accountPassword').value = decryptedPassword || '';
          document.getElementById('accountNote').value = account.note || '';
          this.currentAccountId = accountId;
        }
      })();
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
      showError('envNameError', '网站名称不能为空');
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
          
          // 如果编辑的是当前选中的网站，更新选择器
          if (this.currentEnvId === this.currentEnvIdForEdit) {
            const envSelect = document.getElementById('envSelect');
            if (envSelect) {
              envSelect.value = this.currentEnvIdForEdit;
            }
          }
          
          this.envModal.close();
          this.resetEnvForm();
          
          // 显示成功提示
          showSuccessMessage('网站更新成功');
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
        
        // 先设置当前网站ID，这样渲染时能正确显示活动状态
        this.currentEnvId = newEnv.id;
        
        // 更新网站选择器
        const envSelect = document.getElementById('envSelect');
        if (envSelect) {
          envSelect.value = newEnv.id;
        }
        
        // 重新加载网站列表（此时currentEnvId已设置，会正确显示活动状态）
        await this.loadEnvironments();
        
        // 加载该网站的账号列表
        await this.loadAccounts(newEnv.id);
        
        this.envModal.close();
        this.resetEnvForm();
        
        // 显示成功提示
          showSuccessMessage('网站添加成功');
      }
    } catch (error) {
      console.error('保存网站失败:', error);
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
    
    // 再次检查网站ID（防止在添加过程中网站被删除）
    if (!this.currentEnvId) {
      alert('网站已不存在，请重新选择网站');
      this.accountModal.close();
      return;
    }
    
    try {
      // 获取会话密钥（如过期则自动提示验证）
      const sessionKey = await this.ensureSessionKey();
      if (!sessionKey) {
        showErrorMessage('未能获取会话密钥，请重试');
        return;
      }

      // 加密密码（不再降级为明文，加密失败将抛出异常）
      let encryptedPassword;
      try {
        encryptedPassword = await cryptoUtils.encryptPassword(password, sessionKey);
      } catch (error) {
        console.error('密码加密失败:', error);
        showErrorMessage('密码加密失败：' + error.message);
        return; // 不保存账号
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
        // 再次确认网站ID有效
        if (!this.currentEnvId) {
          alert('网站ID无效，请重新选择网站');
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
      // 显示安全警告
      const confirmed = confirm(
        '⚠️ 导出数据安全提示\n\n' +
        '导出的文件包含加密的账号密码数据。请注意：\n\n' +
        '1. 请妥善保管此文件，不要分享给他人\n' +
        '2. 不要通过不安全的渠道传输（如邮件、即时消息）\n' +
        '3. 建议将文件存储在加密的位置（如加密磁盘）\n' +
        '4. 使用后请及时删除\n\n' +
        '确定要导出吗？'
      );

      if (!confirmed) {
        return;
      }

      const result = await chrome.storage.local.get(['environments', 'accounts']);
      const environments = result.environments || [];
      const accounts = result.accounts || [];

      // 验证所有密码是否已加密
      for (const account of accounts) {
        if (!cryptoUtils.isBase64(account.password)) {
          showErrorMessage(
            `账号 "${account.username}" 的密码未加密，无法导出。` +
            '请先设置主密码并重新保存所有账号。'
          );
          return;
        }
      }

      // 构建导出数据
      const exportData = {
        version: '2.0',
        exportTime: new Date().toISOString(),
        securityNotice: '此文件包含加密数据，请妥善保管',
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
      showErrorMessage('导出失败: ' + error.message);
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
      const confirmMsg = `即将导入 ${envCount} 个网站和 ${accountCount} 个账号。\n\n` +
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
      
      showSuccessMessage(`导入成功：${envCount} 个网站，${accountCount} 个账号`);
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
    
    // 验证网站数据
    if (data.environments) {
      if (!Array.isArray(data.environments)) {
        return { valid: false, error: 'environments 必须是数组' };
      }
      
      for (let i = 0; i < data.environments.length; i++) {
        const env = data.environments[i];
        if (!env.name || !env.loginUrl) {
          return { valid: false, error: `网站 ${i + 1} 缺少必需字段（name, loginUrl）` };
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
      
      // 合并网站数据
      let mergedEnvironments = [...existingEnvironments];
      if (importData.environments && importData.environments.length > 0) {
        importData.environments.forEach(importEnv => {
          const existingIndex = mergedEnvironments.findIndex(e => e.id === importEnv.id);
          if (existingIndex !== -1) {
            // 更新现有网站
            mergedEnvironments[existingIndex] = {
              ...importEnv,
              updatedAt: Date.now()
            };
          } else {
            // 添加新网站（如果没有ID，生成新ID）
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

  // ========== 安全功能（v2.0新增） ==========

  /**
   * 初始化安全配置
   * 在 init() 中调用，确保用户已设置主密码
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initializeSecurity() {
    try {
      // 1. 检查是否需要从旧版本迁移
      const needsMigration = await securityManager.needsMigration();
      if (needsMigration) {
        await this.promptDataMigration();
        return true;
      }

      // 2. 检查是否已设置主密码（首次使用必须设置）
      const hasSecurityConfig = await securityManager.hasSecurityConfig();
      if (!hasSecurityConfig) {
        await this.promptMasterPasswordSetup();
        return true;
      }

      // 3. 不再强制验证主密码，延迟到实际需要解密/加密时再验证
      // 通过 ensureSessionKey() 按需触发
      return true;
    } catch (error) {
      console.error('安全初始化失败:', error);
      showErrorMessage('安全初始化失败：' + error.message);
      return false;
    }
  }

  /**
   * 首次设置主密码（模态框，不可关闭）
   */
  async promptMasterPasswordSetup() {
    const password = prompt(
      '🔒 欢迎使用账号管理器 v2.0\n\n' +
      '为了保护您的账号安全，请设置主密码。\n\n' +
      '主密码要求：\n' +
      '• 至少 8 位字符\n' +
      '• 包含大写字母、小写字母和数字\n\n' +
      '请输入主密码：'
    );

    if (!password) {
      alert('必须设置主密码才能使用扩展');
      await this.promptMasterPasswordSetup(); // 递归，直到设置成功
      return;
    }

    // 验证密码强度
    const validation = securityManager.validatePasswordStrength(password);
    if (!validation.valid) {
      alert('密码强度不符合要求：\n' + validation.message);
      await this.promptMasterPasswordSetup();
      return;
    }

    // 二次确认
    const confirmPassword = prompt('请再次输入主密码以确认：');
    if (password !== confirmPassword) {
      alert('两次输入的密码不一致，请重新设置');
      await this.promptMasterPasswordSetup();
      return;
    }

    // 初始化主密码
    const result = await securityManager.initializeMasterPassword(password);
    if (result.success) {
      showSuccessMessage('主密码设置成功！');
    } else {
      alert('设置失败：' + result.message);
      await this.promptMasterPasswordSetup();
    }
  }

  /**
   * 验证主密码（会话过期时）
   */
  async promptMasterPasswordVerification() {
    const password = prompt(
      '🔐 会话已过期\n\n' +
      '请输入主密码以继续：'
    );

    if (!password) {
      alert('必须验证主密码才能继续使用');
      await this.promptMasterPasswordVerification();
      return;
    }

    // 先用默认模式验证密码是否正确
    const result = await securityManager.verifyMasterPassword(password, 'default');
    if (result.success) {
      // 密码正确，询问会话保持方式
      const rememberChoice = confirm(
        '✅ 验证成功！\n\n' +
        '是否「今日不再提示」？\n\n' +
        '• 点击「确定」→ 今天内不再要求输入主密码\n' +
        '• 点击「取消」→ 30 分钟后再次验证'
      );

      if (rememberChoice) {
        // 用户选择"今日不再提示"，重新设置会话为 today 模式
        await securityManager.verifyMasterPassword(password, 'today');
        showSuccessMessage('已设置今日免验证');
      } else {
        showSuccessMessage('验证成功');
      }
    } else {
      alert('主密码错误：' + result.message);
      await this.promptMasterPasswordVerification();
    }
  }

  /**
   * 确保会话密钥存在（如果不存在则提示验证主密码）
   * @returns {Promise<string|null>} 会话密钥
   */
  async ensureSessionKey() {
    let sessionKey = await securityManager.getSessionKey();

    if (!sessionKey) {
      // 会话过期，要求验证主密码
      await this.promptMasterPasswordVerification();

      // 重新获取会话密钥
      sessionKey = await securityManager.getSessionKey();
    }

    return sessionKey;
  }

  /**
   * 数据迁移向导（从旧版本）
   */
  async promptDataMigration() {
    const confirmed = confirm(
      '🔄 检测到旧版本数据\n\n' +
      '您的数据需要迁移到新的安全系统。\n' +
      '迁移过程：\n' +
      '1. 输入旧主密码\n' +
      '2. 设置新主密码\n' +
      '3. 自动重新加密所有密码\n\n' +
      '注意：旧数据已自动备份\n\n' +
      '现在开始迁移吗？'
    );

    if (!confirmed) {
      alert('必须完成数据迁移才能使用新版本');
      await this.promptDataMigration();
      return;
    }

    // 1. 输入旧主密码
    const oldPassword = prompt('请输入旧主密码：');
    if (!oldPassword) {
      await this.promptDataMigration();
      return;
    }

    // 2. 设置新主密码
    const newPassword = prompt(
      '请设置新主密码：\n\n' +
      '要求：至少 8 位，包含大小写字母和数字'
    );
    if (!newPassword) {
      await this.promptDataMigration();
      return;
    }

    const validation = securityManager.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      alert('密码强度不符合要求：\n' + validation.message);
      await this.promptDataMigration();
      return;
    }

    const confirmPassword = prompt('请再次输入新主密码：');
    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致');
      await this.promptDataMigration();
      return;
    }

    // 3. 执行迁移
    showInfoMessage('正在迁移数据，请稍候...');
    const result = await securityManager.migrateFromOldVersion(oldPassword, newPassword);

    if (result.success) {
      showSuccessMessage('数据迁移成功！');
      // 重新加载数据
      await this.loadEnvironments();
    } else {
      alert('迁移失败：' + result.message);
      await this.promptDataMigration();
    }
  }
}

// 初始化
let accountManager = null;

document.addEventListener('DOMContentLoaded', () => {
  accountManager = new AccountManager();
});
