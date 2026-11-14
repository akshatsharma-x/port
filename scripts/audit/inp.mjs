/**
 * INP, measured (DESIGN.md §8.3 ≤ 150 ms): the Event Timing API over the site's own interactions —
 * a tear, a theme's POWER CYCLE, the grid, the terminal (open, type, run, close), the rail, CONNECT's
 * errors and typing — unthrottled or with the CPU slowed. INP is the worst interaction (each
 * interactionId's longest entry): with this few, the worst is the 98th percentile.
 * Used by scripts/audit/measure.mjs (the table) and scripts/audit-gate.mjs (the budget).
 */
export async function inp(browser, BASE, throttle) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("retrograde:booted", "1");
    window.__events = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.interactionId) window.__events.push({ id: e.interactionId, name: e.name, d: e.duration });
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${BASE}/?debug=1`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  const act = [];
  const step = async (label, fn) => {
    const before = await page.evaluate(() => window.__events.length);
    await fn();
    await page.waitForTimeout(700);
    act.push(label, before);
  };
  await step("nav: WORK (a tear)", () => page.locator(".hud-nav__link").first().click());
  await step("theme switch (POWER CYCLE)", () => page.locator(".front-panel input[value='amber']").evaluate((i) => i.click()));
  await step("theme back", () => page.locator(".front-panel input[value='phosphor']").evaluate((i) => i.click()));
  await step("grid toggle", () => page.keyboard.press("g"));
  await step("terminal open (~)", () => page.keyboard.press("~"));
  await step("terminal: type and run help", async () => {
    await page.keyboard.type("help");
    await page.keyboard.press("Enter");
  });
  await step("terminal close (Esc)", () => page.keyboard.press("Escape"));
  await step("rail: CONNECT (a tear)", () => page.locator('.section-rail__link[href="#connect"]').click());
  await step("CONNECT: empty submit (errors)", async () => {
    await page.locator("#cx-name").focus();
    await page.waitForTimeout(500);
    await page.locator(".teletype button[type=submit]").click();
  });
  await step("CONNECT: typing", () => page.locator("#cx-message").pressSequentially("hello there", { delay: 30 }));
  const events = await page.evaluate(() => window.__events);
  // INP: the worst interaction (each interactionId's longest entry); with this few, the worst is p98
  const byId = new Map();
  for (const e of events) byId.set(e.id, Math.max(byId.get(e.id) ?? 0, e.d));
  const all = [...byId.values()].sort((a, b) => b - a);
  await ctx.close();
  return { interactions: all.length, inpMs: Math.round(all[0] ?? 0), top3: all.slice(0, 3).map(Math.round) };
}
