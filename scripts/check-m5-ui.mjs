import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
const { chromium } = await import(process.env.CHRONICLE_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
mkdirSync("docs/screenshots/m5", { recursive: true });
const results = [];
try {
  for (const seed of [
    "marco3-livre-001",
    "marco3-livre-005",
    "marco3-livre-008",
  ]) {
    const page = await browser.newPage({
        viewport: { width: 1360, height: 1000 },
        acceptDownloads: true,
      }),
      errors = [];
    page.on("pageerror", (e) => {errors.push(String(e));console.error(String(e));});
    await page.goto("http://127.0.0.1:5174");
    await page.locator("#seed").fill(seed);
    page.setDefaultTimeout(120000);
    const start = Date.now();
    await page.locator("#start").click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#status")
          .textContent.includes("História concluída"),
      {},
      { timeout: 180000 },
    );
    const seconds = (Date.now() - start) / 1000;
    const assert = (ok, label) => {
      if (!ok) throw Error(seed + ": " + label);
    };
    assert((await page.locator(".world-map").count()) === 1, "mapa");
    if (seed.endsWith("005"))
      await page.screenshot({
        path: "docs/screenshots/m5/mapa.png",
        fullPage: true,
      });
    await page.locator("#settlements-tab").click();
    assert((await page.locator(".world-card").count()) === 3, "assentamentos");
    assert((await page.locator(".relation").count()) === 3, "relações");
    if (seed.endsWith("005"))
      await page.screenshot({
        path: "docs/screenshots/m5/assentamentos.png",
        fullPage: true,
      });
    await page.locator("#timeline-tab").click();
    await page.locator("#world-type").selectOption("war.declared");
    const wars = await page.locator(".timeline-event").count();
    assert(wars > 0, "guerras");
    await page.locator(".timeline-event .why").first().click();
    assert(await page.locator("#why").isVisible(), "causalidade");
    await page.locator("#close-why").click();
    await page.locator("#world-settlement").selectOption("settlement:0");
    assert(
      (await page.locator("#world-type").inputValue()) === "war.declared",
      "filtros combinados",
    );
    if (seed.endsWith("005"))
      await page.screenshot({
        path: "docs/screenshots/m5/linha-do-tempo.png",
        fullPage: true,
      });
    await page.locator("#works-tab").click();
    const works = await page.locator(".world-card").count();
    assert(works > 0, "obras");
    for (const d of await page.locator(".world-card details").all())
      await d.evaluate((n) => (n.open = true));
    assert(
      (await page.locator("#explore").textContent()).includes("Roubo"),
      "custódia roubada",
    );
    assert(
      !(await page.locator("#explore").textContent()).includes("undefined"),
      "campos válidos",
    );
    if (seed.endsWith("005"))
      await page.screenshot({
        path: "docs/screenshots/m5/obras.png",
        fullPage: true,
      });
    const worldDownload = page.waitForEvent("download");
    await page.locator("#export-world").click();
    const worldText = readFileSync(await (await worldDownload).path(), "utf8");
    assert(
      worldText.includes("## Cronologia") && worldText.includes("Causas:"),
      "exportar mundo",
    );
    await page.locator("#people-tab").click();
    const personDownload = page.waitForEvent("download");
    await page.locator("#export-person").click();
    assert(
      readFileSync(await (await personDownload).path(), "utf8").includes(
        "Fontes:",
      ),
      "exportar pessoa",
    );
    await page.locator("#profile").selectOption("epico");
    assert(
      (await page.locator("#estimate").textContent()).includes(
        "100 fundadores",
      ) &&
        (await page.locator("#estimate").textContent()).includes(
          "EXTRAPOLAÇÃO",
        ),
      "perfil",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#map-tab").click();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "mobile sem overflow",
    );
    if (seed.endsWith("005"))
      await page.screenshot({
        path: "docs/screenshots/m5/mobile.png",
        fullPage: true,
      });
    assert(!errors.length, errors.join("\n"));
    results.push({
      seed,
      seconds,
      wars,
      works,
      summary: await page.locator("#summary").textContent(),
      checks:
        "Worker real, mapa, assentamentos, relações, filtros, causalidade, custódia, exports, perfis, mobile",
      errors,
    });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
  writeFileSync(
    "docs/MARCO5-UI-VALIDACAO.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
