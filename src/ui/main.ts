import "./style.css";
import type { World, Entity, Params, Event } from "../types";
import { entities } from "../engine/world";
import { parseWorld } from "../engine/validate";
import { narrative, biography } from "../engine/narrative";
import { eventTypes } from "../data/catalog";
import { ptBR as t } from "../data/strings";
import { mountMap, type Layer } from "./map";
const root = document.querySelector<HTMLDivElement>("#app")!;
let world: World | undefined,
  tab = 0,
  query = "",
  worker: Worker | undefined,
  map: ReturnType<typeof mountMap> | undefined;
let filters = { year: "", civ: "", type: "", person: "" };
const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const num = (n: number) => n.toLocaleString("pt-BR");
const link = (id: string) => {
  const e = world && entities(world).find((e) => e.id === id);
  return e
    ? `<button class="text-link" data-entity="${esc(id)}">${esc(e.name)}</button>`
    : "";
};
function toast(message: string) {
  document.querySelector("#toast")?.remove();
  const box = document.createElement("div");
  box.id = "toast";
  box.role = "status";
  box.textContent = message;
  document.body.append(box);
  setTimeout(() => box.remove(), 4500);
}
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function shell() {
  map?.destroy();
  root.innerHTML = `<aside class="sidebar"><a class="brand" href="#"><span class="brand-mark">✧</span><span>CHRONICLE<br><b>WORLD</b></span></a><div class="side-caption">UM MUNDO. MIL HISTÓRIAS.</div><button id="new" class="primary">＋ ${t.newWorld}</button><div class="nav-caption">EXPLORAR O MUNDO</div><nav>${t.nav.map((label, i) => `<button data-tab="${i}" class="nav-item ${tab === i ? "active" : ""}"><span>${t.navIcons[i]}</span>${label}${i === 2 && world ? `<small>${world.civs.length}</small>` : ""}</button>`).join("")}</nav><div class="side-bottom"><div class="world-dot"></div><div><b>${world ? "Atlas preservado" : "O atlas está despertando"}</b><small>${world ? `${num(world.params.years)} anos de história` : "Cada seed, um novo destino"}</small></div></div><div class="edition">CHRONICLE WORLD <span>V. 1.0</span></div></aside><main><header class="topbar"><div class="breadcrumb">Biblioteca de mundos <span>/</span> <b>${world ? esc(world.params.seed) : "Um novo começo"}</b></div><label class="search"><span>⌕</span><input id="search" placeholder="${t.search}" value="${esc(query)}" aria-label="Busca global"><kbd>/</kbd></label><button id="menu" class="icon-btn" aria-label="Salvar e exportar">⇩</button></header><section class="page"><div class="page-heading"><div><div class="eyebrow">${tab === 0 ? "CARTOGRAFIA & DESCOBERTA" : "ARQUIVOS DO MUNDO"}</div><h1>${query ? "Busca no atlas" : t.nav[tab]}</h1><p>${["Além de cada fronteira, uma história espera para ser descoberta.", "Os ecos de cada era, preservados em ordem.", "Povos que deram forma às fronteiras e ao destino.", "Vidas breves. Legados que atravessam os séculos.", "Objetos que carregam as memórias de um mundo.", "Onde as histórias encontram um lugar para existir.", "Antigas presenças nas margens do conhecido."][tab]}</p></div><button id="seed" class="seed-button" title="Copiar seed">⌘ <span>SEED</span> ${world ? esc(world.params.seed) : "…"} <span>⧉</span></button></div><div id="content"></div><footer><span>✧ Toda lenda começa em algum lugar.</span><span>DETERMINÍSTICO · LOCAL · SEU</span></footer></section></main><div id="overlay"></div>`;
  root.querySelector("#new")!.addEventListener("click", settings);
  root.querySelector(".brand")!.addEventListener("click", (e) => {
    e.preventDefault();
    tab = 0;
    query = "";
    shell();
  });
  root.querySelectorAll<HTMLElement>("[data-tab]").forEach(
    (el) =>
      (el.onclick = () => {
        tab = Number(el.dataset.tab);
        query = "";
        shell();
      }),
  );
  root.querySelector("#menu")!.addEventListener("click", fileMenu);
  root.querySelector("#seed")!.addEventListener("click", () => {
    if (world)
      navigator.clipboard
        .writeText(world.params.seed)
        .then(() => toast(t.copied))
        .catch(() => toast("Não foi possível copiar a seed."));
  });
  root.querySelector<HTMLInputElement>("#search")!.oninput = (e) => {
    query = (e.target as HTMLInputElement).value;
    renderContent();
  };
  renderContent();
}
const summary = () =>
  world
    ? `<div class="stats"><div><span>◷</span><section><small>ERA SIMULADA</small><b>${num(world.params.years)} <em>anos</em></b></section></div><div><span>⚑</span><section><small>CIVILIZAÇÕES</small><b>${world.civs.length} <em>povos</em></b></section></div><div><span>♙</span><section><small>FIGURAS HISTÓRICAS</small><b>${num(world.people.length)} <em>vidas</em></b></section></div><div><span>✦</span><section><small>ACONTECIMENTOS</small><b>${num(world.events.length)} <em>registros</em></b></section></div></div>`
    : "";
function renderContent() {
  map?.destroy();
  const content = root.querySelector("#content")!;
  if (!world) {
    content.innerHTML =
      '<div class="empty">✧<h2>Um mundo está prestes a nascer</h2><p>Preparando terras, povos e memórias…</p></div>';
    return;
  }
  if (query) {
    const found = entities(world).filter((e) =>
      e.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );
    content.innerHTML = `<div class="list-heading">${found.length} registros encontrados</div>${cards(found)}`;
    return;
  }
  if (tab === 0) {
    content.innerHTML =
      summary() +
      `<div class="atlas-layout"><section class="map-card"><div class="map-toolbar"><div><span class="live-dot"></span><b>Atlas de ${esc(world.params.seed)}</b><small>${world.params.size} × ${world.params.size}</small></div><select id="layer" aria-label="Camada do mapa">${Object.entries(
        t.layers,
      )
        .map(([key, label]) => `<option value="${key}">${label}</option>`)
        .join(
          "",
        )}</select></div><div class="canvas-wrap"><canvas id="map" aria-label="Mapa interativo: arraste para mover, use controles para ampliar" tabindex="0"></canvas><div class="compass">N<span>✥</span>S</div><div class="map-controls"><button id="zoom-in" aria-label="Ampliar">＋</button><button id="zoom-out" aria-label="Reduzir">−</button><button id="reset-map" aria-label="Centralizar mapa">⌖</button></div><div class="map-caption"><span>TERRA INCOGNITA</span><i>Cartas da última era</i></div><div id="hover">Arraste para explorar · clique para descobrir</div></div><div class="map-bottom"><label><input id="markers" type="checkbox" checked> Assentamentos & covis</label><span>● Capital <i>● Assentamento</i> ♧ Covil</span></div></section><aside class="atlas-side"><div class="panel"><div class="eyebrow">OS POVOS DESTA TERRA</div><h2>Reinos & fronteiras</h2><p>Cada cor, uma história compartilhada.</p>${world.civs.map((c) => `<button class="civ-row" data-entity="${c.id}"><span class="civ-icon" style="--civ:${c.color}">⚑</span><section><b>${esc(c.name)}</b><small>${esc(world!.cultures.find((u) => u.id === c.culture)!.race)} · ${esc(c.government)}</small></section><span>›</span></button>`).join("")}</div><div class="quote-card"><span>“</span><p>O tempo transforma terras em reinos,<br>e nomes em lendas.</p><small>FRAGMENTOS DO PRIMEIRO CRONISTA</small></div></aside></div><div class="recent-heading"><h2>Os últimos ecos</h2><button data-tab-link="1" class="text-link">Ver toda a crônica ↗</button></div><div class="recent-grid">${world.events.slice(-3).reverse().map(eventCard).join("")}</div>`;
    map = mountMap(root.querySelector("#map")!, world, detail, (text) => {
      root.querySelector("#hover")!.textContent = text;
    });
    root.querySelector<HTMLSelectElement>("#layer")!.onchange = (e) =>
      map?.layer((e.target as HTMLSelectElement).value as Layer);
    root
      .querySelector("#zoom-in")!
      .addEventListener("click", () => map?.zoom(1.2));
    root
      .querySelector("#zoom-out")!
      .addEventListener("click", () => map?.zoom(1 / 1.2));
    root
      .querySelector("#reset-map")!
      .addEventListener("click", () => map?.reset());
    root.querySelector<HTMLInputElement>("#markers")!.onchange = (e) =>
      map?.markers((e.target as HTMLInputElement).checked);
    root.querySelector<HTMLCanvasElement>("#map")!.onkeydown = (e) => {
      if (e.key === "+") map?.zoom(1.2);
      if (e.key === "-") map?.zoom(1 / 1.2);
    };
    root.querySelector("[data-tab-link]")!.addEventListener("click", () => {
      tab = 1;
      shell();
    });
  } else if (tab === 1) {
    content.innerHTML = `<div class="filterbar"><label>Ano<input id="filter-year" type="number" min="0" max="${world.params.years}" placeholder="Todos" value="${filters.year}"></label><label>Civilização<select id="filter-civ"><option value="">Todas</option>${world.civs.map((c) => `<option value="${c.id}" ${filters.civ === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label><label>Tipo<select id="filter-type"><option value="">Todos</option>${eventTypes.map((type) => `<option ${filters.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label>Pessoa<input id="filter-person" placeholder="Nome da figura…" value="${esc(filters.person)}"></label></div><div id="events"></div>`;
    for (const key of ["year", "civ", "type", "person"] as const)
      root.querySelector<HTMLInputElement | HTMLSelectElement>(
        `#filter-${key}`,
      )!.oninput = (e) => {
        filters[key] = (e.target as HTMLInputElement).value;
        renderEvents();
      };
    renderEvents();
  } else {
    const list: Entity[] =
      tab === 2
        ? world.civs
        : tab === 3
          ? world.people
          : tab === 4
            ? world.artifacts
            : tab === 5
              ? [...world.settlements, ...world.geography.regions]
              : world.creatures;
    content.innerHTML = `<div class="list-heading">${num(list.length)} registros preservados <span>Clique em um nome para seguir sua história</span></div>${cards(list)}`;
  }
}
function cards(list: Entity[]) {
  return list.length
    ? `<div class="entity-grid">${list.map((e) => `<button class="entity-card" data-entity="${esc(e.id)}"><span class="card-symbol">${e.kind === "pessoa" ? "♙" : e.kind === "artefato" ? "⚒" : e.kind === "criatura" ? "♧" : e.kind === "civilização" ? "⚑" : "⌂"}</span><small>${esc(e.kind)}</small><h2>${esc(e.name)}</h2><p>${"role" in e ? `${esc(e.role)} · ${e.born} – ${e.died ?? "presente"}` : "population" in e ? `${num(e.population)} habitantes` : "species" in e ? `${esc(e.species)} · ${e.slain !== undefined ? "derrotado" : "à espreita"}` : "material" in e ? `${esc(e.material)} · ano ${e.created}` : "Um lugar entre memórias e fronteiras"}</p><span class="card-more">Explorar registro ↗</span></button>`).join("")}</div>`
    : `<div class="empty">${t.empty}</div>`;
}
let pageLimit = 100;
function renderEvents() {
  if (!world) return;
  const list = world.events
    .filter(
      (e) =>
        (!filters.year || e.year === Number(filters.year)) &&
        (!filters.type || e.type === filters.type) &&
        (!filters.civ ||
          e.participants.includes(filters.civ) ||
          world!.settlements.find((s) => s.id === e.location)?.civ ===
            filters.civ) &&
        (!filters.person ||
          e.participants.some((id) =>
            world!.people
              .find((p) => p.id === id)
              ?.name.toLowerCase()
              .includes(filters.person.toLowerCase()),
          )),
    )
    .reverse();
  root.querySelector("#events")!.innerHTML =
    `<div class="list-heading">${num(list.length)} acontecimentos</div><div class="timeline">${list.slice(0, pageLimit).map(eventCard).join("") || t.empty}</div>${list.length > pageLimit ? '<button id="more" class="secondary">Mais 100 registros</button>' : ""}`;
  root.querySelector("#more")?.addEventListener("click", () => {
    pageLimit += 100;
    renderEvents();
  });
}
function eventCard(e: Event) {
  return `<article class="event-card"><div class="event-meta"><span>ANO ${e.year.toString().padStart(3, "0")}</span><small>${esc(e.type)}</small></div><h3>${e.participants.slice(0, 3).map(link).join('<span class="connector"> & </span>')}</h3><p>${esc(e.consequences)}</p><div class="event-place">⌖ ${link(e.location)}</div></article>`;
}
function detail(id: string) {
  if (!world) return;
  const e = entities(world).find((e) => e.id === id);
  if (!e) return;
  let body = "";
  if (e.kind === "civilização") {
    const culture = world.cultures.find((u) => u.id === e.culture)!;
    body = `<p>${esc(culture.name)} · ${esc(culture.race)} · ${esc(e.government)}</p><div class="detail-stat">${num(e.population)} <small>habitantes</small></div><h3>Capital e liderança</h3><p>${link(e.capital)} · ${link(e.leader)}</p><h3>Cultura & fé</h3><p>${esc([...culture.traits, ...culture.values].join(", "))}. ${esc(culture.religion)} cultua ${esc(culture.god)}.</p><p>Recursos: ${esc(e.resources.join(", "))}</p><h3>Relações diplomáticas</h3>${Object.entries(
      e.relations,
    )
      .map(
        ([id, status]) =>
          `<p>${link(id)} <span class="tag">${esc(status)}</span></p>`,
      )
      .join("")}<h3>Assentamentos</h3><p>${world.settlements
      .filter((s) => s.civ === e.id)
      .map((s) => link(s.id))
      .join(" · ")}</p>`;
  }
  if (e.kind === "pessoa") {
    body = `<p class="biography">${esc(biography(world, e))}</p><p>${link(e.civ)}</p><h3>Linhagem</h3><div class="family"><div>${e.parents.length ? e.parents.map(link).join(" + ") : "Ancestrais não registrados"}</div><span>│</span><div class="family-self">${esc(e.name)} ${e.spouse ? `＋ ${link(e.spouse)}` : ""}</div><span>│</span><div>${e.children.length ? e.children.map(link).join(" · ") : "Sem descendentes registrados"}</div></div><h3>Relações</h3>${
      Object.entries(e.relations)
        .map(([id, rel]) => `<p>${link(id)} · ${esc(rel)}</p>`)
        .join("") || "<p>Sem relações registradas.</p>"
    }<h3>Posses atuais</h3><p>${e.possessions.map(link).join(" · ") || "Nenhuma posse registrada."}</p>`;
  }
  if (e.kind === "artefato") {
    body = `<p>${esc(e.material)} · ${esc(e.properties)}</p><h3>Forjado por</h3><p>${link(e.creator)} · ano ${e.created}</p><h3>Posse atual</h3><p>${e.owner ? link(e.owner) : e.destroyed !== undefined ? "Destruído no ano " + e.destroyed : "Paradeiro desconhecido"}</p><h3>Proveniência completa</h3><div class="provenance">${e.provenance.map((p) => `<p><b>${p.year}</b> ${esc(p.action)} ${p.holder ? `→ ${link(p.holder)}` : ""}</p>`).join("")}</div>`;
  }
  if (e.kind === "assentamento") {
    body = `<p>${link(e.civ)} · fundado no ano ${e.founded}</p><div class="detail-stat">${num(e.population)} <small>habitantes</small></div><p>${e.abandoned !== undefined ? "Abandonado no ano " + e.abandoned : "Assentamento habitado"}</p><p>Coordenadas ${e.tile % world.params.size}, ${Math.floor(e.tile / world.params.size)}</p><p>Região: ${link(world.geography.tiles[e.tile].region)}</p>`;
  }
  if (e.kind === "região") {
    body = `<p>Uma das dezesseis regiões geográficas do atlas.</p><h3>Assentamentos</h3><p>${
      world.settlements
        .filter((s) => world!.geography.tiles[s.tile].region === id)
        .map((s) => link(s.id))
        .join(" · ") || "Nenhum assentamento registrado."
    }</p><h3>Covis</h3><p>${
      world.creatures
        .filter((m) => world!.geography.tiles[m.tile].region === id)
        .map((m) => link(m.id))
        .join(" · ") || "Sem covis conhecidos."
    }</p>`;
  }
  if (e.kind === "criatura") {
    body = `<p>${esc(e.species)}</p><h3>Covil</h3><p>${link(world.geography.tiles[e.tile].region)} · ${e.tile % world.params.size}, ${Math.floor(e.tile / world.params.size)}</p><p>${e.slain !== undefined ? `Derrotado no ano ${e.slain} por ${link(e.slayer!)}` : "Uma ameaça ainda viva neste mundo."}</p>`;
  }
  const history = world.events.filter(
    (event) =>
      event.participants.includes(id) ||
      event.location === id ||
      (e.kind === "região" &&
        world!.settlements.some(
          (s) =>
            s.id === event.location &&
            world!.geography.tiles[s.tile].region === id,
        )),
  );
  openOverlay(
    `<div class="drawer"><button class="close" data-close aria-label="Fechar ficha">×</button><div class="eyebrow">ARQUIVO · ${esc(e.kind)}</div><h2>${esc(e.name)}</h2>${body}<h3>Registros da história <small>(${history.length})</small></h3><div class="detail-history">${
      history
        .slice()
        .reverse()
        .slice(0, 100)
        .map(
          (event) =>
            eventCard(event) +
            `<p class="narrative">${esc(narrative(world!, event))}</p>`,
        )
        .join("") || "<p>Nenhum acontecimento registrado.</p>"
    }</div>${history.length > 100 ? "<p>Exibindo os 100 registros mais recentes. Consulte a linha do tempo para explorar a crônica.</p>" : ""}</div>`,
  );
}
let returnFocus: HTMLElement | null = null;
function openOverlay(html: string) {
  returnFocus = document.activeElement as HTMLElement;
  const overlay = root.querySelector("#overlay")!;
  overlay.innerHTML = `<div class="scrim" role="dialog" aria-modal="true" aria-label="Arquivo do mundo">${html}</div>`;
  overlay.querySelector(".scrim")!.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeOverlay();
  });
  overlay
    .querySelectorAll("[data-close]")
    .forEach((b) => b.addEventListener("click", closeOverlay));
  overlay.querySelector<HTMLElement>("input,button,select")?.focus();
}
function closeOverlay() {
  root.querySelector("#overlay")!.innerHTML = "";
  if (returnFocus?.isConnected) returnFocus.focus();
}
function randomSeed() {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `era-${bytes[0].toString(36)}-${bytes[1].toString(36)}`;
}
function settings() {
  const p = world?.params || {
    seed: "aurora",
    size: 128,
    years: 500,
    civs: 5,
    chaos: 0.5,
  };
  openOverlay(
    `<form id="settings" class="modal"><button type="button" class="close" data-close aria-label="Fechar">×</button><div class="eyebrow">O PRIMEIRO CAPÍTULO</div><h2>Dê origem a um mundo.</h2><p>Terras, povos e séculos de histórias. Tudo começa com uma seed.</p><label>Seed do mundo<div class="seed-input"><input name="seed" value="${esc(p.seed)}" required maxlength="200"><button type="button" id="random" title="Mundo aleatório">⤨</button></div></label><div class="form-grid"><label>Tamanho do mapa<select name="size">${[64, 128, 256].map((n) => `<option value="${n}" ${n === p.size ? "selected" : ""}>${n} × ${n}</option>`).join("")}</select></label><label>Duração da história<input name="years" type="number" min="50" max="1000" value="${p.years}" required></label><label>Civilizações<input name="civs" type="number" min="3" max="8" value="${p.civs}" required></label><label>Caos <output id="chaos-value">${Math.round(p.chaos * 100)}%</output><input name="chaos" type="range" min="0" max="1" step=".05" value="${p.chaos}"></label></div><p class="form-note">✧ A mesma seed e os mesmos parâmetros geram exatamente o mesmo mundo.</p><button class="primary" type="submit">✧ ${t.generate}</button></form>`,
  );
  const form = root.querySelector<HTMLFormElement>("#settings")!;
  root.querySelector("#random")!.addEventListener("click", () => {
    (form.elements.namedItem("seed") as HTMLInputElement).value = randomSeed();
  });
  form.querySelector<HTMLInputElement>("[name=chaos]")!.oninput = (e) => {
    root.querySelector("#chaos-value")!.textContent =
      `${Math.round(Number((e.target as HTMLInputElement).value) * 100)}%`;
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = new FormData(form);
    generate({
      seed: String(data.get("seed")).trim(),
      size: Number(data.get("size")),
      years: Number(data.get("years")),
      civs: Number(data.get("civs")),
      chaos: Number(data.get("chaos")),
    });
  };
}
function generate(params: Params) {
  worker?.terminate();
  openOverlay(
    `<div class="modal loading"><div class="loading-symbol">✧</div><div class="eyebrow">${t.loading}</div><h2>O tempo encontra seu caminho.</h2><p id="progress-label">Dando forma às terras…</p><progress id="progress" max="1" value="0"></progress><button id="cancel" class="secondary">Cancelar</button></div>`,
  );
  worker = new Worker(new URL("../engine/worker.ts", import.meta.url), {
    type: "module",
  });
  root.querySelector("#cancel")!.addEventListener("click", () => {
    worker?.terminate();
    closeOverlay();
    if (!world) settings();
  });
  worker.onmessage = (event) => {
    const data = event.data;
    if (data.error) {
      closeOverlay();
      toast(data.error);
      worker?.terminate();
      return;
    }
    if (data.world) {
      world = data.world;
      worker?.terminate();
      tab = 0;
      query = "";
      filters = { year: "", civ: "", type: "", person: "" };
      shell();
    } else {
      const progress = root.querySelector<HTMLProgressElement>("#progress");
      if (progress) progress.value = data.progress;
      const label = root.querySelector("#progress-label");
      if (label)
        label.textContent =
          data.progress < 0.3
            ? "Desenhando rios e montanhas…"
            : `Preservando as memórias · ${Math.floor(data.progress * 100)}%`;
    }
  };
  worker.onerror = () => {
    worker?.terminate();
    closeOverlay();
    toast("Falha ao gerar o mundo. Tente novamente.");
  };
  worker.postMessage(params);
}
function fileMenu() {
  openOverlay(
    `<div class="modal file-menu"><button class="close" data-close aria-label="Fechar">×</button><div class="eyebrow">BIBLIOTECA PESSOAL</div><h2>Preserve este mundo.</h2><p>Seus arquivos ficam com você. Nenhum dado é enviado a um servidor.</p>${[
      ["export", t.export],
      ["chronicle", t.chronicle],
      ["save", t.save],
      ["load", t.load],
      ["import", t.import],
    ]
      .map(
        ([id, label]) =>
          `<button class="secondary" id="file-${id}">${label} ↗</button>`,
      )
      .join(
        "",
      )}<input type="file" id="file-input" accept="application/json,.json" hidden></div>`,
  );
  root.querySelector("#file-export")!.addEventListener("click", () => {
    if (world)
      download(
        JSON.stringify(world),
        "chronicle-world.json",
        "application/json",
      );
  });
  root.querySelector("#file-chronicle")!.addEventListener("click", () => {
    if (world)
      download(
        `# Chronicle World — ${world.params.seed}\n\n${world.params.years} anos · ${world.civs.length} civilizações\n\n` +
          world.events.map((e) => narrative(world!, e)).join("\n\n"),
        "cronica.md",
        "text/markdown",
      );
  });
  root.querySelector("#file-save")!.addEventListener("click", () => {
    try {
      if (world) {
        localStorage.setItem("chronicle-world", JSON.stringify(world));
        toast(t.saved);
      }
    } catch {
      toast(
        "Armazenamento insuficiente. Exporte o JSON para preservar o mundo.",
      );
    }
  });
  root.querySelector("#file-load")!.addEventListener("click", () => {
    try {
      const saved = localStorage.getItem("chronicle-world");
      if (!saved) throw Error("Nenhum mundo salvo neste navegador.");
      world = parseWorld(saved);
      query = "";
      tab = 0;
      shell();
      toast(t.imported);
    } catch (error) {
      toast((error as Error).message);
    }
  });
  const input = root.querySelector<HTMLInputElement>("#file-input")!;
  root
    .querySelector("#file-import")!
    .addEventListener("click", () => input.click());
  input.onchange = async () => {
    try {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 50_000_000)
        throw Error("Arquivo muito grande (máximo 50 MB)");
      const loaded = parseWorld(await file.text());
      world = loaded;
      tab = 0;
      query = "";
      shell();
      toast(t.imported);
    } catch (error) {
      toast((error as Error).message);
    }
  };
}
root.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-entity]",
  );
  if (target) detail(target.dataset.entity!);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    const overlay = root.querySelector("#overlay .scrim");
    if (overlay) {
      const items = Array.from(
        overlay.querySelectorAll<HTMLElement>("button,input,select,[tabindex]"),
      ).filter((el) => !el.hasAttribute("hidden"));
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
  if (e.key === "Escape") closeOverlay();
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)
  ) {
    e.preventDefault();
    root.querySelector<HTMLInputElement>("#search")?.focus();
  }
});
shell();
generate({ seed: "aurora", size: 128, years: 500, civs: 5, chaos: 0.5 });
