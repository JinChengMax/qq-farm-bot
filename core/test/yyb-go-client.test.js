const test = require('node:test');
const assert = require('node:assert/strict');

const { createYybGoClient, DEFAULT_APP_ID } = require('../src/services/yyb-go-client');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test('YYB-Go client lists accounts through the authenticated integration API', async () => {
  const requests = [];
  const client = createYybGoClient({
    env: { YYB_GO_URL: 'http://yyb-go:8000/', YYB_GO_TOKEN: 'secret' },
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return jsonResponse(200, { code: 0, data: { items: [{ id: 7, display_name: '微信账号' }] } });
    },
  });

  const accounts = await client.listAccounts();

  assert.equal(accounts[0].id, 7);
  assert.equal(requests[0].url, 'http://yyb-go:8000/integration/accounts');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer secret');
});

test('YYB-Go client requests a fresh farm code for the configured mini program', async () => {
  let requestBody;
  const client = createYybGoClient({
    env: { YYB_GO_URL: 'http://yyb-go:8000', YYB_GO_TOKEN: 'secret' },
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return jsonResponse(200, { code: 0, data: { result: { code: 'fresh-farm-code' } } });
    },
  });

  assert.equal(await client.getFarmCode('7'), 'fresh-farm-code');
  assert.deepEqual(requestBody, { ref: '7', app_id: DEFAULT_APP_ID });
});

test('YYB-Go client surfaces remote authentication failures without leaking its token', async () => {
  const client = createYybGoClient({
    env: { YYB_GO_URL: 'http://yyb-go:8000', YYB_GO_TOKEN: 'do-not-leak' },
    fetchImpl: async () => jsonResponse(401, { code: 401, msg: 'invalid integration token' }),
  });

  await assert.rejects(client.listAccounts(), /invalid integration token/);
});
