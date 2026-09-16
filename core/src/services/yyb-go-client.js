const DEFAULT_APP_ID = 'wx5306c5978fdb76e4';
const DEFAULT_TIMEOUT_MS = 15000;

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function readConfig(env = process.env) {
  return {
    baseUrl: trimTrailingSlash(env.YYB_GO_URL),
    token: String(env.YYB_GO_TOKEN || '').trim(),
    appId: String(env.YYB_GO_APP_ID || DEFAULT_APP_ID).trim(),
    timeoutMs: Math.max(1000, Number(env.YYB_GO_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
  };
}

function findStringCode(value) {
  if (!value || typeof value !== 'object') return '';
  if (typeof value.code === 'string' && value.code.trim()) return value.code.trim();
  for (const child of Object.values(value)) {
    const code = findStringCode(child);
    if (code) return code;
  }
  return '';
}

function createYybGoClient(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  function config() {
    return readConfig(env);
  }

  function capability() {
    const current = config();
    return {
      enabled: !!(current.baseUrl && current.token),
      baseUrl: current.baseUrl,
      appId: current.appId,
    };
  }

  async function request(path, init = {}) {
    const current = config();
    if (!current.baseUrl || !current.token) {
      throw new Error('YYB-Go 未配置，请设置 YYB_GO_URL 和 YYB_GO_TOKEN');
    }
    if (typeof fetchImpl !== 'function') throw new Error('当前 Node.js 版本不支持 fetch');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), current.timeoutMs);
    try {
      const response = await fetchImpl(`${current.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${current.token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
      });
      const text = await response.text();
      let payload;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`YYB-Go 返回了非 JSON 响应（HTTP ${response.status}）`);
      }
      if (!response.ok || (typeof payload.code === 'number' && payload.code !== 0)) {
        throw new Error(payload.msg || payload.message || `YYB-Go 请求失败（HTTP ${response.status}）`);
      }
      return payload.data !== undefined ? payload.data : payload;
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('YYB-Go 请求超时');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function listAccounts() {
    const data = await request('/integration/accounts');
    return Array.isArray(data.items) ? data.items : [];
  }

  async function getFarmCode(ref) {
    const accountRef = String(ref || '').trim();
    if (!accountRef) throw new Error('缺少 YYB-Go 账号引用');
    const current = config();
    const data = await request('/integration/actions/get-code', {
      method: 'POST',
      body: JSON.stringify({ ref: accountRef, app_id: current.appId }),
    });
    const code = findStringCode(data);
    if (!code) throw new Error('YYB-Go 未返回有效的 wx.login code');
    return code;
  }

  return { capability, listAccounts, getFarmCode };
}

const defaultClient = createYybGoClient();

module.exports = {
  DEFAULT_APP_ID,
  createYybGoClient,
  capability: defaultClient.capability,
  listAccounts: defaultClient.listAccounts,
  getFarmCode: defaultClient.getFarmCode,
};
