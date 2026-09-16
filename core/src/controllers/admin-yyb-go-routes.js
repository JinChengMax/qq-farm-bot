const yybGoClient = require('../services/yyb-go-client');

function registerAdminYybGoRoutes({ app, requireAdminRole }) {
  app.get('/api/yyb-go/capability', requireAdminRole, (req, res) => {
    const capability = yybGoClient.capability();
    res.json({ ok: true, data: { enabled: capability.enabled } });
  });

  app.get('/api/yyb-go/accounts', requireAdminRole, async (req, res) => {
    try {
      const accounts = await yybGoClient.listAccounts();
      res.json({ ok: true, data: { accounts } });
    } catch (error) {
      res.status(502).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/yyb-go/code', requireAdminRole, async (req, res) => {
    try {
      const ref = String(req.body && req.body.ref || '').trim();
      if (!ref) return res.status(400).json({ ok: false, error: '缺少 YYB-Go 账号引用' });
      const code = await yybGoClient.getFarmCode(ref);
      res.json({ ok: true, data: { code } });
    } catch (error) {
      res.status(502).json({ ok: false, error: error.message });
    }
  });
}

module.exports = { registerAdminYybGoRoutes };
