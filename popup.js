/**
 * 账号管理器 - 弹出窗口脚本
 * 符合 Chrome Extension Manifest V3 规范
 * v2.0: 使用 ES6 modules
 */

// ES6 模块导入
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
  validateAccount
} from './utils/validation.js';
import {
  showAlert,
  showConfirm,
  showPrompt
} from './utils/dialog.js';

// SVG 图标常量
const SVG_ICONS = {
  globe: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
  search: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
  notepad: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
  warning: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
  starFilled: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
  starEmpty: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
};

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
    this.searchDebounceTimer = null;
    this.envModal = new ModalManager('envModal');
    this.accountModal = new ModalManager('accountModal');
    this.groupModal = new ModalManager('groupModal');
    this.groupAccountModal = new ModalManager('groupAccountModal');
    this.currentGroupId = null;
    this.currentGroupIdForEdit = null;
    this.currentGroupAccountId = null;
    this.currentTab = 'accounts';
    this.init();
  }

  async init() {
    // 先加载界面，不阻塞
    this.setupTabNavigation();
    this.setupEventListeners();

    // 加载数据
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
    if (tabName === 'templates') {
      this.renderGroupList();
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
        if (this.groupAccountModal.isOpen) {
          this.groupAccountModal.close();
          this.resetGroupAccountForm();
        } else if (this.groupModal.isOpen) {
          this.groupModal.close();
          this.resetGroupForm();
        } else if (this.envModal.isOpen) {
          this.envModal.close();
          this.resetEnvForm();
        } else if (this.accountModal.isOpen) {
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
    
    // 添加账号按钮
    const addAccountBtn = document.getElementById('addAccountBtn');
    addAccountBtn?.addEventListener('click', () => {
      this.openAccountModal();
    });
    
    // 搜索框
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    searchInput?.addEventListener('input', (e) => {
      if (searchClear) {
        searchClear.classList.toggle('visible', e.target.value.length > 0);
      }
      // 搜索防抖：300ms
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchTerm = e.target.value.toLowerCase();
        this.loadAccounts(this.currentEnvId);
      }, 300);
    });
    searchClear?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        this.searchTerm = '';
        this.loadAccounts(this.currentEnvId);
        searchClear.classList.remove('visible');
        searchInput.focus();
      }
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
    
    // 高级设置折叠切换
    document.getElementById('advancedToggle')?.addEventListener('click', () => {
      const toggle = document.getElementById('advancedToggle');
      const content = document.getElementById('advancedContent');
      toggle.classList.toggle('expanded');
      content.classList.toggle('expanded');
    });

    // 取消按钮 & 关闭按钮
    document.getElementById('envCancelBtn')?.addEventListener('click', () => {
      this.envModal.close();
      this.resetEnvForm();
    });
    document.getElementById('envModalClose')?.addEventListener('click', () => {
      this.envModal.close();
      this.resetEnvForm();
    });

    document.getElementById('accountCancelBtn')?.addEventListener('click', () => {
      this.accountModal.close();
      this.resetAccountForm();
    });
    document.getElementById('accountModalClose')?.addEventListener('click', () => {
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
      this.exportData('json');
    });
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    exportCsvBtn?.addEventListener('click', () => {
      this.exportData('csv');
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

    // 下载导入模板
    document.getElementById('downloadTemplateBtn')?.addEventListener('click', () => {
      this.downloadImportTemplate();
    });

    // ===== 账号模板相关 =====
    document.getElementById('addGroupBtn')?.addEventListener('click', () => {
      this.openGroupModal();
    });

    // 模板表单
    document.getElementById('groupForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleGroupSubmit();
    });
    document.getElementById('groupCancelBtn')?.addEventListener('click', () => {
      this.groupModal.close();
      this.resetGroupForm();
    });
    document.getElementById('groupModalClose')?.addEventListener('click', () => {
      this.groupModal.close();
      this.resetGroupForm();
    });
    this.groupModal.modal?.addEventListener('click', (e) => {
      if (e.target === this.groupModal.modal) {
        this.groupModal.close();
        this.resetGroupForm();
      }
    });

    // 模板账号表单
    document.getElementById('groupAccountForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleGroupAccountSubmit();
    });
    document.getElementById('groupAccountCancelBtn')?.addEventListener('click', () => {
      this.groupAccountModal.close();
      this.resetGroupAccountForm();
    });
    document.getElementById('groupAccountModalClose')?.addEventListener('click', () => {
      this.groupAccountModal.close();
      this.resetGroupAccountForm();
    });
    this.groupAccountModal.modal?.addEventListener('click', (e) => {
      if (e.target === this.groupAccountModal.modal) {
        this.groupAccountModal.close();
        this.resetGroupAccountForm();
      }
    });

    // 模板账号密码显示/隐藏
    const groupPasswordToggle = document.getElementById('groupAccountPasswordToggle');
    const groupPasswordInput = document.getElementById('groupAccountPassword');
    if (groupPasswordToggle && groupPasswordInput) {
      groupPasswordToggle.addEventListener('click', () => {
        const isPassword = groupPasswordInput.type === 'password';
        groupPasswordInput.type = isPassword ? 'text' : 'password';
        groupPasswordToggle.classList.toggle('show-password', isPassword);
      });
    }
  }
  
  async loadEnvironments() {
    try {
      const result = await chrome.storage.local.get(['environments', 'accounts', 'accountGroups']);
      const environments = result.environments || [];
      const accounts = result.accounts || [];
      const accountGroups = result.accountGroups || [];
      this.updateHeaderStats(environments.length, accounts.length, accountGroups.length);
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

      // 尝试匹配当前标签页 URL 自动选中网站
      const matched = await this.matchCurrentTabEnv(environments);
      if (matched) {
        envSelect.value = matched.id;
        this.switchEnvironment(matched.id);
      } else if (environments.length === 1 && !this.currentEnvId) {
        // 单网站自动选中（兜底）
        envSelect.value = environments[0].id;
        this.switchEnvironment(environments[0].id);
      }

      // 如果当前在网站 Tab，刷新网站列表
      if (this.currentTab === 'sites') {
        this.renderEnvironmentList();
      }
    } catch (error) {
      console.error('加载网站失败:', error);
    }
  }
  
  /**
   * 匹配当前标签页 URL 与网站列表，返回匹配的网站或 null
   */
  async matchCurrentTabEnv(environments) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.url.startsWith('http')) return null;

      const normalize = (urlStr) => {
        try {
          const u = new URL(urlStr);
          return (u.protocol + '//' + u.host + u.pathname).replace(/\/$/, '');
        } catch { return urlStr; }
      };

      const currentUrl = normalize(tab.url);

      for (const env of environments) {
        if (!env.loginUrl) continue;
        const envUrl = normalize(env.loginUrl);
        if (currentUrl === envUrl) return env;
        if (envUrl.endsWith('/*') && currentUrl.startsWith(envUrl.slice(0, -2))) return env;
      }
    } catch (error) {
      console.debug('匹配当前标签页URL失败:', error);
    }
    return null;
  }

  /**
   * 渲染"网站"Tab 中的网站列表
   */
  renderEnvironmentList() {
    const envList = document.getElementById('envList');
    if (!envList) return;

    chrome.storage.local.get(['environments', 'accounts', 'accountGroups'], (result) => {
      const environments = result.environments || [];
      const accounts = result.accounts || [];
      const accountGroups = result.accountGroups || [];
      envList.innerHTML = '';

      if (environments.length === 0) {
        envList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">${SVG_ICONS.globe}</div>
            <div class="empty-state-text">还没有添加网站</div>
            <div class="empty-state-hint">点击下方按钮添加第一个网站</div>
            <button class="empty-state-cta" id="emptyAddEnvBtn">
              ${SVG_ICONS.plus} 添加网站
            </button>
          </div>`;
        document.getElementById('emptyAddEnvBtn')?.addEventListener('click', () => {
          this.openEnvModal();
        });
        return;
      }

      // 更新标题栏统计
      this.updateHeaderStats(environments.length, accounts.length, accountGroups.length);

      environments.forEach(env => {
        const item = document.createElement('div');
        item.className = `env-item${env.id === this.currentEnvId ? ' active' : ''}`;
        item.dataset.envId = env.id;

        // 头像
        const avatar = document.createElement('div');
        avatar.className = 'env-avatar';
        avatar.textContent = (env.name || '?').charAt(0).toUpperCase();
        item.appendChild(avatar);

        const info = createElement('div', { className: 'env-info' });
        const nameEl = createElement('div', { className: 'env-name' });
        safeSetTextContent(nameEl, env.name);
        const domainEl = createElement('div', { className: 'env-domain' });
        safeSetTextContent(domainEl, env.loginUrl || '');
        info.appendChild(nameEl);
        info.appendChild(domainEl);
        item.appendChild(info);

        // 关联模板标记
        if (env.linkedGroupId) {
          const linkedGroup = accountGroups.find(g => g.id === env.linkedGroupId);
          if (linkedGroup) {
            const sharedBadge = document.createElement('span');
            sharedBadge.className = 'shared-badge';
            sharedBadge.textContent = linkedGroup.name;
            sharedBadge.title = `关联模板：${linkedGroup.name}`;
            item.appendChild(sharedBadge);
          }
        }

        // 账号数量标记
        const envAccountCount = accounts.filter(a => a.envId === env.id).length;
        const groupAccountCount = env.linkedGroupId
          ? (accountGroups.find(g => g.id === env.linkedGroupId)?.accounts?.length || 0)
          : 0;
        const totalCount = envAccountCount + groupAccountCount;
        if (totalCount > 0) {
          const badge = document.createElement('span');
          badge.className = 'env-badge';
          badge.textContent = totalCount;
          item.appendChild(badge);
        }

        const actions = document.createElement('div');
        actions.className = 'env-actions';
        actions.innerHTML = `
          <button class="btn-edit" title="编辑"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
          <button class="btn-delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`;
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
          <div class="empty-state-icon">${SVG_ICONS.globe}</div>
          <div class="empty-state-text">请先选择网站</div>
          <div class="empty-state-hint">在上方下拉菜单中选择一个网站</div>
        </div>
      `;
      return;
    }
    
    try {
      const result = await chrome.storage.local.get(['accounts', 'environments', 'accountGroups']);
      const accounts = result.accounts || [];
      const environments = result.environments || [];
      const groups = result.accountGroups || [];

      let envAccounts = accounts.filter(account => account.envId === envId);

      // 加载关联的账号模板
      const currentEnv = environments.find(e => e.id === envId);
      if (currentEnv?.linkedGroupId) {
        const linkedGroup = groups.find(g => g.id === currentEnv.linkedGroupId);
        if (linkedGroup?.accounts?.length > 0) {
          const sharedAccounts = linkedGroup.accounts.map(acc => ({
            ...acc,
            _isShared: true,
            _groupName: linkedGroup.name
          }));
          envAccounts = [...envAccounts, ...sharedAccounts];
        }
      }

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
              <div class="empty-state-icon">${SVG_ICONS.search}</div>
              <div class="empty-state-text">未找到账号</div>
              <div class="empty-state-hint">没有匹配"${this.searchTerm}"的结果</div>
            </div>
          `;
        } else {
          accountList.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">${SVG_ICONS.notepad}</div>
              <div class="empty-state-text">还没有账号</div>
              <div class="empty-state-hint">点击下方按钮添加第一个账号</div>
              <button class="empty-state-cta" id="emptyAddAccountBtn">
                ${SVG_ICONS.plus} 添加账号
              </button>
            </div>
          `;
          document.getElementById('emptyAddAccountBtn')?.addEventListener('click', () => {
            this.openAccountModal();
          });
        }
        return;
      }
      
      accountList.innerHTML = '';
      envAccounts.forEach((account, index) => {
        const accountItem = this.createAccountItem(account, index);
        accountList.appendChild(accountItem);
      });
    } catch (error) {
      console.error('加载账号失败:', error);
      accountList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${SVG_ICONS.warning}</div>
          <div>加载失败，请重试</div>
        </div>
      `;
    }
  }
  
  createAccountItem(account, index = 0) {
    const item = document.createElement('div');
    item.className = 'account-item';
    item.style.setProperty('--i', index);

    // 上层：收藏 + 信息
    const top = document.createElement('div');
    top.className = 'account-item-top';

    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'btn-favorite';
    if (account._isShared) {
      favoriteBtn.innerHTML = SVG_ICONS.starEmpty;
      favoriteBtn.style.opacity = '0.3';
      favoriteBtn.style.pointerEvents = 'none';
    } else {
      favoriteBtn.innerHTML = account.favorite ? SVG_ICONS.starFilled : SVG_ICONS.starEmpty;
      favoriteBtn.title = account.favorite ? '取消收藏' : '收藏';
      favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(account.id);
      });
    }

    const accountInfo = document.createElement('div');
    accountInfo.className = 'account-info';

    const username = document.createElement('div');
    username.className = 'username';
    const usernameText = account.username || '未命名';
    safeSetTextContent(username, usernameText);
    username.title = usernameText;
    accountInfo.appendChild(username);

    const accountText = document.createElement('div');
    accountText.className = 'account-text';
    const accountTextValue = account.account || '';
    safeSetTextContent(accountText, accountTextValue);
    accountText.title = accountTextValue;
    accountInfo.appendChild(accountText);

    top.appendChild(favoriteBtn);
    top.appendChild(accountInfo);

    // 共享账号标记
    if (account._isShared) {
      const badge = document.createElement('span');
      badge.className = 'shared-badge';
      badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
      badge.appendChild(document.createTextNode(account._groupName || '模板'));
      badge.title = `来自模板「${account._groupName || ''}」`;
      top.appendChild(badge);
    }
    item.appendChild(top);

    // 下层：备注/复制 + 操作按钮
    const bottom = document.createElement('div');
    bottom.className = 'account-item-bottom';

    // 左侧：备注或复制按钮
    const bottomLeft = document.createElement('div');
    bottomLeft.style.cssText = 'display:flex;align-items:center;gap:4px;flex:1;min-width:0';

    if (account.note && account.note.trim()) {
      const accountNote = document.createElement('div');
      accountNote.className = 'account-note';
      const noteText = account.note.trim();
      safeSetTextContent(accountNote, noteText);
      accountNote.title = noteText;
      bottomLeft.appendChild(accountNote);
    } else {
      // 复制按钮组
      const copyAccountBtn = document.createElement('button');
      copyAccountBtn.className = 'btn-copy';
      copyAccountBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
      copyAccountBtn.title = '复制账号';
      copyAccountBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(account.account || '', '账号已复制');
      });

      const copyPasswordBtn = document.createElement('button');
      copyPasswordBtn.className = 'btn-copy';
      copyPasswordBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
      copyPasswordBtn.title = '复制密码';
      copyPasswordBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(account.password || '', '密码已复制');
      });

      bottomLeft.appendChild(copyAccountBtn);
      bottomLeft.appendChild(copyPasswordBtn);
    }

    // 右侧：操作按钮
    const accountActions = document.createElement('div');
    accountActions.className = 'account-actions';

    if (account._isShared) {
      // 共享账号：只显示提示，不显示编辑/删除
      const hintBtn = document.createElement('button');
      hintBtn.className = 'btn-edit';
      hintBtn.title = '请到「模板」页面编辑此账号';
      hintBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
      hintBtn.addEventListener('click', () => {
        showInfoMessage('请到「模板」页面编辑此账号');
      });
      accountActions.appendChild(hintBtn);
    } else {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-edit';
      editBtn.title = '编辑';
      editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      editBtn.addEventListener('click', () => this.openAccountModal(account.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.title = '删除';
      deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      deleteBtn.addEventListener('click', () => this.handleDeleteAccount(account.id));

      accountActions.appendChild(editBtn);
      accountActions.appendChild(deleteBtn);
    }

    bottom.appendChild(bottomLeft);
    bottom.appendChild(accountActions);
    item.appendChild(bottom);

    return item;
  }

  // 更新标题栏统计
  updateHeaderStats(envCount, accountCount, groupCount = 0) {
    const subtitle = document.getElementById('headerSubtitle');
    if (subtitle) {
      let text = `${envCount} 个网站 · ${accountCount} 个账号`;
      if (groupCount > 0) text += ` · ${groupCount} 个模板`;
      subtitle.textContent = text;
    }
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
        showErrorMessage('复制失败，请手动复制');
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

  async handleLogin(accountId) {
    try {
      const result = await chrome.storage.local.get('accounts');
      const accounts = result.accounts || [];
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        showErrorMessage('账号不存在');
        return;
      }
      
      // 创建账号副本
      const accountWithDecryptedPassword = { ...account };
      
      // 获取当前网站的登录按钮配置
      const envResult = await chrome.storage.local.get('environments');
      const environments = envResult.environments || [];
      const currentEnv = environments.find(e => e.id === account.envId);
      const loginButtonId = currentEnv?.loginButtonId || 'ch_login_btn';
      const loginButtonClass = currentEnv?.loginButtonClass || 'formBtn';
      
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showErrorMessage('无法获取当前标签页');
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
      showErrorMessage('登录失败: ' + error.message);
    }
  }
  
  // 这个函数会在页面上下文中执行
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
    
    // 填充密码
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

    // 加载账号模板选择器
    this.populateGroupSelector(envId);

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
          document.getElementById('envLinkedGroup').value = env.linkedGroupId || '';
          // 如果有自定义按钮配置，自动展开高级设置
          const hasCustomButton = (env.loginButtonId && env.loginButtonId !== 'ch_login_btn') ||
                                  (env.loginButtonClass && env.loginButtonClass !== 'formBtn');
          if (hasCustomButton) {
            document.getElementById('advancedToggle')?.classList.add('expanded');
            document.getElementById('advancedContent')?.classList.add('expanded');
          }
        }
      });
    } else {
      // 添加模式：清空表单，并自动读取当前页签信息
      this.resetEnvForm();
      // 重新加载模板选择器（resetEnvForm 会清空）
      this.populateGroupSelector(null);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab) {
          if (tab.title) {
            document.getElementById('envName').value = tab.title;
          }
          if (tab.url && tab.url.startsWith('http')) {
            document.getElementById('envLoginUrl').value = tab.url;
          }
        }
      });
    }

    this.envModal.open();
  }

  async populateGroupSelector(envId) {
    const select = document.getElementById('envLinkedGroup');
    if (!select) return;

    const result = await chrome.storage.local.get('accountGroups');
    const groups = result.accountGroups || [];

    // 清空并重建选项
    select.innerHTML = '<option value="">不使用模板</option>';
    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      const count = (group.accounts || []).length;
      option.textContent = `${group.name} (${count} 个账号)`;
      select.appendChild(option);
    });
  }
  
  async handleDeleteEnv(envId) {
    if (!envId) return;
    
    // 检查是否有关联的账号
    const result = await chrome.storage.local.get('accounts');
    const accounts = result.accounts || [];
    const relatedAccounts = accounts.filter(acc => acc.envId === envId);
    
    if (relatedAccounts.length > 0) {
      const confirmMsg = `该网站下有 ${relatedAccounts.length} 个账号，删除网站将同时删除这些账号。`;
      const confirmed = await showConfirm('删除网站', confirmMsg, { confirmText: '删除', dangerous: true });
      if (!confirmed) return;

      // 删除关联的账号
      const filteredAccounts = accounts.filter(acc => acc.envId !== envId);
      await chrome.storage.local.set({ accounts: filteredAccounts });
    } else {
      const confirmed = await showConfirm('删除网站', '确定要删除这个网站吗？', { confirmText: '删除', dangerous: true });
      if (!confirmed) return;
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
      showErrorMessage('删除失败: ' + error.message);
    }
  }

  openAccountModal(accountId = null) {
    if (!this.currentEnvId) {
      showErrorMessage('请先选择网站');
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

          document.getElementById('accountPassword').value = account.password || '';
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
    // 折叠高级设置
    document.getElementById('advancedToggle')?.classList.remove('expanded');
    document.getElementById('advancedContent')?.classList.remove('expanded');
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
    const linkedGroupId = document.getElementById('envLinkedGroup').value || '';
    
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
            linkedGroupId: linkedGroupId || undefined,
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
          linkedGroupId: linkedGroupId || undefined,
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
      showErrorMessage('保存失败: ' + error.message);
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
      showErrorMessage('网站已不存在，请重新选择网站');
      this.accountModal.close();
      return;
    }
    
    try {
      const result = await chrome.storage.local.get('accounts');
      const accounts = result.accounts || [];

      // 重复账号检测
      const duplicate = accounts.find(a =>
        a.envId === this.currentEnvId &&
        a.account === account &&
        a.id !== (this.currentAccountId || '')
      );
      if (duplicate) {
        showError('accountAccountError', `账号"${account}"已存在（用户名：${duplicate.username || '未命名'}）`);
        return;
      }

      if (this.currentAccountId) {
        // 编辑模式
        const index = accounts.findIndex(a => a.id === this.currentAccountId);
        if (index !== -1) {
          accounts[index] = {
            ...accounts[index],
            username: username,
            account: account,
            password: password,
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
          showErrorMessage('网站ID无效，请重新选择网站');
          this.accountModal.close();
          return;
        }
        
        const newAccount = {
          id: Date.now().toString(),
          envId: this.currentEnvId,
          username: username,
          account: account,
          password: password,
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
      showErrorMessage('保存失败: ' + error.message);
    }
  }
  
  async handleDeleteAccount(accountId) {
    // 获取账号信息用于提示
    const result = await chrome.storage.local.get('accounts');
    const accounts = result.accounts || [];
    const account = accounts.find(a => a.id === accountId);
    const accountName = account ? (account.username || '未命名') : '账号';
    
    const confirmed = await showConfirm('删除账号', `确定要删除账号"${accountName}"吗？`, { confirmText: '删除', dangerous: true });
    if (!confirmed) return;
    
    try {
      const filtered = accounts.filter(a => a.id !== accountId);
      await chrome.storage.local.set({ accounts: filtered });
      await this.loadAccounts(this.currentEnvId);
      
      // 显示成功提示
      showSuccessMessage('账号删除成功');
    } catch (error) {
      console.error('删除账号失败:', error);
      showErrorMessage('删除失败: ' + error.message);
    }
  }
  
  // 导出数据
  async exportData(format = 'json') {
    try {
      // 显示安全警告
      const confirmed = await showConfirm('导出数据', '导出的文件包含账号密码数据。请注意：\n\n1. 请妥善保管此文件，不要分享给他人\n2. 不要通过不安全的渠道传输\n3. 使用后请及时删除', { confirmText: '导出' });
      if (!confirmed) return;

      const result = await chrome.storage.local.get(['environments', 'accounts', 'accountGroups']);
      const environments = result.environments || [];
      const accounts = result.accounts || [];
      const accountGroups = result.accountGroups || [];

      const dateStr = new Date().toISOString().split('T')[0];

      if (format === 'csv') {
        // CSV 导出
        const envMap = {};
        environments.forEach(e => { envMap[e.id] = e.name || '未命名'; });

        const csvRows = [
          ['网站', '用户名', '账号', '密码', '备注', '收藏'].join(',')
        ];
        accounts.forEach(acc => {
          const row = [
            envMap[acc.envId] || '',
            acc.username || '',
            acc.account || '',
            acc.password || '',
            acc.note || '',
            acc.favorite ? '是' : '否'
          ].map(v => `"${String(v).replace(/"/g, '""')}"`);
          csvRows.push(row.join(','));
        });

        // 添加 BOM 以确保 Excel 正确识别 UTF-8
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
        this.downloadBlob(blob, `account-manager-export-${dateStr}.csv`);
      } else {
        // JSON 导出
        const exportData = {
          version: '2.0',
          exportTime: new Date().toISOString(),
          environments: environments,
          accounts: accounts,
          accountGroups: accountGroups
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        this.downloadBlob(blob, `account-manager-export-${dateStr}.json`);
      }

      showSuccessMessage('配置导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      showErrorMessage('导出失败: ' + error.message);
    }
  }

  // 下载导入模板
  downloadImportTemplate() {
    const template = {
      version: '2.0',
      exportTime: new Date().toISOString(),
      environments: [
        {
          id: '示例：用时间戳作为ID，如 1700000000000',
          name: '示例网站',
          loginUrl: 'https://example.com/login',
          loginButtonId: '登录按钮的ID（可选）',
          loginButtonClass: '登录按钮的class（可选）'
        }
      ],
      accounts: [
        {
          id: '示例：用时间戳作为ID，如 1700000000001',
          envId: '对应网站的ID，如 1700000000000',
          username: '张三',
          account: 'zhangsan',
          password: '123456',
          note: '备注信息（可选）',
          favorite: false
        }
      ],
      accountGroups: [
        {
          id: '示例：用时间戳作为ID，如 1700000000002',
          name: '示例模板',
          accounts: [
            {
              id: '模板账号ID',
              username: '模板用户',
              account: 'template_user',
              password: '123456',
              note: '模板备注（可选）'
            }
          ]
        }
      ]
    };

    const jsonString = JSON.stringify(template, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    this.downloadBlob(blob, 'account-manager-import-template.json');
    showSuccessMessage('导入模板已下载，请按模板格式填写后导入');
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        showErrorMessage('JSON格式错误，请检查文件格式');
        return;
      }
      
      // 验证数据格式
      const validationResult = this.validateImportData(importData);
      if (!validationResult.valid) {
        showErrorMessage('数据格式验证失败：' + validationResult.error);
        return;
      }
      
      // 确认导入
      const envCount = importData.environments?.length || 0;
      const accountCount = importData.accounts?.length || 0;
      const groupCount = importData.accountGroups?.length || 0;
      const confirmMsg = `即将导入 ${envCount} 个网站、${accountCount} 个账号${groupCount > 0 ? `、${groupCount} 个模板` : ''}。\n\n注意：导入会合并现有数据，相同ID的项目会被覆盖。`;
      const importConfirmed = await showConfirm('导入数据', confirmMsg, { confirmText: '导入' });
      if (!importConfirmed) return;
      
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
      showErrorMessage('导入失败: ' + error.message);
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
  
  // ===== 账号模板 CRUD =====

  async renderGroupList() {
    const groupList = document.getElementById('groupList');
    if (!groupList) return;

    const result = await chrome.storage.local.get(['accountGroups', 'environments']);
    const groups = result.accountGroups || [];
    const environments = result.environments || [];
    groupList.innerHTML = '';

    if (groups.length === 0) {
      groupList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div class="empty-state-text">还没有账号模板</div>
          <div class="empty-state-hint">创建模板后可关联到多个网站，共享同一套账号</div>
          <button class="empty-state-cta" id="emptyAddGroupBtn">
            ${SVG_ICONS.plus} 新建模板
          </button>
        </div>`;
      document.getElementById('emptyAddGroupBtn')?.addEventListener('click', () => {
        this.openGroupModal();
      });
      return;
    }

    groups.forEach(group => {
      const card = document.createElement('div');
      card.className = 'group-card';

      // 计算关联的网站数
      const linkedEnvCount = environments.filter(e => e.linkedGroupId === group.id).length;
      const accountCount = (group.accounts || []).length;

      // Header
      const header = document.createElement('div');
      header.className = 'group-card-header';
      header.innerHTML = `
        <div class="group-avatar">${(group.name || '?').charAt(0).toUpperCase()}</div>
        <div class="group-info">
          <div class="group-name"></div>
          <div class="group-meta">${accountCount} 个账号 · ${linkedEnvCount} 个网站使用</div>
        </div>
        ${accountCount > 0 ? `<span class="group-badge">${accountCount}</span>` : ''}
        <div class="group-actions">
          <button class="btn-edit" title="编辑名称"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
          <button class="btn-delete" title="删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
        </div>`;

      // Set name safely
      const nameEl = header.querySelector('.group-name');
      safeSetTextContent(nameEl, group.name || '未命名模板');

      header.querySelector('.btn-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openGroupModal(group.id);
      });
      header.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDeleteGroup(group.id);
      });

      card.appendChild(header);

      // Accounts section
      const accountsSection = document.createElement('div');
      accountsSection.className = 'group-accounts';

      (group.accounts || []).forEach(acc => {
        const item = document.createElement('div');
        item.className = 'group-account-item';
        item.innerHTML = `
          <div class="group-account-info">
            <div class="username"></div>
            <div class="account-text"></div>
          </div>
          <div class="group-account-actions">
            <button class="btn-edit" title="编辑"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
            <button class="btn-delete" title="删除"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
          </div>`;

        safeSetTextContent(item.querySelector('.username'), acc.username || '未命名');
        safeSetTextContent(item.querySelector('.account-text'), acc.account || '');

        item.querySelector('.btn-edit').addEventListener('click', (e) => {
          e.stopPropagation();
          this.openGroupAccountModal(group.id, acc.id);
        });
        item.querySelector('.btn-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleDeleteGroupAccount(group.id, acc.id);
        });

        accountsSection.appendChild(item);
      });

      // Add account button
      const addBtn = document.createElement('button');
      addBtn.className = 'group-add-account-btn';
      addBtn.innerHTML = `${SVG_ICONS.plus} 添加账号`;
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openGroupAccountModal(group.id);
      });
      accountsSection.appendChild(addBtn);

      card.appendChild(accountsSection);
      groupList.appendChild(card);
    });
  }

  openGroupModal(groupId = null) {
    const title = document.getElementById('groupModalTitle');
    if (title) {
      title.textContent = groupId ? '编辑账号模板' : '新建账号模板';
    }
    this.currentGroupIdForEdit = groupId;

    if (groupId) {
      chrome.storage.local.get('accountGroups', (result) => {
        const groups = result.accountGroups || [];
        const group = groups.find(g => g.id === groupId);
        if (group) {
          document.getElementById('groupName').value = group.name || '';
        }
      });
    } else {
      this.resetGroupForm();
    }
    this.groupModal.open();
  }

  resetGroupForm() {
    document.getElementById('groupForm')?.reset();
    hideError('groupNameError');
    this.currentGroupIdForEdit = null;
  }

  async handleGroupSubmit() {
    const name = document.getElementById('groupName').value.trim();
    hideError('groupNameError');

    if (!name) {
      showError('groupNameError', '模板名称不能为空');
      return;
    }

    try {
      const result = await chrome.storage.local.get('accountGroups');
      const groups = result.accountGroups || [];

      if (this.currentGroupIdForEdit) {
        const index = groups.findIndex(g => g.id === this.currentGroupIdForEdit);
        if (index !== -1) {
          groups[index].name = name;
          groups[index].updatedAt = Date.now();
        }
      } else {
        groups.push({
          id: Date.now().toString(),
          name,
          accounts: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      await chrome.storage.local.set({ accountGroups: groups });
      this.groupModal.close();
      this.resetGroupForm();
      this.renderGroupList();
      showSuccessMessage(this.currentGroupIdForEdit ? '模板更新成功' : '模板创建成功');
    } catch (error) {
      console.error('保存模板失败:', error);
      showErrorMessage('保存失败: ' + error.message);
    }
  }

  async handleDeleteGroup(groupId) {
    const result = await chrome.storage.local.get(['accountGroups', 'environments']);
    const groups = result.accountGroups || [];
    const environments = result.environments || [];
    const group = groups.find(g => g.id === groupId);
    const linkedEnvs = environments.filter(e => e.linkedGroupId === groupId);

    let msg = '确定要删除这个账号模板吗？';
    if (linkedEnvs.length > 0) {
      msg = `该模板被 ${linkedEnvs.length} 个网站使用中，删除后这些网站将不再显示模板账号。`;
    }

    const confirmed = await showConfirm('删除模板', msg, { confirmText: '删除', dangerous: true });
    if (!confirmed) return;

    try {
      const filtered = groups.filter(g => g.id !== groupId);
      // 清除关联
      const updatedEnvs = environments.map(e => {
        if (e.linkedGroupId === groupId) {
          const { linkedGroupId, ...rest } = e;
          return rest;
        }
        return e;
      });

      await chrome.storage.local.set({ accountGroups: filtered, environments: updatedEnvs });
      this.renderGroupList();
      showSuccessMessage('模板已删除');
    } catch (error) {
      console.error('删除模板失败:', error);
      showErrorMessage('删除失败: ' + error.message);
    }
  }

  openGroupAccountModal(groupId, accountId = null) {
    this.currentGroupId = groupId;
    this.currentGroupAccountId = accountId;

    const title = document.getElementById('groupAccountModalTitle');
    if (title) {
      title.textContent = accountId ? '编辑模板账号' : '添加模板账号';
    }

    this.resetGroupAccountForm();

    if (accountId) {
      chrome.storage.local.get('accountGroups', (result) => {
        const groups = result.accountGroups || [];
        const group = groups.find(g => g.id === groupId);
        if (group) {
          const acc = (group.accounts || []).find(a => a.id === accountId);
          if (acc) {
            document.getElementById('groupAccountUsername').value = acc.username || '';
            document.getElementById('groupAccountAccount').value = acc.account || '';
            document.getElementById('groupAccountPassword').value = acc.password || '';
            document.getElementById('groupAccountNote').value = acc.note || '';
            this.currentGroupAccountId = accountId;
          }
        }
      });
    }

    this.groupAccountModal.open();
  }

  resetGroupAccountForm() {
    document.getElementById('groupAccountForm')?.reset();
    hideError('groupAccountUsernameError');
    hideError('groupAccountAccountError');
    hideError('groupAccountPasswordError');
    hideError('groupAccountNoteError');
    this.currentGroupAccountId = null;

    const pwInput = document.getElementById('groupAccountPassword');
    const pwToggle = document.getElementById('groupAccountPasswordToggle');
    if (pwInput && pwToggle) {
      pwInput.type = 'password';
      pwToggle.classList.remove('show-password');
    }
  }

  async handleGroupAccountSubmit() {
    const username = document.getElementById('groupAccountUsername').value.trim();
    const account = document.getElementById('groupAccountAccount').value.trim();
    const password = document.getElementById('groupAccountPassword').value;
    const note = document.getElementById('groupAccountNote').value.trim();

    hideError('groupAccountUsernameError');
    hideError('groupAccountAccountError');
    hideError('groupAccountPasswordError');

    let isValid = true;
    if (!username) { showError('groupAccountUsernameError', '用户名不能为空'); isValid = false; }
    if (!account) { showError('groupAccountAccountError', '账号不能为空'); isValid = false; }
    if (!password) { showError('groupAccountPasswordError', '密码不能为空'); isValid = false; }
    if (!isValid) return;

    try {
      const result = await chrome.storage.local.get('accountGroups');
      const groups = result.accountGroups || [];
      const groupIndex = groups.findIndex(g => g.id === this.currentGroupId);
      if (groupIndex === -1) {
        showErrorMessage('模板不存在');
        return;
      }

      const group = groups[groupIndex];
      if (!group.accounts) group.accounts = [];

      if (this.currentGroupAccountId) {
        // 编辑
        const accIndex = group.accounts.findIndex(a => a.id === this.currentGroupAccountId);
        if (accIndex !== -1) {
          group.accounts[accIndex] = {
            ...group.accounts[accIndex],
            username, account, password, note: note || '',
            updatedAt: Date.now()
          };
        }
      } else {
        // 新增
        group.accounts.push({
          id: Date.now().toString(),
          username, account, password, note: note || '',
          createdAt: Date.now()
        });
      }

      group.updatedAt = Date.now();
      await chrome.storage.local.set({ accountGroups: groups });
      this.groupAccountModal.close();
      this.resetGroupAccountForm();
      this.renderGroupList();
      showSuccessMessage(this.currentGroupAccountId ? '账号更新成功' : '账号添加成功');
    } catch (error) {
      console.error('保存模板账号失败:', error);
      showErrorMessage('保存失败: ' + error.message);
    }
  }

  async handleDeleteGroupAccount(groupId, accountId) {
    const confirmed = await showConfirm('删除账号', '确定要从模板中删除这个账号吗？', { confirmText: '删除', dangerous: true });
    if (!confirmed) return;

    try {
      const result = await chrome.storage.local.get('accountGroups');
      const groups = result.accountGroups || [];
      const group = groups.find(g => g.id === groupId);
      if (group) {
        group.accounts = (group.accounts || []).filter(a => a.id !== accountId);
        group.updatedAt = Date.now();
        await chrome.storage.local.set({ accountGroups: groups });
        this.renderGroupList();
        showSuccessMessage('账号已从模板删除');
      }
    } catch (error) {
      console.error('删除模板账号失败:', error);
      showErrorMessage('删除失败: ' + error.message);
    }
  }

  // 合并导入数据
  async mergeImportData(importData) {
    try {
      // 获取现有数据
      const result = await chrome.storage.local.get(['environments', 'accounts', 'accountGroups']);
      const existingEnvironments = result.environments || [];
      const existingAccounts = result.accounts || [];
      const existingGroups = result.accountGroups || [];
      
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
      
      // 合并账号模板
      let mergedGroups = [...existingGroups];
      if (importData.accountGroups && importData.accountGroups.length > 0) {
        importData.accountGroups.forEach(importGroup => {
          const existingIndex = mergedGroups.findIndex(g => g.id === importGroup.id);
          if (existingIndex !== -1) {
            mergedGroups[existingIndex] = {
              ...importGroup,
              updatedAt: Date.now()
            };
          } else {
            mergedGroups.push({
              ...importGroup,
              id: importGroup.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
              createdAt: importGroup.createdAt || Date.now(),
              updatedAt: Date.now()
            });
          }
        });
      }

      // 保存合并后的数据
      await chrome.storage.local.set({
        environments: mergedEnvironments,
        accounts: mergedAccounts,
        accountGroups: mergedGroups
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
