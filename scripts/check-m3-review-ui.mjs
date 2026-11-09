import { writeFileSync, readFileSync } from "node:fs";
const { chromium } = await import(
  process.env.CHRONICLE_PLAYWRIGHT_MODULE || "playwright"
);
const row = JSON.parse(
  readFileSync("reports/m3-review/marco3-livre-005.json", "utf8"),
);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const checks = [];
const assert = (ok, label) => {
  if (!ok) throw Error(label);
  checks.push(label);
};
try {
  const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    window.Worker = class {
      onmessage;
      postMessage(data) {
        fetch(`/reports/m3-review/${data.seed}.world.json`)
          .then((r) => r.json())
          .then((world) =>
            this.onmessage?.({ data: { type: "complete", world } }),
          );
      }
      terminate() {}
    };
  });
  await page.goto("http://127.0.0.1:5173");
  await page.locator("#seed").fill(row.seed);
  await page.locator("#start").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#status")
        .textContent.includes("História concluída"),
    {},
    { timeout: 60000 },
  );
  assert(
    (await page.locator("#settlements").textContent()).includes(
      "Vale do Cedro",
    ),
    "assentamentos nomeados",
  );
  assert(
    (await page.locator("#settlements p").count()) === 3,
    "três assentamentos",
  );
  for (const b of row.biographies) {
    await page.locator("#search").fill(b.id);
    await page.locator(`#person-list [data-person="${b.id}"]`).click();
    assert(
      !(await page.locator("#biography").textContent()).includes("undefined"),
      `${b.name}: prosa sem campos inexistentes`,
    );
    for (const s of await page.locator("#biography details summary").all())
      await s.click();
    const button = page.locator("#biography [data-why]").filter({
      hasText:
        b === row.biographies[0] ? "Declaração de conflito" : "Fim de parceria",
    });
    assert((await button.count())>0,`${b.name}: fonte causal encontrada`);
    {
      await button.first().click();
      assert(
        (await page.locator(".principal-chain").count()) === 1,
        `${b.name}: cadeia causal aberta`,
      );
      await page.locator("#close-why").click();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "móvel sem overflow",
  );
  assert(!errors.length, "sem erro JavaScript");
  await page.screenshot({
    path: "reports/m3-review/interface.png",
    fullPage: true,
  });
  writeFileSync(
    "docs/MARCO3-REVISAO-UI.json",
    JSON.stringify(
      {
        seed: row.seed,
        method: "Mundo salvo na interface real; nenhuma geração extra.",
        checks,
      },
      null,
      2,
    ),
  );
  console.log({ checks: checks.length });
} finally {
  await browser.close();
}
