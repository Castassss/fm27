const { chromium } = require(
  process.env.DRAW_PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "the-draw-ui-"));
const app = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
  env: { ...process.env, PORT: "31579" },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
const assert = require("node:assert/strict");
(async () => {
  await Promise.race([
    once(app.stdout, "data"),
    once(app, "exit").then(([code]) => {
      throw new Error("Application exited: " + code);
    }),
  ]);
  browser = await chromium.launch({
    headless: true,
    ...(process.env.DRAW_BROWSER_PATH
      ? { executablePath: process.env.DRAW_BROWSER_PATH }
      : {}),
    args: process.env.DRAW_NO_SANDBOX === "1" ? ["--no-sandbox"] : [],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__entropy = [];
    const native = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (array) => {
      const result = native(array);
      window.__entropy.push(...array);
      return result;
    };
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:31579");
  assert.equal(await page.locator(".journey-card").count(), 4);
  await page.screenshot({
    path: path.join(artifacts, "draw-v3-home.png"),
    fullPage: true,
  });
  await page.locator("#appearance").click();
  await page.locator('[data-theme-choice="mint"]').click();
  assert.equal(await page.locator("body").getAttribute("data-theme"), "mint");
  await page.locator("#settings-done").click();
  await page.reload();
  assert.equal(await page.locator("body").getAttribute("data-theme"), "mint");
  await page.locator("#appearance").click();
  await page.locator('[data-theme-choice="lavender"]').click();
  await page.locator("#settings-done").click();
  await page.locator('[data-challenge="academy"]').click();
  await page.locator('.step-footer [data-step="2"]').click();
  await page.locator('[data-country="Portugal"]').check();
  assert.match(await page.locator("#eligible-count").textContent(), /^12 /);
  assert.equal(await page.locator(".club-card").count(), 12);
  await page.locator('[data-toggle="Portugal-0"]').click();
  assert.match(await page.locator("#eligible-count").textContent(), /^11 /);
  await page.locator("#search").fill("Sporting");
  assert.equal(await page.locator(".club-card").count(), 1);
  assert.match(await page.locator("#eligible-count").textContent(), /^11 /);
  await page.locator("#include-visible").click();
  assert.match(await page.locator("#eligible-count").textContent(), /^12 /);
  await page.locator("#search").fill("");
  await page.locator("#save-selection").click();
  await page.locator("#selection-name").fill("A minha Liga Portugal");
  await page.locator("#save-form .primary").click();
  await page.locator('[data-view="collection"]').first().click();
  assert.equal(
    await page.locator("#saved-selections .collection-card").count(),
    1,
  );
  await page.locator("[data-load]").click();
  assert.match(await page.locator("#eligible-count").textContent(), /^12 /);
  await page.screenshot({
    path: path.join(artifacts, "draw-v3-selection.png"),
    fullPage: true,
  });
  for (const club of ["Portugal-0", "Portugal-1", "Portugal-2"])
    await page.locator(`[data-star="${club}"]`).click();
  await page.locator('.wizard-nav [data-step="1"]').click();
  await page.locator('[data-journey="shortlist"]').click();
  await page.locator('.step-footer [data-step="2"]').click();
  assert.equal(await page.locator(".club-card").count(), 3);
  assert.match(await page.locator("#eligible-count").textContent(), /^3 /);
  await page.locator("#go-ceremony").click();
  await page.locator("#focus").click();
  assert.equal(
    await page
      .locator("body")
      .evaluate((el) => el.classList.contains("cinema-mode")),
    true,
  );
  await page.locator("#stage-settings").click();
  await page.locator("#reduced-motion").check();
  await page.locator("#settings-done").click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .locator("body")
      .evaluate((el) => el.classList.contains("cinema-mode")),
    false,
  );
  await page.locator("#manual-mode").click();
  await page.evaluate(() => (window.__entropy = []));
  await page.locator("#draw").click();
  const expectedWinner = await page.evaluate(() => {
    const names = ["Sporting CP", "FC Porto", "SL Benfica"];
    let cursor = 0;
    for (let i = 2; i > 0; i--) {
      const limit = 4294967296 - (4294967296 % (i + 1));
      let value;
      do {
        value = window.__entropy[cursor++];
        if (value === undefined) throw Error("Missing entropy");
      } while (value >= limit);
      const j = value % (i + 1);
      [names[i], names[j]] = [names[j], names[i]];
    }
    return names.at(-1);
  });
  await page.locator("[data-cheer]").first().click();
  assert.equal(
    await page.locator('[data-cheer][aria-pressed="true"]').count(),
    1,
  );
  assert.equal(await page.locator("#remaining-count").textContent(), "3");
  await page.waitForTimeout(1000);
  assert.equal(await page.locator("#remaining-count").textContent(), "3");
  await page.locator("#next").click();
  assert.equal(await page.locator("#remaining-count").textContent(), "2");
  await page.locator("#next").click();
  assert.equal(await page.locator(".finalist").count(), 2);
  await page.screenshot({
    path: path.join(artifacts, "draw-v3-final.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.locator("#next").click();
  assert.equal(await page.locator("#remaining-count").textContent(), "1");
  await page.locator("#next").click();
  assert.equal(await page.locator("#history-count").textContent(), "1");
  await page.locator("#winner-dossier").waitFor();
  assert.equal(
    await page.locator("#stage-title").textContent(),
    expectedWinner,
  );
  assert.match(
    await page.locator("#winner-promise").textContent(),
    /3 jogadores/,
  );
  await page.locator("#accept-winner").click();
  assert.equal(await page.locator("#accept-winner").isDisabled(), true);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-winner").click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith(".svg"));
  const stream = await download.createReadStream();
  const buffers = [];
  for await (const buffer of stream) buffers.push(buffer);
  const svg = Buffer.concat(buffers).toString();
  assert.ok(svg.includes("O BANCO É TEU"));
  await page.screenshot({
    path: path.join(artifacts, "draw-v3-winner.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.locator('[data-view="collection"]').first().click();
  assert.equal(
    await page.locator("#accepted-saves .collection-card").count(),
    1,
  );
  await page.locator("#accepted-saves [data-detail]").click();
  await page.locator("#save-name").fill("Operação Academia");
  await page.locator("#rename-form button").click();
  await page.locator("#detail-dialog .dialog-close").click();
  assert.match(
    await page.locator("#accepted-saves h3").textContent(),
    /Operação Academia/,
  );
  await page.reload();
  await page.locator('[data-view="collection"]').first().click();
  assert.equal(
    await page.locator("#accepted-saves .collection-card").count(),
    1,
  );
  assert.equal(
    await page.locator("#saved-selections .collection-card").count(),
    1,
  );
  await page.locator(".data-manager summary").click();
  await page.locator("#import-file").setInputFiles({
    name: "clubs.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify(
        ["Alpha <Club>", "Beta", "Gamma", "Delta"].map((name) => ({
          name,
          country: "Portugal",
          league: "Teste",
        })),
      ),
    ),
  });
  await page.locator("#confirm-dialog").waitFor();
  await page.locator("#confirm-yes").click();
  assert.equal(
    await page.locator("#saved-selections .collection-card").count(),
    0,
  );
  assert.equal(
    await page.locator("#accepted-saves .collection-card").count(),
    1,
  );
  await page.locator('[data-view="draw"]').first().click();
  await page.locator('.wizard-nav [data-step="3"]').click();
  await page.locator("#auto-mode").click();
  await page.selectOption("#speed", "4");
  await page.locator("#draw").click();
  await page.locator(".arena.four-final").waitFor({ timeout: 8000 });
  assert.equal(await page.locator(".finalist").count(), 4);
  await page.locator(".arena.won").waitFor({ timeout: 15000 });
  assert.equal(await page.locator("#eliminated-count").textContent(), "3");
  assert.equal(await page.locator("#history-count").textContent(), "2");
  await page.locator("#manual-mode").click();
  await page.locator("#draw").click();
  await page.locator("#cancel").click();
  assert.equal(await page.locator("#history-count").textContent(), "2");
  assert.equal(await page.locator("#remaining-count").textContent(), "4");
  await page.locator('[data-view="collection"]').first().click();
  if (!(await page.locator("#restore-data").isVisible()))
    await page.locator(".data-manager summary").click();
  await page.locator("#restore-data").click();
  await page.locator("#confirm-yes").click();
  await page.locator('[data-view="draw"]').first().click();
  await page.locator('.wizard-nav [data-step="1"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(artifacts, "draw-v3-mobile-home.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.locator('[data-journey="world"]').click();
  await page.locator('.step-footer [data-step="2"]').click();
  await page.locator('[data-country="Portugal"]').check();
  await page.screenshot({
    path: path.join(artifacts, "draw-v3-mobile-selection.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.locator("#go-ceremony").click();
  await page.locator("#manual-mode").click();
  await page.locator("#draw").click();
  await page.locator("#next").click();
  assert.equal(await page.locator("#remaining-count").textContent(), "11");
  await page.screenshot({
    path: path.join(artifacts, "draw-v3-mobile-live.png"),
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.locator("#cancel").click();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: themed wizard, theme persistence, country selection, search independent from pool, clickable inclusion, named presets, shortlist, manual ceremony, finals, challenge, winner acceptance, SVG export, rename/persistence, import with confirmation, automatic final four, cancellation, restore, mobile, no JS errors",
  );
  console.log("Screenshots:", artifacts);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    if (app.exitCode === null && app.signalCode === null) {
      app.kill();
      await once(app, "exit");
    }
  });
