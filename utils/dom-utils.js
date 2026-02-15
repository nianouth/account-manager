/**
 * DOM 操作工具函数
 * 提供安全的 DOM 操作方法，防止 XSS 攻击
 */

/**
 * 安全地设置元素的文本内容（防止 XSS）
 * @param {HTMLElement} element - 目标元素
 * @param {string|number} text - 要设置的文本
 */
export function safeSetTextContent(element, text) {
  if (element && text !== null && text !== undefined) {
    element.textContent = String(text);
  }
}

/**
 * 创建 DOM 元素（避免使用 innerHTML）
 * @param {string} tag - 元素标签名
 * @param {Object} attributes - 元素属性
 * @param {Array} children - 子元素数组
 * @returns {HTMLElement} 创建的元素
 */
export function createElement(tag, attributes = {}, children = []) {
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
}

/**
 * 获取元素（querySelector 的便捷包装）
 * @param {string} selector - CSS 选择器
 * @param {HTMLElement} parent - 父元素（可选）
 * @returns {HTMLElement|null} 找到的元素
 */
export function getElement(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * 获取多个元素（querySelectorAll 的便捷包装）
 * @param {string} selector - CSS 选择器
 * @param {HTMLElement} parent - 父元素（可选）
 * @returns {NodeList} 元素列表
 */
export function getElements(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * 添加 CSS 类
 * @param {HTMLElement} element - 目标元素
 * @param {string} className - 类名
 */
export function addClass(element, className) {
  if (element && className) {
    element.classList.add(className);
  }
}

/**
 * 移除 CSS 类
 * @param {HTMLElement} element - 目标元素
 * @param {string} className - 类名
 */
export function removeClass(element, className) {
  if (element && className) {
    element.classList.remove(className);
  }
}

/**
 * 切换 CSS 类
 * @param {HTMLElement} element - 目标元素
 * @param {string} className - 类名
 * @returns {boolean} 是否添加了类
 */
export function toggleClass(element, className) {
  if (element && className) {
    return element.classList.toggle(className);
  }
  return false;
}
