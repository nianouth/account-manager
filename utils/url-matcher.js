/**
 * URL 匹配工具
 * 统一的 URL 匹配逻辑，避免在多个文件中重复
 */

/**
 * 规范化 URL（移除查询参数和锚点）
 * @param {string} urlString - 原始 URL
 * @returns {string} 规范化后的 URL
 */
export function normalizeUrl(urlString) {
  try {
    const url = new URL(urlString);
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '');
  } catch (error) {
    console.debug('URL 规范化失败:', error);
    return urlString;
  }
}

/**
 * 匹配网站环境（根据登录页面 URL）
 * @param {string} currentUrl - 当前页面 URL
 * @param {Array} environments - 所有网站环境
 * @returns {Object|null} 匹配的环境，如果没有匹配则返回 null
 */
export function matchEnvironment(currentUrl, environments) {
  if (!currentUrl || !Array.isArray(environments)) {
    return null;
  }

  // 规范化当前 URL
  const normalizedCurrentUrl = normalizeUrl(currentUrl);

  // 遍历所有网站环境
  for (const env of environments) {
    if (!env.loginUrl) continue;

    try {
      // 规范化网站的登录 URL
      const normalizedEnvUrl = normalizeUrl(env.loginUrl);

      // 精确匹配
      if (normalizedCurrentUrl === normalizedEnvUrl) {
        return env;
      }

      // 路径通配符匹配（如 /login/*）
      if (normalizedEnvUrl.endsWith('/*')) {
        const baseUrl = normalizedEnvUrl.slice(0, -2);
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

/**
 * 检查两个 URL 是否匹配
 * @param {string} url1 - 第一个 URL
 * @param {string} url2 - 第二个 URL
 * @returns {boolean} 是否匹配
 */
export function isUrlMatched(url1, url2) {
  if (!url1 || !url2) return false;

  const normalized1 = normalizeUrl(url1);
  const normalized2 = normalizeUrl(url2);

  return normalized1 === normalized2;
}
