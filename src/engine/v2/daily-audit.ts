import { themeProof } from "./writing";
import { CompactLog, type CompactWorld } from "./compact-log";
/** Audit metadata and conservation without expanding person/body effects. */
export function auditDailyCompact(w: CompactWorld): string[] {
  if (!w.scenario.dailyLife) return [];
  const log = CompactLog.from(w.log),
    errors: string[] = [],
    stocks = new Map<string, { paper: number; ink: number }>(),
    raw = new Map<string, { fiber: number; pigment: number }>(),
    periods = new Map<string, number>(),
    owners = new Map<string, string>(),
    busy = new Set<string>();
  for (let i = 0; i < w.log.rows.length; i++) {
    const e = log.event(i),
      d = e.data,
      actor = e.participants.find((p) => p.role === "actor")?.id;
    const fail = (reason: string) => errors.push(`${e.id}: ${reason}`);
    if (e.type === "household.materials.declared") {
      if (stocks.has(String(d.household))) fail("Estoque declarado duas vezes");
      if (d.inventory)
        raw.set(String(d.household), {
          fiber: Number((d.inventory as any).fiber),
          pigment: Number((d.inventory as any).pigment),
        });
      stocks.set(String(d.household), {
        paper: Number(d.paper),
        ink: Number(d.ink),
      });
    }
    if (e.type === "livelihood.period" && d.task === "fabricar") {
      const stock = stocks.get(String(d.household)),
        r = d.recipe as {
          paper: number;
          ink: number;
          take: { fiber?: number; pigment?: number };
        };
      const material = raw.get(String(d.household));
      if (r.paper || r.ink) {
        if (
          !material ||
          r.paper !== (r.take.fiber || 0) ||
          r.ink !== (r.take.pigment || 0)
        )
          fail("Receita sem matéria-prima correspondente");
        else {
          material.fiber -= r.take.fiber || 0;
          material.pigment -= r.take.pigment || 0;
          if (material.fiber < 0 || material.pigment < 0)
            fail("Matéria-prima negativa");
        }
      }
      if (!stock) fail("Produção sem estoque inicial");
      else {
        stock.paper += r.paper;
        stock.ink += r.ink;
      }
    }
    if (
      [
        "occupation.care.offered",
        "activity.period",
        "work.period",
        "livelihood.period",
      ].includes(e.type)
    ) {
      const key = `${actor}:${e.month}`;
      if (busy.has(key)) fail("Mês de trabalho gasto novamente");
      busy.add(key);
    }
    if (e.type === "work.started") {
      const stock = stocks.get(String(d.household));
      if (!stock) fail("Domicílio sem estoque declarado");
      else {
        stock.paper -= Number(d.paper);
        stock.ink -= Number(d.ink);
        if (stock.paper < 0 || stock.ink < 0) fail("Estoque negativo");
      }
      const index = Number(String(d.knowledgeSource).slice(6));
      const receipt =
        Number.isInteger(index) && index < i ? log.event(index) : undefined;
      if (
        !receipt ||
        !themeProof(actor!, String(d.theme), receipt) ||
        !e.causes.includes(receipt.id)
      )
        fail("Tema sem prova causal de conhecimento anterior");
    }
    if (e.type === "work.period")
      periods.set(String(d.goal), (periods.get(String(d.goal)) || 0) + 1);
    if (e.type === "work.created") {
      if (periods.get(String(d.goal)) !== 6)
        fail("Livro sem seis períodos de trabalho");
      if (owners.has(String(d.work))) fail("Obra duplicada");
      owners.set(String(d.work), actor!);
    }
    if (e.type === "work.transferred") {
      if (owners.get(String(d.work)) !== d.from)
        fail("Transferência por quem não é dono");
      owners.set(String(d.work), String(d.to));
    }
  }
  for (const [id, stock] of stocks) {
    const h = w.entities[id];
    if (
      h?.kind !== "household" ||
      JSON.stringify(h.writingStock) !== JSON.stringify(stock)
    )
      errors.push(`${id}: saldo divergente`);
  }
  for (const [id, balance] of raw) {
    const h = w.entities[id];
    if (
      h.kind !== "household" ||
      h.inventory?.fiber !== balance.fiber ||
      h.inventory?.pigment !== balance.pigment
    )
      errors.push(`${id}: matéria-prima divergente`);
  }
  for (const [id, owner] of owners) {
    const work = w.entities[id];
    if (work?.kind !== "work" || work.owner !== owner)
      errors.push(`${id}: dono divergente`);
  }
  return errors;
}
