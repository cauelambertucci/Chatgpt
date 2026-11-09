import { build } from "esbuild";
import { spawn } from "node:child_process";
await build({
  entryPoints: ["scripts/m3-case.ts"],
  outfile: "/tmp/m3-case.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
const seeds = process.argv.includes("--fixture") ? ["marco3-fixture-guerra"] : ["reservado-2b-006", "reservado-2b-011", "reservado-2b-028"];
for (const seed of seeds)
  await new Promise((resolve, reject) => {
    const p = spawn(
      process.execPath,
      ["--expose-gc", "/tmp/m3-case.mjs", seed],
      { stdio: "inherit" },
    );
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(Error(String(code))),
    );
  });
