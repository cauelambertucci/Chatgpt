import { verbs } from "../data/templates";
import type { World, Event, Person } from "../types";
import { entities } from "./world";
export function narrative(w: World, e: Event): string {
  const all = entities(w);
  const names = e.participants.map(
    (id) => all.find((a) => a.id === id)?.name || id,
  );
  const place = all.find((a) => a.id === e.location)?.name || "";
  const intro = [
    `No ano ${e.year}`,
    `Os registros do ano ${e.year} contam que`,
    `Durante o ano ${e.year}`,
  ][e.variant];
  return `${intro}, ${names.join(" e ")} ${(verbs[e.type] || ["marcaram a história"])[e.variant % 2]} em ${place}. ${e.consequences}`;
}
export function biography(w: World, p: Person) {
  const c = w.civs.find((c) => c.id === p.civ)!;
  return `${p.name}, ${p.role} de ${c.name}, nasceu no ano ${p.born}. De origem ${p.race.toLowerCase()}, era conhecido por seu temperamento ${p.traits.join(" e ")}. Desejava ${p.ambition}. ${p.died !== undefined ? `Morreu no ano ${p.died}, por ${p.cause}.` : "Seu nome permanece entre os vivos ao final desta crônica."} Sua trajetória reúne ${p.deeds.length} registros.`;
}
