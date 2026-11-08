import { readFileSync, writeFileSync } from "node:fs";
import { CompactLog } from "../src/engine/v2/compact-log";
import { Archive } from "../src/ui/v2/model";
const seeds = ["reservado-2b-006", "reservado-2b-011", "reservado-2b-028"];
const rows = seeds.map((seed) => ({
  before: JSON.parse(
    readFileSync(`reports/economy-fix/${seed}.before.json`, "utf8"),
  ),
  after: JSON.parse(
    readFileSync(`reports/economy-fix/${seed}.after.json`, "utf8"),
  ),
}));
const closures = [];
for (const seed of seeds) {
  const w = JSON.parse(
      readFileSync(`reports/economy-fix/${seed}.after.world.json`, "utf8"),
    ),
    log = CompactLog.from(w.log),
    last = new Map<string, any>(),
    deaths = new Map<string, any>();
  for (const e of log.select(
    new Set(["household.consumption", "person.died"]),
  )) {
    if (e.type === "household.consumption")
      last.set(String(e.data.household), {
        month: e.month,
        residents: e.data.residents,
        source: e.id,
      });
    else
      deaths.set(String(e.data.victim), {
        month: e.month,
        cause: e.data.cause,
        source: e.id,
      });
  }
  const vacant = [...last]
    .filter(([, v]) => v.month < 1199)
    .map(([home, v]) => ({
      home,
      lastOccupiedMonth: v.month,
      lastConsumption: v.source,
      residents: v.residents.map((id: string) => ({
        id,
        death: deaths.get(id),
        diedAtClosure: deaths.get(id)?.month <= v.month + 1,
      })),
    }));
  closures.push({ seed, vacant });
}
const w = JSON.parse(
    readFileSync(
      "reports/economy-fix/reservado-2b-006.after.world.json",
      "utf8",
    ),
  ),
  a = new Archive(w),
  before = new Archive(
    JSON.parse(
      readFileSync("reports/marco2d2/reservado-2b-006.world.json", "utf8"),
    ),
  );
const alda = {
  before: {
    birth: before.life("person:17"),
    death: before.family.deaths.get("person:17")?.month,
    age: before.family.age(
      "person:17",
      before.family.deaths.get("person:17")!.month,
    ),
  },
  after: {
    birth: a.life("person:17"),
    death: a.family.deaths.get("person:17")?.month,
    age: a.family.age("person:17", a.family.deaths.get("person:17")!.month),
  },
};
const stories = ["person:17", "person:01"].map((id) => ({
  id,
  name: a.name(id),
  seed: seeds[0],
  paragraphs: a.paragraphs(id),
}));
writeFileSync(
  "docs/ECONOMIA-CORRIGIDA-DADOS.json",
  JSON.stringify(
    {
      method:
        "Três seeds fixas antes/depois; meses contados desde 1; média mensal sobre 1200 meses, incluindo meses vazios. Cultivadores únicos e períodos efetivamente trabalhados são distintos. Domicílio sobrevivente significa ainda ocupado aos 100 anos, sem redefinir o denominador.",
      rows,
      closures,
      alda,
    },
    null,
    2,
  ),
);
writeFileSync(
  "docs/ECONOMIA-CORRIGIDA-BIOGRAFIAS.json",
  JSON.stringify({ stories }, null, 2),
);
let md =
  "# Duas biografias após a correção econômica\n\nSeed `reservado-2b-006`; os mesmos Alda e Mael, sem seleção de outro resultado. Fontes completas no JSON e no Por quê?.\n";
for (const s of stories) {
  md += `\n## ${s.name}\n`;
  for (const p of s.paragraphs)
    md += `\n${p.phase ? `### ${p.phase}\n\n` : ""}${p.text}\n`;
}
writeFileSync("docs/ECONOMIA-CORRIGIDA-BIOGRAFIAS.md", md);
console.log({
  alda,
  stories: stories.map((s) => ({
    name: s.name,
    paragraphs: s.paragraphs.length,
    words: s.paragraphs
      .map((p) => p.text)
      .join(" ")
      .split(" ").length,
  })),
  survival: rows.map((r) => ({
    seed: r.after.seed,
    hungry: r.after.hungryHouseholds,
    occupied: r.after.occupiedAt100,
    initial: r.after.occupiedInitially,
  })),
});
