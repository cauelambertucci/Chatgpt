import "./style.css";
import {
  Archive,
  lightScenario,
  date,
  eventLabel,
  type PeopleFilter,
} from "./model";
import { readable } from "./labels";
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
let treeMode = "ancestors";
let worker: Worker | undefined,
  run = 0;
root.innerHTML = `<header><a class="brand" href="/">✧ CHRONICLE WORLD</a><span class="edition">Arquivo de vidas · motor v2</span></header>
<main><section class="intro"><div><p class="eyebrow">CADA VIDA DEIXA UM REGISTRO</p><h1>Uma história, muitos caminhos.</h1><p>Explore pessoas, famílias e os acontecimentos que mudaram suas vidas.</p></div><span class="badge">Leve · 40 fundadores · 100 anos</span></section>
<form id="generate"><label for="seed">Seed do mundo</label><div class="generation-row"><input id="seed" value="reservado-2b-006" required maxlength="120" autocomplete="off"><button id="start" class="primary">Gerar história</button><button id="cancel" type="button" hidden>Cancelar</button></div><div class="progress-row"><progress id="progress" max="1200" value="0" aria-label="Progresso da geração"></progress><output id="status" role="status" aria-live="polite">Pronto para gerar. Tudo acontece neste navegador.</output></div></form>
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
  const alive = archive.people.filter((p) => archive!.isAlive(p.id)).length;
  $("#summary").textContent =
    `${archive.world.scenario.seed} · ${archive.people.length} pessoas registradas · ${alive} vivas · ${archive.family.deaths.size} mortas · ${archive.world.log.rows.length.toLocaleString("pt-BR")} eventos`;
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
    `<p class="hint" role="status">${found.length} pessoas encontradas</p>${items.length ? items.map((p) => `<button class="person-row ${p.id === selected ? "selected" : ""}" data-person="${esc(p.id)}"><span><strong>${esc(archive!.name(p.id))}</strong><small>Geração ${archive!.generation(p.id) ?? "?"}${archive!.missing.has(p.id) ? " · Parte ausente" : ""}</small></span><span class="life-status">${archive!.isAlive(p.id) ? "Viva" : archive!.family.deaths.has(p.id) ? "Morta" : "Não registrada"}</span></button>`).join("") : "<p>Nenhuma pessoa corresponde aos filtros.</p>"}<div class="pager"><button id="prev-person" ${personPage === 0 ? "disabled" : ""}>Anterior</button><span>${personPage + 1} / ${Math.max(1, Math.ceil(found.length / 30))}</span><button id="next-person" ${(personPage + 1) * 30 >= found.length ? "disabled" : ""}>Próxima</button></div>`;
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
  const a = archive!,
    ids =
      treeMode === "descendants"
        ? a.children.get(id) || []
        : a.family.parents(id);
  return `<li>${personLink(id)} <small>${esc(a.lifeSpan(id))}</small>${depth >= 3 ? (ids.length ? "<small> Abra esta pessoa para continuar a árvore.</small>" : "") : ids.length ? `<ul>${ids.map((p) => tree(p, new Set(path).add(id), depth + 1)).join("")}</ul>` : `<small>${treeMode === "descendants" ? " Nenhum descendente direto registrado." : " Ascendência não registrada."}</small>`}</li>`;
}
function genealogy() {
  const a = archive!;
  if (treeMode === "relations") {
    const siblings = a.family.siblings(selected),
      partners = [
        ...new Set(
          a.family
            .partners(selected)
            .flatMap((p) => p.people.filter((id) => id !== selected)),
        ),
      ];
    $("#genealogy-tree").innerHTML = [
      ["Irmãos (ao menos um progenitor em comum)", siblings],
      ["Parceiros de todo o histórico", partners],
    ]
      .map(
        ([title, ids]) =>
          `<h4>${title}</h4><ul>${(ids as string[]).length ? (ids as string[]).map((id) => `<li>${personLink(id)} <small>${esc(a.lifeSpan(id))}</small></li>`).join("") : "<li>Sem vínculo registrado nesta categoria.</li>"}</ul>`,
      )
      .join("");
  } else
    $("#genealogy-tree").innerHTML = `<ul class="tree">${tree(selected)}</ul>`;
  bind($("#genealogy-tree"));
}
function detail() {
  const a = archive!,
    p = a.world.entities[selected];
  if (p?.kind !== "person") {
    $("#person-detail").textContent = "Escolha uma pessoa.";
    return;
  }
  const parents = a.family.parents(p.id),
    custody = a.family.custody.get(p.id) || [],
    children = a.children.get(p.id) || [],
    partnerships = a.family.partners(p.id),
    paragraphs = a.paragraphs(p.id),
    page = paragraphs.slice(bioPage * 10, (bioPage + 1) * 10);
  $("#person-detail").innerHTML =
    `<div class="eyebrow">FICHA PESSOAL</div><h2>${esc(a.name(p.id))}</h2><p class="lead">${esc(a.lifeSpan(p.id))} · geração ${a.generation(p.id) ?? "não determinada"}</p>
  ${p.occupation ? `<p><strong>${a.isAlive(p.id)?'Ofício registrado':'Último ofício registrado'}:</strong> ${esc(p.occupation)} <button class="why" data-why="${p.lastBy.occupation}">Por quê?</button></p>` : ''}
  ${Object.values(a.world.entities).filter(e=>e.kind==='work'&&(e.creator===p.id||e.owner===p.id)).map(e=>e.kind==='work'?`<p><strong>${esc(e.name)}</strong> · qualidade ${e.quality}/100 · criador: ${personLink(e.creator)} · dono: ${e.ownerEstate?'espólio de ':''}${personLink(e.owner||e.creator)} <button class="why" data-why="${e.source}">Por quê? Criação</button>${e.ownerSource&&e.ownerSource!==e.source?` <button class="why" data-why="${e.ownerSource}">Por quê? Propriedade</button>`:''}</p>`:'').join('')}
  <div class="family"><div><h3>Pais biológicos</h3><p>${parents.length ? parents.map(personLink).join(" e ") : "Ascendência não registrada; nenhum ancestral foi inventado."}</p></div><div><h3>Histórico de guarda</h3>${custody.length ? `<ul>${custody.map((c) => `<li>${date(c.month)}: ${c.guardians.length ? c.guardians.map(personLink).join(", ") : "guarda sem adulto indicado neste registro"} <button class="why" data-why="${c.source}">Por quê?</button></li>`).join("")}</ul>` : `<p>${parents.length ? "Os pais biológicos estão identificados acima; a guarda não foi especificada nos eventos." : "Guarda não documentada nos eventos."}</p>`}</div></div>
  <h3>Todos os filhos biológicos (${children.length})</h3><div class="table-scroll"><table id="children-table"><thead><tr><th>Pessoa</th><th>Nascimento</th><th>Estado, morte e idade</th></tr></thead><tbody>${children
    .map((id) => {
      const b = a.life(id),
        d = a.family.deaths.get(id),
        age = d ? a.family.age(id, d.month) : undefined;
      return `<tr><td>${personLink(id)}</td><td>${b?.month === undefined ? "Não registrado" : `Ano ${Math.floor(b.month / 12)}`}</td><td>${d ? `Morta · ano ${Math.floor(d.month / 12)}${age === undefined ? " · idade desconhecida" : ` · ${age} anos`}` : "Viva"}</td></tr>`;
    })
    .join(
      "",
    )}</tbody></table></div>${children.length ? "" : "<p>Nenhum nascimento com filiação biológica desta pessoa foi registrado.</p>"}
  <h3>Todas as parcerias (${partnerships.length})</h3><div class="table-scroll"><table id="partnership-table"><thead><tr><th>Parceiro</th><th>Início</th><th>Fim</th><th>Motivo / situação</th></tr></thead><tbody>${partnerships
    .map(
      (q) =>
        `<tr><td>${q.people
          .filter((id) => id !== p.id)
          .map(personLink)
          .join(
            ", ",
          )}</td><td>${q.start === undefined ? "Não registrado" : date(q.start)}</td><td>${q.end === undefined ? "Sem término registrado" : date(q.end)}</td><td>${esc(a.partnershipReason(q))} <button class="why" data-why="${q.endSource || q.source}">Por quê?</button></td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div>${partnerships.length ? "" : "<p>Nenhuma parceria foi registrada.</p>"}
  <section class="genealogy"><h3>Árvore genealógica</h3><label for="tree-mode">Explorar relações</label><select id="tree-mode"><option value="ancestors">Ascendência</option><option value="descendants">Descendência</option><option value="relations">Irmãos e parceiros</option></select><div id="genealogy-tree"></div><p class="hint">Datas e vínculos vêm dos eventos. Os fundadores permanecem raízes sem ancestrais inventados.</p></section>
  <h3>Biografia</h3><p class="hint">Prosa baseada em fatos registrados. Conhecimento e emoção só aparecem quando há registro de percepção. Cada parágrafo permite consultar suas fontes.</p><div id="biography">${page.map((paragraph) => `<section class="bio-paragraph"><p>${esc(paragraph.text)}</p><div class="sources">${paragraph.sources.map((id) => `<button class="why" data-why="${id}">Por quê? · ${esc(eventLabel(a.event(id)!))}</button>`).join(" ")}</div></section>`).join("")}</div><div class="pager"><button id="prev-bio" ${bioPage === 0 ? "disabled" : ""}>Trechos anteriores</button><span>${bioPage + 1} / ${Math.max(1, Math.ceil(paragraphs.length / 10))}</span><button id="next-bio" ${(bioPage + 1) * 10 >= paragraphs.length ? "disabled" : ""}>Próximos trechos</button></div>`;
  $<HTMLSelectElement>("#tree-mode").value = treeMode;
  $("#tree-mode").onchange = () => {
    treeMode = $<HTMLSelectElement>("#tree-mode").value;
    genealogy();
  };
  genealogy();
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
  const presentation = a.causalPresentation(e);
  const entry = (c: NonNullable<ReturnType<Archive["event"]>>) =>
    `<li><strong>${esc(eventLabel(c))}</strong><p>${esc(a.narrate(c))}</p><button class="why" data-why="${c.id}">Examinar esta causa</button></li>`;
  $("#why-body").innerHTML =
    `<h3>${esc(eventLabel(e))}</h3><p>${esc(a.narrate(e))}</p><h3>Cadeia causal principal</h3><p class="hint">Percurso de apresentação entre causas registradas. Não representa uma causa única; outras ligações estão abaixo.</p><ol class="causes principal-chain">${presentation.chain.map(entry).join("")}</ol>${presentation.continuation ? `<button class="why" data-why="${presentation.continuation}">Continuar a cadeia anterior</button>` : ""}
  <details class="routine-context"><summary>Contexto de rotina (${presentation.routine.length})</summary><ul>${presentation.routine.map(entry).join("")}</ul></details>
  <details><summary>Outras causas registradas (${presentation.other.length})</summary><ul>${presentation.other.map(entry).join("")}</ul></details>
  <h3>Participantes registrados</h3><ul>${e.participants.map((p) => `<li>${personLink(p.id)} · ${esc(({ actor: "agente", target: "alvo", victim: "vítima", witness: "testemunha", reference: "referência", beneficiary: "beneficiário" } as const)[p.role])}</li>`).join("")}</ul>
  ${
    e.decision
      ? `<h3>Decisão registrada</h3><p>${esc(a.name(e.decision.actor))}: ${esc(e.decision.chosen.replaceAll("_", " "))}. ${esc(readable(e.decision.reason))}</p><details><summary>Alternativas e escores</summary><table><thead><tr><th>Ação</th><th>Escore</th><th>Evidências</th></tr></thead><tbody>${e.decision.candidates
          .map(
            (c) =>
              `<tr><td>${esc(c.action.replaceAll("_", " "))}</td><td>${c.score}</td><td>${c.evidence
                .map((id) => {
                  const evidence = a.event(id);
                  return evidence
                    ? `<button class="why" data-why="${id}">${esc(eventLabel(evidence))}</button>`
                    : "Referência não disponível";
                })
                .join(" ")}</td></tr>`,
          )
          .join("")}</tbody></table></details>`
      : ""
  }<p class="hint">A ordem temporal, sozinha, não estabelece causalidade. Os tipos de registro são apresentados em português.</p>`;
  bind($("#why-body"));
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
