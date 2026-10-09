// Captures each tab of the web build. Not a project dependency: point PW at a Playwright install (e.g. one in ~/.npm/_npx/*/node_modules/playwright).
// usage: PW=<path> node docs/desktop/capture.cjs <baseUrl> <width> <height> <outPrefix> [tabs...]   (tabs default: Today Projects Almanac Quest)
const { chromium } = require(process.env.PW || 'playwright');
const [base, w, h, prefix, ...rest] = process.argv.slice(2);
const tabs = rest.length ? rest : ['Today', 'Projects', 'Almanac', 'Quest'];
const REF = 'bmebumdotlsunvvsxycx';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  await ctx.route(/supabase\.co/, (r) => r.abort());
  await ctx.route(/cdn\.jsdelivr\.net/, (r) => r.continue());
  await ctx.addInitScript(([ref]) => {
    const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
    const s = { access_token: 'a.b.c', refresh_token: 'r', token_type: 'bearer', expires_in: 31536000, expires_at: exp, user: { id: 'qa-user', aud: 'authenticated', email: 'qa@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };
    if (!localStorage.getItem('sb-' + ref + '-auth-token')) localStorage.setItem('sb-' + ref + '-auth-token', JSON.stringify(s));
    if (!localStorage.getItem('streak-settings-v1')) localStorage.setItem('streak-settings-v1', JSON.stringify({ welcomeSeen: true, dailyPrompt: false, shortSessionsReviewed: true }));
    if (!localStorage.getItem('streak-sync-v1')) localStorage.setItem('streak-sync-v1', JSON.stringify({ ownerId: 'qa-user', outbox: {}, cursors: {}, rowsVersion: 2 }));
    if (!localStorage.getItem('adet-quest-tables-v1')) localStorage.setItem('adet-quest-tables-v1', 'available');
  }, [REF]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 200)));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(14000);
  async function dismiss() {
    for (let i = 0; i < 8; i++) {
      const dlg = page.locator('[role="dialog"]');
      if (!(await dlg.count())) return;
      const b = dlg.last().locator('[role="button"], button').last();
      if (!(await b.count())) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); continue; }
      await b.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
    }
  }
  await dismiss();
  for (const t of tabs) {
    await dismiss();
    const tab = page.getByRole('tab', { name: new RegExp('^' + t) });
    if (await tab.count()) { await tab.first().click(); await page.waitForTimeout(2500); await dismiss(); }
    else console.log('no tab', t);
    await page.screenshot({ path: `${prefix}-${t.toLowerCase()}.png` });
  }
  const info = await page.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, bodyScroll: document.body.scrollHeight, innerH: innerHeight, title: document.title }));
  console.log(JSON.stringify(info));
  console.log(errs.slice(0, 8).join('\n'));
  await browser.close();
})();
