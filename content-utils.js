/**
 * Content Script 共享工具函数
 * 提供 DOM 操作、URL 匹配、提示消息等通用功能
 * 注意：使用 var/function 声明以确保跨文件可访问
 */

// ============== UI 常量 ==============
var COLORS = {
  PRIMARY: '#518EFF',
  PRIMARY_LIGHT: '#A0C3FF',
  TEXT: '#333333',
  TEXT_SECONDARY: '#666666',
  BORDER: '#E0E0E0',
  CANCEL_BG: '#E6EFFB',
  ERROR: '#F44336'
};

var PANEL = {
  WIDTH: '300px',
  CIRCLE_SIZE: '50px',
  Z_INDEX: '999999',
  MODAL_Z_INDEX: '1000000',
  TOAST_Z_INDEX: '1000001'
};

// 安全的文本内容设置（防止 XSS）
function safeSetTextContent(element, text) {
  if (element && text !== null && text !== undefined) {
    element.textContent = String(text);
  }
}

// 创建 DOM 元素（避免使用 innerHTML）
function createElement(tag, attributes, children) {
  attributes = attributes || {};
  children = children || [];
  const element = document.createElement(tag);

  Object.entries(attributes).forEach(function([key, value]) {
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

  children.forEach(function(child) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  });

  return element;
}

// URL 规范化（移除查询参数和锚点）
function normalizeUrl(urlString) {
  try {
    var url = new URL(urlString);
    return (url.protocol + '//' + url.host + url.pathname).replace(/\/$/, '');
  } catch (error) {
    console.debug('URL 规范化失败:', error);
    return urlString;
  }
}

// 根据 URL 匹配网站环境（纯函数）
function matchEnvByUrl(currentUrl, environments) {
  if (!currentUrl || !Array.isArray(environments)) return null;

  var normalizedCurrentUrl = normalizeUrl(currentUrl);

  for (var i = 0; i < environments.length; i++) {
    var env = environments[i];
    if (!env.loginUrl) continue;

    try {
      var normalizedEnvUrl = normalizeUrl(env.loginUrl);

      // 精确匹配
      if (normalizedCurrentUrl === normalizedEnvUrl) {
        return env;
      }

      // 路径通配符匹配（如 /login/*）
      if (normalizedEnvUrl.endsWith('/*')) {
        var baseUrl = normalizedEnvUrl.slice(0, -2);
        if (normalizedCurrentUrl.startsWith(baseUrl)) {
          return env;
        }
      }
    } catch (error) {
      console.debug('网站 URL 解析失败:', env.loginUrl, error);
      continue;
    }
  }

  return null;
}

// 匹配网站（异步包装：从 storage 获取环境列表后调用纯函数匹配）
async function matchEnvironment(currentUrl) {
  if (!currentUrl) return null;

  try {
    var result = await chrome.storage.local.get('environments');
    return matchEnvByUrl(currentUrl, result.environments || []);
  } catch (error) {
    console.error('网站匹配失败:', error);
    return null;
  }
}

// 显示成功提示消息
function showSuccessMessage(message, duration) {
  duration = duration || 2000;

  // 移除已存在的提示
  var existingToast = document.getElementById('floating-success-toast');
  if (existingToast) {
    existingToast.remove();
  }

  var toast = createElement('div', {
    id: 'floating-success-toast',
    style: {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: COLORS.PRIMARY,
      color: 'white',
      padding: '12px 24px',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: PANEL.TOAST_Z_INDEX,
      fontSize: '14px',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      whiteSpace: 'nowrap'
    }
  }, [message]);

  // 添加动画
  toast.style.animation = 'slideDown 0.3s ease-out';

  // 确保动画样式存在
  if (!document.getElementById('floating-toast-animations')) {
    var style = createElement('style', {
      id: 'floating-toast-animations'
    });
    style.textContent = '\
      @keyframes slideDown {\
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }\
        to { opacity: 1; transform: translateX(-50%) translateY(0); }\
      }\
      @keyframes slideUp {\
        from { opacity: 1; transform: translateX(-50%) translateY(0); }\
        to { opacity: 0; transform: translateX(-50%) translateY(-20px); }\
      }\
    ';
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // 自动移除
  setTimeout(function() {
    toast.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(function() {
      toast.remove();
    }, 300);
  }, duration);
}

// 显示错误提示消息
function showErrorMessage(message, duration) {
  duration = duration || 3000;

  var existingToast = document.getElementById('floating-success-toast');
  if (existingToast) {
    existingToast.remove();
  }

  var toast = createElement('div', {
    id: 'floating-success-toast',
    style: {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: COLORS.ERROR,
      color: 'white',
      padding: '12px 24px',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: PANEL.TOAST_Z_INDEX,
      fontSize: '14px',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      whiteSpace: 'nowrap'
    }
  }, [message]);

  toast.style.animation = 'slideDown 0.3s ease-out';

  if (!document.getElementById('floating-toast-animations')) {
    var style = createElement('style', { id: 'floating-toast-animations' });
    style.textContent = '\
      @keyframes slideDown {\
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }\
        to { opacity: 1; transform: translateX(-50%) translateY(0); }\
      }\
      @keyframes slideUp {\
        from { opacity: 1; transform: translateX(-50%) translateY(0); }\
        to { opacity: 0; transform: translateX(-50%) translateY(-20px); }\
      }\
    ';
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  setTimeout(function() {
    toast.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(function() {
      toast.remove();
    }, 300);
  }, duration);
}
