import { CompactLog, type CompactWorld } from "./compact-log";
/** Audit metadata and conservation without expanding person/body effects. */
export function auditDailyCompact(w: CompactWorld): string[] {
  if (!w.scenario.dailyLife) return [];
  const log = CompactLog.from(w.log),
    errors: string[] = [],
    stocks = new Map<string, { paper: number; ink: number }>(),
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
      stocks.set(String(d.household), {
        paper: Number(d.paper),
        ink: Number(d.ink),
      });
    }
    if (e.type === "occupation.care.offered") busy.add(`${actor}:${e.month}`);
    if (e.type === "activity.period" || e.type === "work.period")
      if (busy.has(`${actor}:${e.month}`))
        fail("Período de cuidado gasto novamente");
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
        receipt.type !== "information.received" ||
        receipt.participants[0]?.id !== actor ||
        receipt.data.offense !== d.theme ||
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
  for (const [id, owner] of owners) {
    const work = w.entities[id];
    if (work?.kind !== "work" || work.owner !== owner)
      errors.push(`${id}: dono divergente`);
  }
  return errors;
}
