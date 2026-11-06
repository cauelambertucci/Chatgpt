import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createHash } from "node:crypto";
const { chromium } = await import(
  process.env.CHRONICLE_PLAYWRIGHT_MODULE || "playwright"
);
const active = process.argv.includes("--active");
const node = JSON.parse(
  readFileSync(
    active
      ? "docs/MARCO21-ACTIVE-BENCHMARK.json"
      : "docs/MARCO21-BENCHMARK.json",
    "utf8",
  ),
);
const rows = [];
function pss(root) {
  const pairs = execFileSync("ps", ["-eo", "pid=,ppid="], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((x) => x.trim().split(/\s+/).map(Number));
  const ids = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, parent] of pairs)
      if (ids.has(parent) && !ids.has(pid)) {
        ids.add(pid);
        changed = true;
      }
  }
  let kib = 0,
    count = 0,
    rssHighWaterKiB = 0;
  for (const pid of ids)
    try {
      const s = readFileSync(`/proc/${pid}/smaps_rollup`, "utf8");
      rssHighWaterKiB += Number(
        readFileSync(`/proc/${pid}/status`, "utf8").match(
          /^VmHWM:\s+(\d+)/m,
        )?.[1] || 0,
      );
      kib += Number(s.match(/^Pss:\s+(\d+)/m)?.[1] || 0);
      count++;
    } catch {}
  return { pssKiB: kib, rssHighWaterKiB, processes: count };
}
for (const mode of [...new Set(node.rows.map((r) => r.mode))]) {
  console.log("Browser", mode);
  const dir = join(node.scratch, mode);
  writeFileSync(
    join(dir, "browser.ts"),
    readFileSync("scripts/browser-memory-entry.ts"),
  );
  await build({
    entryPoints: [join(dir, "browser.ts")],
    outfile: join(dir, "browser.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "ChronicleMemory",
    target: "es2022",
    keepNames: true,
  });
  const server = await chromium.launchServer({
    executablePath: process.env.CHRONICLE_CHROMIUM || "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-precise-memory-info",
      "--js-flags=--max-old-space-size=4096",
    ],
  });
  const browser = await chromium.connect(server.wsEndpoint());
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  const samples = [];
  const sample = async (stage) => {
    const heap = await cdp.send("Runtime.getHeapUsage");
    const row = { stage, ...heap, ...pss(server.process().pid) };
    samples.push(row);
    return row;
  };
  try {
    await page.setContent(
      "<!doctype html><title>Chronicle memory benchmark</title><p>Memory diagnostic</p>",
    );
    await page.addScriptTag({
      content: readFileSync(join(dir, "browser.js"), "utf8"),
    });
    await page.evaluate(() => ChronicleMemory.setup());
    await cdp.send("HeapProfiler.collectGarbage");
    await sample("warmup-collected");
    await page.evaluate(() => ChronicleMemory.start());
    let timing;
    for (let month = 12; month <= 1200; month += 12) {
      timing = await page.evaluate((m) => ChronicleMemory.advance(m), month);
      await sample(`month-${month}`);
    }
    const snapshot = await page.evaluate(() => ChronicleMemory.snapshot());
    await sample("snapshot");
    const transfer = await page.evaluate(() => ChronicleMemory.transfer());
    await sample("receiver-clone-and-freeze");
    const exported = await page.evaluate(() => ChronicleMemory.exportJson());
    await sample("JSON-and-UTF8-held");
    const summary = await page.evaluate(() => ChronicleMemory.summary());
    const canonical = (_key, v) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(
            Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          )
        : v;
    const entitiesHash = createHash("sha256")
      .update(JSON.stringify(summary.entities, canonical))
      .digest("hex");
    rows.push({
      mode,
      version: await browser.version(),
      ...timing,
      ...snapshot,
      ...transfer,
      ...exported,
      entitiesHash,
      samples,
    });
    console.log(
      JSON.stringify({
        mode,
        ...timing,
        ...snapshot,
        ...transfer,
        ...exported,
        maxPssKiB: Math.max(...samples.map((x) => x.pssKiB)),
        maxHeapBytes: Math.max(...samples.map((x) => x.usedSize)),
      }),
    );
  } catch (e) {
    rows.push({ mode, error: String(e), samples });
    console.log(mode, String(e));
  } finally {
    await browser.close();
    await server.close();
  }
  writeFileSync(
    active ? "docs/MARCO21-ACTIVE-BROWSER.json" : "docs/MARCO21-BROWSER.json",
    JSON.stringify(
      {
        method:
          "Separate main-thread browser diagnostic; yearly yielding/sampling. PSS sums Chromium process tree. Snapshot + real cross-isolate receiver Worker + frozen payload + JSON string + UTF8 + Blob retained. Sum of per-process RSS high-water marks is a conservative non-simultaneous/shared-pages upper bound.",
        rows,
      },
      null,
      2,
    ),
  );
}
if (
  rows.some((r) => r.error) ||
  rows.some(
    (r) =>
      r.entitiesHash !== node.rows.find((n) => n.mode === r.mode).entitiesHash,
  )
)
  process.exitCode = 1;
