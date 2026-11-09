import { WorldArchive, categories } from "./world-model";
import { date } from "./model";
type Escape = (s: unknown) => string;
type Link = (id: string) => string;
const why = (id: string) =>
  `<button class="why" data-why="${id}">Por quê?</button>`;
export function mapHTML(v: WorldArchive, e: Escape) {
  const positions = [
      [160, 300],
      [450, 80],
      [740, 300],
    ],
    a = v.archive;
  return `<section class="atlas"><div class="section-heading"><div><p class="eyebrow">CEM ANOS, LUGARES CONECTADOS</p><h2>O mundo em perspectiva</h2></div><span class="badge">${v.settlements.length} assentamentos</span></div><p class="hint">Posições abstratas. Os marcadores indicam assentamentos envolvidos, não o local exato do acontecimento. Selecione um marcador para explorar suas causas.</p><svg class="world-map" viewBox="0 0 900 410" role="img" aria-label="Assentamentos e distâncias abstratas de viagem"><defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cad5cb"/></pattern></defs><rect width="900" height="410" fill="url(#grid)"/>${v
    .routes()
    .map((r) => {
      const i = v.settlements.indexOf(r.from),
        j = v.settlements.indexOf(r.to),
        [x, y] = positions[i],
        [xx, yy] = positions[j];
      return `<path d="M${x},${y} L${xx},${yy}" stroke="#8dada1" stroke-width="2" stroke-dasharray="7 7"/><text x="${(x + xx) / 2}" y="${(y + yy) / 2 - 12}" text-anchor="middle">${r.km} km · notícia ${r.noticeMonths} mês(es)</text>`;
    })
    .join("")}${v.settlements
    .map((s, i) => {
      const [x, y] = positions[i];
      return `<circle cx="${x}" cy="${y}" r="24" fill="#234e43"/><text x="${x}" y="${y + 6}" fill="white" text-anchor="middle">${i + 1}</text><text x="${x}" y="${y + 48}" text-anchor="middle" class="map-name">${e(s.name)}</text><text x="${x}" y="${y + 68}" text-anchor="middle">${v.population(s.id).length} pessoas vivas</text>`;
    })
    .join("")}</svg><div class="world-cards">${v.settlements
    .map(
      (s, i) =>
        `<article class="world-card"><p class="eyebrow">ASSENTAMENTO ${i + 1}</p><h3>${e(s.name)}</h3><div class="markers">${Object.entries(
          categories,
        )
          .map(([key, label]) => {
            const n = v.markers.filter(
              (m) => m.category === key && m.settlements.includes(s.id),
            ).length;
            return `<button data-map-settlement="${s.id}" data-category="${key}" ${n ? "" : "disabled"}>${label} <strong>${n}</strong></button>`;
          })
          .join(
            "",
          )}</div><button class="link" data-map-settlement="${s.id}">Explorar a história →</button></article>`,
    )
    .join(
      "",
    )}</div><p class="hint">Contagens incluem todo o período; um incidente pode envolver mais de um assentamento. Viagem de campanha: ${v
    .routes()
    .map(
      (r) => `${e(r.from.name)} ↔ ${e(r.to.name)}: ${r.campaignMonths} meses`,
    )
    .join("; ")}.</p></section>`;
}
export function settlementsHTML(v: WorldArchive, e: Escape, link: Link) {
  return `<section><h2>Assentamentos</h2><div class="world-cards">${v.settlements
    .map((s) => {
      const leader = v.currentLeader(s);
      return `<article class="world-card"><p class="eyebrow">${v.population(s.id).length} PESSOAS VIVAS</p><h3>${e(s.name)}</h3><p>${e(s.office)}: ${leader ? link(leader.id) : "cargo vago no fim da simulação"}</p>${leader ? `<p>Mandato até ${date(s.termEnd)}. ${why(s.mandate!)}</p>` : ""}<details><summary>Histórico de líderes (${v.terms.get(s.id)?.length || 0})</summary><ol>${(v.terms.get(s.id) || []).map((t) => `<li>${link(t.person)} · ${date(t.start)} — ${t.end === undefined ? "sem término registrado" : date(t.end)}<p>${e(t.reason)} ${why(t.source)} ${t.endSource ? why(t.endSource) : ""}</p></li>`).join("")}</ol></details><button class="link" data-map-settlement="${s.id}">Abrir linha do tempo →</button></article>`;
    })
    .join(
      "",
    )}</div><h3>Relações no fim da simulação</h3><p class="hint">Paz significa ausência de disputa ativa registrada; não implica tratado. Acordos têm fonte própria.</p>${v
    .relations()
    .map(
      (r) =>
        `<article class="relation"><span class="badge">${r.state.toUpperCase()}</span><div><h3>${e(r.from.name)} ↔ ${e(r.to.name)}</h3><p>${e(r.reason)} · ${r.disputes} disputas no histórico ${r.source ? why(r.source) : ""}</p></div></article>`,
    )
    .join("")}</section>`;
}
export function worksHTML(v: WorldArchive, e: Escape, link: Link) {
  return `<section><p class="eyebrow">OBJETOS QUE GUARDAM HISTÓRIAS</p><h2>Obras do mundo <small>(${v.works.length})</small></h2><div class="world-cards works-grid">${v.works.map((w) => `<article class="world-card"><p class="eyebrow">LIVRO · QUALIDADE ${w.quality}/100</p><h3>${e(v.archive.workTitle(w.id))}</h3><p>Criador: ${link(w.creator)} ${why(w.source)}</p><p>Tema: ${e(v.workTheme(w))} ${w.theme ? why(w.theme) : ""}</p><p>Dono: ${w.ownerEstate ? "espólio de " : ""}${w.owner ? link(w.owner) : "não registrado"}</p><details><summary>Histórico de custódia (${v.custody.get(w.id)?.length || 0})</summary><ol>${(v.custody.get(w.id) || []).map((c) => `<li>${date(c.month)} · <strong>${{ creation: "Criação", transfer: "Transferência", theft: "Roubo", estate: "Espólio" }[c.kind]}</strong>: ${c.previous ? link(c.previous) + " → " : ""}${link(c.owner)} ${why(c.source)}</li>`).join("")}</ol></details></article>`).join("") || "<p>Nenhuma obra registrada neste mundo.</p>"}</div></section>`;
}
