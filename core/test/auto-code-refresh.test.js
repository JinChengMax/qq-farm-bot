const test = require('node:test');
const assert = require('node:assert/strict');

const { createAutoCodeRefreshService } = require('../src/runtime/auto-code-refresh');

function createService(account, logs) {
  return createAutoCodeRefreshService({
    store: {
      getAutoCodeRefresh: () => ({ enabled: false, intervalMinutes: 60 }),
    },
    getAccounts: () => ({ accounts: [account] }),
    addOrUpdateAccount: () => {},
    resolveWorkerControls: () => ({}),
    log: (...args) => logs.push(args),
    addAccountLog: () => {},
  });
}

test('QQ accounts do not emit a missing wxid warning during Code refresh scheduling', () => {
  const logs = [];
  const service = createService({ id: 'qq-1', name: 'QQ account', platform: 'qq' }, logs);

  service.scheduleAccount('qq-1');

  assert.deepEqual(logs, []);
});

test('WeChat accounts still report a missing wxid during Code refresh scheduling', () => {
  const logs = [];
  const service = createService({ id: 'wx-1', name: 'WeChat account', platform: 'wx' }, logs);

  service.scheduleAccount('wx-1');

  assert.equal(logs.length, 1);
  assert.equal(logs[0][1], '自动刷新 Code 未启动: 账号缺少 wxid');
});

test('YYB-Go accounts do not require a local wxid or loginBuffer', () => {
  const logs = [];
  const service = createService({
    id: 'wx-remote', name: 'Remote WeChat', platform: 'wx',
    loginType: 'yyb_go', yybAccountRef: '7',
  }, logs);

  service.scheduleAccount('wx-remote');

  assert.deepEqual(logs, []);
});

test('YYB-Go accounts fetch a fresh code and restart with the updated account', async () => {
  const account = {
    id: 'wx-remote', name: 'Remote WeChat', platform: 'wx', code: 'expired',
    loginType: 'yyb_go', yybAccountRef: '7',
  };
  let saved;
  let restarted;
  const service = createAutoCodeRefreshService({
    store: { getAutoCodeRefresh: () => ({ enabled: true, intervalMinutes: 60 }) },
    getAccounts: () => ({ accounts: [account] }),
    addOrUpdateAccount: next => { saved = next; },
    resolveWorkerControls: () => ({ restartWorker: next => { restarted = next; } }),
    log: () => {},
    addAccountLog: () => {},
    yybGoClient: { getFarmCode: async ref => `fresh-code-for-${ref}` },
  });

  assert.equal(await service.refreshAccountCode(account.id, 'test'), true);
  assert.equal(saved.code, 'fresh-code-for-7');
  assert.equal(restarted.code, 'fresh-code-for-7');
});
