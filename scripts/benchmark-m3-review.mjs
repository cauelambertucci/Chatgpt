import { build } from "esbuild";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
const seed = process.argv[2] || "reservado-2b-006";
await build({
  entryPoints: ["scripts/m3-review-bench.ts"],
  outfile: "/tmp/m3-review-current.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
for (const [file, tag] of [
  ["scripts/baselines/m3-incidents-before.mjs", "reproduced-before"],
  ["/tmp/m3-review-current.mjs", "reproduced-after"],
])
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["--expose-gc", file, tag, seed], {
      stdio: "inherit",
    });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(Error(String(code))),
    );
  });
const before = JSON.parse(
    readFileSync("reports/m3-review/reproduced-before.bench.json", "utf8"),
  ),
  after = JSON.parse(
    readFileSync("reports/m3-review/reproduced-after.bench.json", "utf8"),
  );
if (before.hash !== after.hash)
  throw Error("Eventos/estado divergiram após otimização");
console.log({ beforeMs: before.ms, afterMs: after.ms, hash: after.hash });
