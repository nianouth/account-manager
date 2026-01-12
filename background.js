/**
 * 全房通账号管理器V1.0.0 - 后台服务脚本
 * 符合 Chrome Extension Manifest V3 规范
 */

// 工具函数：安全的存储操作
const safeStorageOperation = (operation, errorHandler) => {
  try {
    return operation();
  } catch (error) {
    console.error('Storage operation failed:', error);
    if (errorHandler) errorHandler(error);
    return Promise.reject(error);
  }
};

// 初始化默认数据
const initializeDefaultData = async () => {
  try {
    const result = await chrome.storage.local.get(['environments', 'accounts']);
    
    if (!result.environments || result.environments.length === 0) {
      // 不初始化默认环境，让用户自己添加并设置登录页面URL
      console.log('环境列表为空，等待用户添加');
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

// 匹配环境（根据登录页面URL）
const matchEnvironment = async (urlString) => {
  if (!urlString) return null;
  
  try {
    const result = await chrome.storage.local.get('environments');
    const environments = result.environments || [];
    
    // 规范化当前URL（移除末尾的斜杠、查询参数、hash等，只保留协议+域名+路径）
    let normalizedCurrentUrl = urlString;
    try {
      const url = new URL(urlString);
      normalizedCurrentUrl = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '');
    } catch (error) {
      console.debug('URL规范化失败，使用原始URL:', error);
    }
    
    // 遍历所有环境，检查当前URL是否匹配登录页面URL
    for (const env of environments) {
      if (!env.loginUrl) continue;
      
      try {
        // 规范化环境的登录URL
        const envUrl = new URL(env.loginUrl);
        const normalizedEnvUrl = `${envUrl.protocol}//${envUrl.host}${envUrl.pathname}`.replace(/\/$/, '');
        
        // 精确匹配
        if (normalizedCurrentUrl === normalizedEnvUrl) {
          return env;
        }
        
        // 路径匹配（支持通配符，如 /login/*）
        if (normalizedEnvUrl.endsWith('/*')) {
          const baseUrl = normalizedEnvUrl.slice(0, -2);
          if (normalizedCurrentUrl.startsWith(baseUrl)) {
            return env;
          }
        }
        
        // 不再使用包含匹配，因为太宽松会导致误匹配
        // 例如：登录URL是 https://example.com，当前URL是 https://example.com/dashboard 也会匹配
      } catch (error) {
        console.debug('环境URL解析失败:', env.loginUrl, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('环境匹配失败:', error);
    return null;
  }
};

// 扩展安装/更新监听
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('全房通账号管理器V1.0.0扩展已安装/更新:', details.reason);
  
  if (details.reason === 'install') {
    await initializeDefaultData();
  } else if (details.reason === 'update') {
    // 更新时的迁移逻辑可以在这里处理
    console.log('扩展已更新到版本:', chrome.runtime.getManifest().version);
  }
});

// 监听标签页更新，自动切换环境
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
          console.debug('发送环境切换消息失败:', error);
        }
      });
    }
  } catch (error) {
    console.error('自动切换环境失败:', error);
  }
});

// 消息处理：数据备份与恢复
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 使用 async/await 处理异步操作
  (async () => {
    try {
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

// 错误处理
chrome.runtime.onStartup.addListener(() => {
  console.log('全房通账号管理器V1.0.0扩展已启动');
});

// Service Worker 保活（Manifest V3 要求）
// 注意：Service Worker 会在空闲时自动休眠，这是正常行为