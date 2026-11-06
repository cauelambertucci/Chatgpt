import "./style.css";
import {
  Archive,
  lightScenario,
  date,
  eventLabel,
  type PeopleFilter,
} from "./model";
import { immutable, type CompactWorld } from "../../engine/v2/compact-log";
const root = document.querySelector<HTMLDivElement>("#app")!;
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
let archive: Archive | undefined,
  selected = "",
  view = "people",
  filters: PeopleFilter = {},
  personPage = 0,
  timelinePage = 0,
  bioPage = 0,
  allEvents = false;
let worker: Worker | undefined,
  run = 0;
root.innerHTML = `<header><a class="brand" href="/">✧ CHRONICLE WORLD</a><span class="edition">Arquivo de vidas · motor v2</span></header>
<main><section class="intro"><div><p class="eyebrow">CADA VIDA DEIXA UM REGISTRO</p><h1>Uma história, muitos caminhos.</h1><p>Explore pessoas, famílias e os acontecimentos que mudaram suas vidas.</p></div><span class="badge">Leve · 40 fundadores · 100 anos</span></section>
<form id="generate"><label for="seed">Seed do mundo</label><div class="generation-row"><input id="seed" value="interface-2c-000" required maxlength="120" autocomplete="off"><button id="start" class="primary">Gerar história</button><button id="cancel" type="button" hidden>Cancelar</button></div><div class="progress-row"><progress id="progress" max="1200" value="0" aria-label="Progresso da geração"></progress><output id="status" role="status" aria-live="polite">Pronto para gerar. Tudo acontece neste navegador.</output></div></form>
<section id="archive" hidden><div id="summary" class="summary"></div><nav aria-label="Explorar"><button id="people-tab" aria-pressed="true">Pessoas</button><button id="timeline-tab" aria-pressed="false">Linha do tempo</button></nav><div id="explore"></div></section><section id="empty" class="empty"><span>✧</span><h2>O arquivo ainda está em branco.</h2><p>Escolha uma seed e gere cem anos de história.<br>A mesma seed reproduz os mesmos acontecimentos.</p></section></main>
<dialog id="why" aria-labelledby="why-title"><div class="dialog-head"><h2 id="why-title">Por que aconteceu?</h2><button id="close-why" aria-label="Fechar explicação">Fechar</button></div><div id="why-body"></div></dialog>`;
const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
function status(s: string) {
  $("#status").textContent = s;
}
function busy(value: boolean) {
  $<HTMLButtonElement>("#start").disabled = value;
  $<HTMLInputElement>("#seed").disabled = value;
  $("#cancel").hidden = !value;
}
function stop() {
  run++;
  worker?.terminate();
  worker = undefined;
  busy(false);
  status("Geração cancelada. O arquivo anterior, se houver, foi mantido.");
}
$("#cancel").onclick = stop;
$("#generate").onsubmit = (e) => {
  e.preventDefault();
  const seed = $<HTMLInputElement>("#seed").value.trim();
  if (!seed) {
    status("Digite uma seed.");
    return;
  }
  const current = ++run;
  worker?.terminate();
  busy(true);
  $<HTMLProgressElement>("#progress").value = 0;
  status("Preparando o mundo…");
  const fail = (message: string) => {
    if (current !== run) return;
    worker?.terminate();
    worker = undefined;
    busy(false);
    status(
      `Não foi possível concluir: ${message}. O arquivo anterior foi mantido.`,
    );
  };
  try {
    const task = new Worker(
      new URL("../../engine/v2/worker.ts", import.meta.url),
      { type: "module" },
    );
    worker = task;
    task.onerror = (e) => {
      e.preventDefault();
      fail(e.message || "falha no Worker");
    };
    task.onmessageerror = () => fail("falha ao receber o mundo");
    task.onmessage = (e) => {
      if (current !== run) return;
      if (e.data.type === "progress") {
        $<HTMLProgressElement>("#progress").value = e.data.month;
        status(
          `Gerando: ${Math.floor(e.data.month / 12)} de 100 anos (${Math.floor(e.data.month / 12)}%).`,
        );
      }
      if (e.data.type === "error") fail(e.data.message);
      if (e.data.type === "complete") {
        task.terminate();
        worker = undefined;
        try {
          status("Organizando o arquivo…");
          const next = new Archive(immutable(e.data.world as CompactWorld));
          $<HTMLDialogElement>("#why").close();
          archive = next;
          selected = next.people[0]?.id || "";
          filters = {};
          personPage = timelinePage = bioPage = 0;
          view = "people";
          allEvents = false;
          $<HTMLProgressElement>("#progress").value = 1200;
          busy(false);
          status(`História concluída · seed ${next.world.scenario.seed}.`);
          render();
        } catch (error) {
          fail(error instanceof Error ? error.message : String(error));
        }
      }
    };
    task.postMessage({ ...lightScenario(seed), output: "compact" });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
};
$("#people-tab").onclick = () => {
  view = "people";
  render();
};
$("#timeline-tab").onclick = () => {
  view = "timeline";
  render();
};
$("#close-why").onclick = () => $<HTMLDialogElement>("#why").close();
const personLink = (id: string) =>
  archive!.world.entities[id]?.kind !== "person"
    ? esc(id)
    : `<button class="link" data-person="${esc(id)}">${esc(archive!.name(id))}</button>`;
function bind(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>("[data-person]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.person!;
        view = "people";
        bioPage = 0;
        render();
        $<HTMLDialogElement>("#why").close();
      }),
  );
  container
    .querySelectorAll<HTMLButtonElement>("[data-why]")
    .forEach((b) => (b.onclick = () => why(b.dataset.why!)));
}
function render() {
  if (!archive) return;
  $("#archive").hidden = false;
  $("#empty").hidden = true;
  const alive = archive.people.filter((p) => p.alive).length;
  $("#summary").textContent =
    `${archive.world.scenario.seed} · ${archive.people.length} pessoas registradas · ${alive} vivas · ${archive.people.length - alive} mortas · ${archive.world.log.rows.length.toLocaleString("pt-BR")} eventos`;
  $("#people-tab").setAttribute("aria-pressed", String(view === "people"));
  $("#timeline-tab").setAttribute("aria-pressed", String(view === "timeline"));
  if (view === "timeline") {
    timeline();
    return;
  }
  const generations = [
    ...new Set(archive.people.map((p) => archive!.generation(p.id))),
  ].sort((a, b) => (a ?? -1) - (b ?? -1));
  $("#explore").innerHTML =
    `<div class="people-layout"><aside class="people-panel"><h2>Pessoas</h2><label for="search">Buscar nome ou ID</label><input id="search" type="search" placeholder="Quem você procura?" value="${esc(filters.query || "")}"><div class="filters"><label>Situação<select id="filter-status"><option value="">Todas</option><option value="alive">Vivas</option><option value="dead">Mortas</option></select></label><label>Mutilação<select id="filter-mutilated"><option value="">Todas</option><option value="yes">Com parte ausente</option><option value="no">Sem parte ausente</option></select></label><label>Geração<select id="filter-generation"><option value="">Todas</option>${generations.map((g) => `<option value="${g}">${g === null ? "Desconhecida" : g === 0 ? "0 · Fundadores" : g}</option>`).join("")}</select></label></div><p class="hint">Mutilação = parte corporal registrada como ausente.</p><div id="person-list"></div></aside><article id="person-detail" class="detail"></article></div>`;
  for (const [key, id] of [
    ["status", "filter-status"],
    ["mutilated", "filter-mutilated"],
    ["generation", "filter-generation"],
  ] as const) {
    $<HTMLSelectElement>("#" + id).value = filters[key] || "";
    $("#" + id).onchange = () => {
      filters[key] = $<HTMLSelectElement>("#" + id).value;
      personPage = 0;
      list();
    };
  }
  $("#search").oninput = () => {
    filters.query = $<HTMLInputElement>("#search").value;
    personPage = 0;
    list();
  };
  list();
  detail();
}
function list() {
  const found = archive!.filter(filters),
    items = found.slice(personPage * 30, (personPage + 1) * 30);
  $("#person-list").innerHTML =
    `<p class="hint" role="status">${found.length} pessoas encontradas</p>${items.length ? items.map((p) => `<button class="person-row ${p.id === selected ? "selected" : ""}" data-person="${esc(p.id)}"><span><strong>${esc(p.name)}</strong><small>Geração ${archive!.generation(p.id) ?? "?"}${archive!.missing.has(p.id) ? " · Parte ausente" : ""}</small></span><span class="life-status">${p.alive ? "Viva" : "Morta"}</span></button>`).join("") : "<p>Nenhuma pessoa corresponde aos filtros.</p>"}<div class="pager"><button id="prev-person" ${personPage === 0 ? "disabled" : ""}>Anterior</button><span>${personPage + 1} / ${Math.max(1, Math.ceil(found.length / 30))}</span><button id="next-person" ${(personPage + 1) * 30 >= found.length ? "disabled" : ""}>Próxima</button></div>`;
  $("#prev-person").onclick = () => {
    personPage--;
    list();
  };
  $("#next-person").onclick = () => {
    personPage++;
    list();
  };
  bind($("#person-list"));
}
function tree(id: string, path = new Set<string>(), depth = 0): string {
  if (path.has(id)) return "<li>Referência cíclica: árvore interrompida.</li>";
  const l = archive!.life(id),
    parents = l?.parents || [];
  return `<li>${personLink(id)}${depth >= 3 ? (parents.length ? "<small> Abra esta pessoa para continuar a ascendência.</small>" : "") : parents.length ? `<ul>${parents.map((p) => tree(p, new Set(path).add(id), depth + 1)).join("")}</ul>` : "<small> Ascendência não registrada.</small>"}</li>`;
}
function detail() {
  const a = archive!,
    p = a.world.entities[selected];
  if (p?.kind !== "person") {
    $("#person-detail").textContent = "Escolha uma pessoa.";
    return;
  }
  const l = a.life(p.id),
    children = a.children.get(p.id) || [],
    events = a.biography(p.id),
    page = events.slice(bioPage * 20, (bioPage + 1) * 20);
  $("#person-detail").innerHTML =
    `<div class="eyebrow">FICHA PESSOAL · ${esc(p.id)}</div><h2>${esc(p.name)}</h2><p class="lead">${esc(a.introduction(p.id))}</p><div class="family"><div><h3>Responsáveis registrados</h3><p>${l?.guardians.length ? l.guardians.map(personLink).join(", ") : "Nenhum responsável registrado."}</p></div><div><h3>Parceria ao fim do período</h3><p>${l?.partner ? personLink(l.partner) : "Nenhuma parceria vigente registrada."}</p></div><div><h3>Filhos registrados (${children.length})</h3><p>${children.length ? children.map(personLink).join(", ") : "Nenhum filho registrado."}</p></div></div><details><summary>Árvore genealógica · ascendência</summary><ul class="tree">${tree(p.id)}</ul><p class="hint">Geração = maior distância até um fundador. Nenhum ancestral é criado para preencher lacunas.</p></details><h3>Biografia documentada</h3><p class="hint">Narrativa do arquivo, não uma reconstrução do que a pessoa sabia. Pode incluir registros de descendentes posteriores à sua morte. Cada trecho remete aos fatos e suas causas. ${events.length} registros; 20 por página.</p><div id="biography">${page.length ? page.map((e) => `<section class="bio-event"><p>${esc(a.narrate(e))}</p><button class="why" data-why="${e.id}">Por quê? <span>${e.id}</span></button></section>`).join("") : "<p>Não há eventos biográficos registrados.</p>"}</div><div class="pager"><button id="prev-bio" ${bioPage === 0 ? "disabled" : ""}>Trechos anteriores</button><span>${bioPage + 1} / ${Math.max(1, Math.ceil(events.length / 20))}</span><button id="next-bio" ${(bioPage + 1) * 20 >= events.length ? "disabled" : ""}>Próximos trechos</button></div>`;
  $("#prev-bio").onclick = () => {
    bioPage--;
    detail();
  };
  $("#next-bio").onclick = () => {
    bioPage++;
    detail();
  };
  bind($("#person-detail"));
}
function timeline() {
  const a = archive!,
    count = allEvents ? a.world.log.rows.length : a.highlights.length,
    start = timelinePage * 40;
  const ids = allEvents
    ? Array.from({ length: Math.min(40, count - start) }, (_, i) => start + i)
    : a.highlights.slice(start, start + 40);
  $("#explore").innerHTML =
    `<section class="timeline"><h2>Linha do tempo do mundo</h2><label class="check"><input id="all-events" type="checkbox" ${allEvents ? "checked" : ""}> Incluir todos os eventos, inclusive rotina mensal</label><p class="hint">${count.toLocaleString("pt-BR")} eventos · ordem cronológica e de resolução · 40 por página</p>${ids
      .map((i) => {
        const e = a.event(i)!;
        return `<article class="timeline-event"><time>${date(e.month)}</time><div><h3>${esc(eventLabel(e))}</h3><p>${esc(a.narrate(e))}</p><button class="why" data-why="${e.id}">Por quê? <span>${e.id}</span></button></div></article>`;
      })
      .join(
        "",
      )}<div class="pager"><button id="prev-time" ${timelinePage === 0 ? "disabled" : ""}>Anterior</button><span>${timelinePage + 1} / ${Math.max(1, Math.ceil(count / 40))}</span><button id="next-time" ${(timelinePage + 1) * 40 >= count ? "disabled" : ""}>Próxima</button></div></section>`;
  $("#all-events").onchange = () => {
    allEvents = $<HTMLInputElement>("#all-events").checked;
    timelinePage = 0;
    timeline();
  };
  $("#prev-time").onclick = () => {
    timelinePage--;
    timeline();
  };
  $("#next-time").onclick = () => {
    timelinePage++;
    timeline();
  };
  bind($("#explore"));
}
function why(id: string) {
  const a = archive!,
    e = a.event(id),
    dialog = $<HTMLDialogElement>("#why");
  if (!e) return;
  // Never touch e.effects: random effect expansion would replay a whole prefix.
  $("#why-body").innerHTML =
    `<p class="eyebrow">${esc(e.id)} · ${date(e.month)}</p><p>${esc(a.narrate(e))}</p><h3>Participantes registrados</h3><ul>${e.participants.map((p) => `<li>${personLink(p.id)} · ${esc(({ actor: "agente", target: "alvo", victim: "vítima", witness: "testemunha", reference: "referência", beneficiary: "beneficiário" } as const)[p.role])}</li>`).join("")}</ul>${e.decision ? `<h3>Decisão registrada</h3><p>${esc(a.name(e.decision.actor))}: ${esc(e.decision.chosen)}. ${esc(e.decision.reason)}</p><details><summary>Alternativas e escores registrados</summary><pre>${esc(JSON.stringify(e.decision.candidates, null, 2))}</pre></details>` : ""}<h3>Causas diretas (${e.causes.length})</h3>${
      e.causes.length
        ? `<ul class="causes">${e.causes
            .map((c) => {
              const cause = a.event(c);
              return `<li>${cause ? `<p>${esc(a.narrate(cause))}</p><button class="why" data-why="${esc(c)}">Examinar causa ${esc(c)}</button>` : `Referência não encontrada: ${esc(c)}`}</li>`;
            })
            .join("")}</ul>`
        : "<p>Este registro não tem causas anteriores informadas.</p>"
    }<details><summary>Campos originais do evento</summary><pre>${esc(JSON.stringify(e.data, null, 2))}</pre></details><p class="hint">As ligações são as causas gravadas pelo motor. A ordem temporal, sozinha, não estabelece causalidade.</p>`;
  bind($("#why-body"));
  if (!dialog.open) dialog.showModal();
  $("#why-body").scrollTop = 0;
}
