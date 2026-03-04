/**
 * 账号管理器 - 后台服务脚本
 * 符合 Chrome Extension Manifest V3 规范
 * v2.0.0: 添加会话管理、密钥存储、数据迁移
 */

import { matchEnvironment as matchEnvByUrl } from './utils/url-matcher.js';

// ============== 会话管理 ==============
// Service Worker 内存中的会话密钥（浏览器关闭或 Service Worker 休眠后会清除）
let sessionKey = null;
let sessionMode = 'default'; // 'default'(30min) | 'today' | 'browser'
// 会话超时 Alarm 名称
const SESSION_ALARM = 'sessionTimeout';

// 初始化默认数据
const initializeDefaultData = async () => {
  try {
    const result = await chrome.storage.local.get(['environments', 'accounts']);
    
    if (!result.environments || result.environments.length === 0) {
      // 不初始化默认网站，让用户自己添加并设置登录页面URL
      console.log('网站列表为空，等待用户添加');
    }
    
    if (!result.accounts || result.accounts.length === 0) {
      // 不初始化默认账号，让用户自己添加
      // 这样可以避免存储不安全的默认密码
      console.log('账号列表为空，等待用户添加');
    }
  } catch (error) {
    console.error('初始化默认数据失败:', error);
  }
};

// 匹配网站（根据登录页面URL，使用 utils/url-matcher.js 统一逻辑）
const matchEnvironment = async (urlString) => {
  if (!urlString) return null;

  try {
    const result = await chrome.storage.local.get('environments');
    return matchEnvByUrl(urlString, result.environments || []);
  } catch (error) {
    console.error('网站匹配失败:', error);
    return null;
  }
};

// 扩展安装/更新监听
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('账号管理器扩展已安装/更新:', details.reason);

  if (details.reason === 'install') {
    await initializeDefaultData();
    console.log('欢迎使用账号管理器 v2.0！首次使用请设置主密码。');
  } else if (details.reason === 'update') {
    const version = chrome.runtime.getManifest().version;
    console.log('扩展已更新到版本:', version);

    // 检测是否需要从旧版本迁移
    const needsMigration = await checkNeedsMigration();
    if (needsMigration) {
      console.log('检测到旧版本数据，需要迁移到新安全系统');
      // 自动备份旧数据
      await backupOldData();
    }
  }
});

/**
 * 检测是否需要从旧版本迁移
 */
async function checkNeedsMigration() {
  try {
    const result = await chrome.storage.local.get('masterPassword');
    return !!result.masterPassword;
  } catch (error) {
    console.error('检测迁移状态失败:', error);
    return false;
  }
}

/**
 * 备份旧版本数据
 */
async function backupOldData() {
  try {
    const oldData = await chrome.storage.local.get(['environments', 'accounts', 'masterPassword']);
    await chrome.storage.local.set({
      backup_v1_2_0: {
        timestamp: Date.now(),
        version: '1.2.0',
        data: oldData
      }
    });
    console.log('旧版本数据已自动备份');
  } catch (error) {
    console.error('备份旧数据失败:', error);
  }
}

// 监听标签页更新，自动切换网站
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 只在页面加载完成时处理
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }
  
  // 忽略 chrome:// 等特殊页面
  if (!tab.url.startsWith('http')) {
    return;
  }
  
  try {
    const currentUrl = tab.url;
    if (!currentUrl || !currentUrl.startsWith('http')) return;
    
    const matchedEnv = await matchEnvironment(currentUrl);
    if (matchedEnv) {
      // 发送消息到内容脚本，异步处理，不等待响应
      chrome.tabs.sendMessage(tabId, { 
        action: 'switchEnv', 
        envId: matchedEnv.id,
        envName: matchedEnv.name
      }).catch(error => {
        // 内容脚本可能未加载，忽略错误
        if (error.message !== 'Could not establish connection. Receiving end does not exist.') {
          console.debug('发送网站切换消息失败:', error);
        }
      });
    }
  } catch (error) {
    console.error('自动切换网站失败:', error);
  }
});

// 消息处理：会话管理、数据备份与恢复
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 使用 async/await 处理异步操作
  (async () => {
    try {
      // ========== 会话管理 ==========
      if (request.action === 'setSessionKey') {
        sessionKey = request.keyData;
        sessionMode = request.mode || 'default';

        // 根据模式设置不同的超时策略
        await chrome.alarms.clear(SESSION_ALARM);

        if (sessionMode === 'default') {
          // 从设置中读取超时时间，默认30分钟
          const config = await chrome.storage.local.get('sessionTimeout');
          const timeoutMinutes = config.sessionTimeout || 30;
          await chrome.alarms.create(SESSION_ALARM, { delayInMinutes: timeoutMinutes });
        } else if (sessionMode === 'today') {
          // 计算到今天23:59:59的分钟数
          const now = new Date();
          const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
          const minutesLeft = Math.max(1, Math.ceil((endOfDay - now) / 60000));
          await chrome.alarms.create(SESSION_ALARM, { delayInMinutes: minutesLeft });
        }
        // 'browser' 模式：不设置 alarm，关闭浏览器时 Service Worker 自动清除

        // 同时存到 chrome.storage.session，防止 SW 休眠丢失
        try {
          await chrome.storage.session.set({
            sessionKey: request.keyData,
            sessionMode: sessionMode,
            sessionCreatedAt: Date.now()
          });
        } catch (e) {
          console.debug('chrome.storage.session 不可用:', e.message);
        }

        sendResponse({ success: true });
        return;
      }

      if (request.action === 'getSessionKey') {
        // 先检查内存
        if (sessionKey) {
          sendResponse({ success: true, keyData: sessionKey });
          return;
        }

        // 内存没有（SW 重启过），从 session storage 恢复
        // 注意：此处的过期检查是 Alarm 超时的安全兜底——SW 休眠可能导致 Alarm 未触发
        try {
          const data = await chrome.storage.session.get(['sessionKey', 'sessionMode', 'sessionCreatedAt']);
          if (data.sessionKey) {
            // 检查是否过期
            const mode = data.sessionMode || 'default';
            const createdAt = data.sessionCreatedAt || 0;
            const now = Date.now();

            let expired = false;
            const timeoutConfig = await chrome.storage.local.get('sessionTimeout');
            const timeoutMs = (timeoutConfig.sessionTimeout || 30) * 60 * 1000;
            if (mode === 'default' && (now - createdAt) > timeoutMs) {
              expired = true;
            } else if (mode === 'today') {
              const createdDate = new Date(createdAt).toDateString();
              const todayDate = new Date(now).toDateString();
              if (createdDate !== todayDate) expired = true;
            }
            // 'browser' 模式永不过期（session storage 关闭浏览器自动清除）

            if (!expired) {
              sessionKey = data.sessionKey;
              sessionMode = mode;
              sendResponse({ success: true, keyData: sessionKey });
              return;
            } else {
              // 过期了，清除
              await chrome.storage.session.remove(['sessionKey', 'sessionMode', 'sessionCreatedAt']);
            }
          }
        } catch (e) {
          console.debug('chrome.storage.session 不可用:', e.message);
        }

        sendResponse({ success: false, message: '会话已过期，请重新验证主密码' });
        return;
      }

      if (request.action === 'clearSession') {
        sessionKey = null;
        sessionMode = 'default';
        await chrome.alarms.clear(SESSION_ALARM);
        try {
          await chrome.storage.session.remove(['sessionKey', 'sessionMode', 'sessionCreatedAt']);
        } catch (e) {
          console.debug('清除 session storage 失败:', e.message);
        }
        sendResponse({ success: true });
        return;
      }

      // ========== 数据备份与恢复 ==========
      if (request.action === 'backupData') {
        const result = await chrome.storage.local.get(['environments', 'accounts']);
        const backupData = {
          version: chrome.runtime.getManifest().version,
          timestamp: new Date().toISOString(),
          environments: result.environments || [],
          accounts: result.accounts || []
        };
        sendResponse({ success: true, data: backupData });
        return;
      }

      if (request.action === 'restoreData') {
        if (!request.data || !Array.isArray(request.data.environments) || !Array.isArray(request.data.accounts)) {
          sendResponse({ success: false, error: '无效的备份数据格式' });
          return;
        }

        await chrome.storage.local.set({
          environments: request.data.environments,
          accounts: request.data.accounts
        });
        sendResponse({ success: true });
        return;
      }

      // 未知操作
      sendResponse({ success: false, error: '未知的操作类型' });
    } catch (error) {
      console.error('消息处理失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // 返回 true 表示异步响应
  return true;
});

// 监听 Alarm 事件（会话超时）
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SESSION_ALARM) {
    sessionKey = null;
    sessionMode = 'default';
    try {
      await chrome.storage.session.remove(['sessionKey', 'sessionMode', 'sessionCreatedAt']);
    } catch (e) {
      console.debug('清除 session storage 失败:', e.message);
    }
  }
});

// 错误处理
chrome.runtime.onStartup.addListener(() => {
  console.log('账号管理器扩展已启动');
});

// Service Worker 保活（Manifest V3 要求）
// 注意：Service Worker 会在空闲时自动休眠，这是正常行为