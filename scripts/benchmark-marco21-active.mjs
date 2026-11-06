// Controlled active comparison, separate from the three free batches.
import { build } from "esbuild";
import { readFileSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
const meta = JSON.parse(readFileSync("docs/MARCO21-BENCHMARK.json", "utf8")),
  rows = [];
for (const base of ["before", "after"]) {
  const mode = `${base}-active`,
    dir = join(meta.scratch, mode);
  cpSync(join(meta.scratch, base), dir, { recursive: true });
  const file = join(dir, "scenario.ts");
  writeFileSync(
    file,
    readFileSync(file, "utf8").replace(
      "return s;",
      `
 s.bodySimulation={care:false,maxExchanges:6,singleDuel:{attacker:s.offender,defender:s.victim,caregiver:s.helper,month:0}};
 const a=s.people.find(p=>p.id===s.offender)!,b=s.people.find(p=>p.id===s.victim)!,h=s.people.find(p=>p.id===s.helper)!;
 a.skill=900;b.skill=400;
 for(const p of [a,b]){p.hostility=100;Object.assign(p.traits,{coragem:90,orgulho:80,agressividade:70,cautela:20,compaixao:20});p.values.paz=0;}
 h.medicalSkill=80;h.canHelp=true;Object.assign(h.traits,{compaixao:100,coragem:90,cautela:0});h.values.solidariedade=100;
 for(const q of s.schedules)if([a.id,b.id,h.id].includes(q.id)){q.from=0;q.absentMonths=0;q.period=1;}
 return s;`,
    ),
  );
  await build({
    entryPoints: [join(dir, "runner.ts")],
    outfile: join(dir, "runner.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    keepNames: true,
  });
  const row = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--expose-gc",
        "--max-old-space-size=8192",
        join(dir, "runner.mjs"),
        "warm",
      ],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    let output = "";
    child.stdout.on("data", (s) => (output += s));
    child.on("error", reject);
    child.on("close", (code) =>
      code ? reject(Error(`exit ${code}`)) : resolve(JSON.parse(output)),
    );
  });
  if (row.duels < 1 || row.wounds < 1)
    throw Error("Active case did not exercise injury");
  if (base === "after" && !row.types["duel.choice"])
    throw Error("Active case did not exercise choices");
  rows.push({ mode, repetition: 1, ...row });
  writeFileSync(
    "docs/MARCO21-ACTIVE-BENCHMARK.json",
    JSON.stringify(
      {
        scratch: meta.scratch,
        method:
          "Controlled active comparison: same seed/100 founders/100 years, identical skill/personality/presence overrides, care disabled, social choices enabled. One repetition per model; not mass combat.",
        rows,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      mode,
      coreMs: row.coreMs,
      bytes: row.jsonBytes,
      duels: row.duels,
      wounds: row.wounds,
      deaths: row.deaths,
      choices: row.types["duel.choice"] || 0,
    }),
  );
}
