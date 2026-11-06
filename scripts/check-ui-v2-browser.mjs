import { writeFileSync, mkdirSync } from "node:fs";
const { chromium } = await import(
  process.env.CHRONICLE_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const results = [];
const assert = (ok, name) => {
  if (!ok) throw Error(name);
  results.push(name);
};
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:5173/");
  assert(
    (await page.locator("#seed").inputValue()) === "interface-2c-000",
    "seed inicial fixa",
  );
  await page.locator("#start").click();
  await page.waitForFunction(
    () => document.querySelector("#progress").value > 0,
    {},
    { timeout: 60000 },
  );
  assert(
    await page.locator("#start").isDisabled(),
    "geração desabilita início concorrente",
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector("#status")
        .textContent.includes("História concluída"),
    {},
    { timeout: 180000 },
  );
  const summary = await page.locator("#summary").textContent();
  assert(
    summary.includes("51 pessoas registradas"),
    "mesma população do exemplo Node 000",
  );
  await page.locator("#search").fill("nome-que-nao-existe");
  assert(
    (await page.locator("#person-list").textContent()).includes(
      "Nenhuma pessoa",
    ),
    "busca vazia",
  );
  await page.locator("#search").fill("");
  await page.locator("#filter-status").selectOption("alive");
  assert(
    (await page.locator(".life-status").count()) > 0 &&
      (await page.locator(".life-status").allTextContents()).every(
        (s) => s === "Viva",
      ),
    "filtro de vivas",
  );
  await page.locator("#filter-status").selectOption("dead");
  assert(
    (await page.locator(".life-status").allTextContents()).every(
      (s) => s === "Morta",
    ),
    "filtro de mortas",
  );
  await page.locator("#filter-status").selectOption("");
  await page.locator("#filter-generation").selectOption("1");
  assert(
    (await page.locator(".person-row small").count()) > 0 &&
      (await page.locator(".person-row small").allTextContents()).every((s) =>
        s.startsWith("Geração 1"),
      ),
    "filtro de geração",
  );
  await page.locator("#filter-generation").selectOption("");
  await page.locator("#filter-mutilated").selectOption("yes");
  assert(
    (await page.locator(".person-row small").allTextContents()).every((s) =>
      s.includes("Parte ausente"),
    ),
    "filtro de mutilação",
  );
  await page.locator("#filter-mutilated").selectOption("");
  await page.locator('#person-list [data-person="person:01"]').click();
  assert(
    (await page.locator("#person-detail").textContent()).includes(
      "Biografia documentada",
    ),
    "ficha biográfica",
  );
  await page.locator("#person-detail summary").click();
  assert(await page.locator(".tree").isVisible(), "árvore genealógica");
  await page.locator("#biography [data-why]").first().click();
  assert(await page.locator("#why").isVisible(), "Por quê abre explicação");
  const cause = page.locator("#why [data-why]").first();
  assert((await cause.count()) > 0, "causa real disponível");
  await cause.click();
  assert(
    (await page.locator("#why-body").textContent()).includes("event:"),
    "navegação causal",
  );
  await page.keyboard.press("Escape");
  assert(
    !(await page.locator("#why").isVisible()),
    "modal acessível por Escape",
  );
  await page.screenshot({
    path: "reports/ui-v2/interface-desktop.png",
    fullPage: true,
  });
  await page.locator("#timeline-tab").click();
  await page.locator("#all-events").check();
  assert(
    (await page.locator(".timeline-event").count()) === 40,
    "linha do tempo paginada",
  );
  const first = await page.locator(".timeline-event").first().textContent();
  await page.locator("#next-time").click();
  assert(
    (await page.locator(".timeline-event").first().textContent()) !== first,
    "próxima página temporal",
  );
  await page.locator("#people-tab").click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "layout móvel sem rolagem horizontal",
  );
  await page.screenshot({
    path: "reports/ui-v2/interface-mobile.png",
    fullPage: true,
  });
  await page.locator("#start").click();
  await page.locator("#cancel").click();
  assert(
    (await page.locator("#status").textContent()).includes("cancelada"),
    "cancelamento",
  );
  assert(
    (await page.locator("#summary").textContent()) === summary,
    "cancelamento conserva arquivo anterior",
  );
  await page.evaluate(() => {
    window.Worker = new Proxy(window.Worker, {
      construct() {
        throw new Error("falha simulada de inicialização");
      },
    });
  });
  await page.locator("#start").click();
  assert(
    (await page.locator("#status").textContent()).includes("falha simulada"),
    "falha exibe mensagem",
  );
  assert(
    (await page.locator("#summary").textContent()) === summary,
    "falha conserva arquivo anterior",
  );
  assert(errors.length === 0, "sem erros JavaScript não tratados");
  mkdirSync("docs", { recursive: true });
  writeFileSync(
    "docs/UI-V2-BROWSER.json",
    JSON.stringify(
      {
        seed: "interface-2c-000",
        browser: await browser.version(),
        summary,
        checks: results,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks: results.length, summary, errors }));
} finally {
  await browser.close();
}
