import { politicalWarFixture } from "../src/engine/v2/politics-fixture";
import { writeFileSync, mkdirSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { SliceSimulation } from "../src/engine/v2/engine";
import { settlementScenario } from "../src/engine/v2/politics";
import { CompactLog, replayCompact } from "../src/engine/v2/compact-log";
import { validateCompact } from "../src/engine/v2/validate";
import { auditDailyCompact } from "../src/engine/v2/daily-audit";
import { Archive } from "../src/ui/v2/model";
const seed = process.argv[2];
const s =
  seed === "marco3-fixture-guerra"
    ? politicalWarFixture()
    : settlementScenario(seed, 40);
const warm = structuredClone(s);
warm.months = 12;
new SliceSimulation(warm).advance();
(globalThis as any).gc?.();
const t = performance.now();
const sim = new SliceSimulation(s);
sim.advance();
const coreMs = performance.now() - t;
const coreRss = process.resourceUsage().maxRSS * 1024;
const w = sim.runCompact();
const json = JSON.stringify(w);
const exportRss = process.resourceUsage().maxRSS * 1024;
mkdirSync("reports/m3-review", { recursive: true });
writeFileSync(`reports/m3-review/${seed}.world.json`, json);
writeFileSync(
  `reports/m3-review/${seed}.measurement.json`,
  JSON.stringify({
    seed,
    coreMs,
    coreRss,
    exportRss,
    jsonBytes: Buffer.byteLength(json),
  }),
);
console.log(JSON.stringify({ seed, phase: "motor", coreMs, coreRss }));
const events = [
  ...CompactLog.from(w.log).select(
    new Set([
      "scarcity.observed",
      "property.stolen",
      "theft.perceived",
      "dispute.proposed",
      "dispute.agreed",
      "dispute.unresolved",
      "war.declared",
      "war.rejected",
      "office.appointed",
      "person.died",
      "person.born",
      "guardianship.decided",
      "partnership.ended",
      "campaign.resolved",
      "campaign.ended",
      "political.notice.sent",
    ]),
  ),
];
const deaths = events.filter(
  (e) => e.type === "person.died" && e.data.conflict,
);
const deathIds = new Set(deaths.map((e) => e.id));
const custody = events.filter(
  (e) =>
    e.type === "guardianship.decided" && e.causes.some((c) => deathIds.has(c)),
);
const widows = events.filter(
  (e) => e.type === "partnership.ended" && deathIds.has(String(e.data.death)),
);
const archive = new Archive(w);
const war = events.find((e) => e.type === "war.declared");
const affected =
  widows
    .flatMap((e) => e.participants)
    .find((p) => !deaths.some((d) => d.data.victim === p.id))?.id ||
  custody[0]?.data.child ||
  deaths[0]?.data.victim;
const biographies = [war?.participants[0]?.id, affected]
  .filter((id): id is string => typeof id === "string")
  .map((id) => ({
    id,
    name: archive.name(id),
    paragraphs: archive.paragraphs(id),
  }));
const errors = [...validateCompact(w), ...auditDailyCompact(w)];
if (JSON.stringify(replayCompact(w)) !== JSON.stringify(w.entities))
  errors.push("Replay divergente");
const report = {
  seed,
  mode: s.mode,
  coreMs,
  coreRss,
  exportRss,
  jsonBytes: Buffer.byteLength(json),
  gzipBytes: gzipSync(json).length,
  events: w.log.rows.length,
  metrics: archive.populationMetrics(),
  births: events.filter((e) => e.type === "person.born").length,
  disputes: Object.values(w.entities).filter((e) => e.kind === "dispute")
    .length,
  agreements: events.filter((e) => e.type === "dispute.agreed").length,
  proposals: events.filter((e) => e.type === "dispute.proposed").length,
  unresolved: events.filter((e) => e.type === "dispute.unresolved").length,
  pending: Object.values(w.entities).filter(
    (e) => e.kind === "dispute" && e.status !== "closed",
  ).length,
  scarcity: events.filter((e) => e.type === "scarcity.observed").length,
  thefts: events.filter((e) => e.type === "property.stolen").length,
  stolenBooks: events.filter((e) => e.type === "property.stolen" && e.data.work)
    .length,
  perceivedThefts: events.filter((e) => e.type === "theft.perceived").length,
  uniqueOrphans: new Set(
    custody.filter((e) => e.data.orphan).map((e) => e.data.child),
  ).size,
  declarations: events.filter((e) => e.type === "war.declared").length,
  rejections: events
    .filter((e) => e.type === "war.rejected")
    .map((e) => e.data.reason),
  conflictDeaths: deaths.length,
  warWidows: widows.length,
  warCustody: custody.length,
  fullOrphans: custody.filter((e) => e.data.orphan).length,
  politicalEvents: events
    .filter((e) => !["person.born", "office.appointed"].includes(e.type))
    .map(({ id, month, type, participants, causes, data }) => ({
      id,
      month,
      type,
      participants,
      causes,
      data,
    })),
  biographies,
  errors,
};
writeFileSync(
  `reports/m3-review/${seed}.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    ...report,
    politicalEvents: undefined,
    biographies: biographies.map((b) => ({ id: b.id, name: b.name })),
    errors: errors.slice(0, 8),
  }),
);
if (errors.length) process.exitCode = 1;
