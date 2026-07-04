/**
 * 账号管理器 - 后台服务脚本
 * 符合 Chrome Extension Manifest V3 规范
 * v2.0.0: 数据备份与恢复
 */

import { matchEnvironment as matchEnvByUrl } from './utils/url-matcher.js';

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
    console.log('欢迎使用账号管理器！');
  } else if (details.reason === 'update') {
    const version = chrome.runtime.getManifest().version;
    console.log('扩展已更新到版本:', version);
  }
});

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

// 消息处理：数据备份与恢复
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 使用 async/await 处理异步操作
  (async () => {
    try {
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


// 错误处理
chrome.runtime.onStartup.addListener(() => {
  console.log('账号管理器扩展已启动');
});

// Service Worker 保活（Manifest V3 要求）
// 注意：Service Worker 会在空闲时自动休眠，这是正常行为