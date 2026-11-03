import type { World, Person, Event, Artifact } from "../types";
import { rng, pick } from "./rng";
import { name } from "./names";
import { personalities } from "../data/catalog";
export function simulate(w: World, progress: (n: number) => void = () => {}) {
  const r = rng(w.params.seed + ":history");
  const event = (
    year: number,
    type: string,
    participants: string[],
    location: string,
    consequences: string,
    cause?: string,
  ) => {
    const e: Event = {
      id: `e${w.events.length}`,
      year,
      type,
      participants: [...new Set(participants)],
      location,
      consequences,
      variant: Math.floor(r() * 3),
      ...(cause ? { cause } : {}),
    };
    w.events.push(e);
    for (const p of w.people.filter((p) => participants.includes(p.id)))
      p.deeds.push(e.id);
    return e.id;
  };
  const birth = (
    civ: string,
    year: number,
    parents: Person[] = [],
    adult = false,
  ) => {
    const c = w.civs.find((c) => c.id === civ)!,
      culture = w.cultures.find((u) => u.id === c.culture)!;
    const p: Person = {
      id: `p${w.people.length}`,
      kind: "pessoa",
      name: name(r, culture.style),
      civ,
      culture: c.culture,
      race: culture.race,
      born: adult ? year - 20 - Math.floor(r() * 20) : year,
      parents: parents.map((p) => p.id),
      children: [],
      role: pick(r, ["artesão", "herói", "sacerdote", "cronista"]),
      traits: [pick(r, personalities), pick(r, personalities)],
      ambition: pick(r, [
        "proteger seu povo",
        "alcançar a imortalidade",
        "unir os reinos",
        "descobrir terras",
      ]),
      relations: {},
      deeds: [],
      possessions: [],
    };
    w.people.push(p);
    parents.forEach((parent) => parent.children.push(p.id));
    event(
      year,
      "nascimento",
      [p.id, ...p.parents],
      c.capital,
      adult
        ? "Apareceu nos primeiros registros."
        : "Uma nova linhagem ganhou um nome.",
    );
    return p;
  };
  const transfer = (
    a: Artifact,
    holder: Person | undefined,
    year: number,
    action: string,
    participants: string[],
    location: string,
  ) => {
    if (a.owner) {
      const old = w.people.find((p) => p.id === a.owner);
      if (old) old.possessions = old.possessions.filter((id) => id !== a.id);
    }
    a.owner = holder?.id;
    if (holder) holder.possessions.push(a.id);
    const id = event(
      year,
      action,
      [a.id, ...participants, ...(holder ? [holder.id] : [])],
      location,
      action === "destruição"
        ? "O objeto deixou de existir."
        : holder
          ? "A posse do objeto mudou."
          : "O paradeiro do objeto tornou-se desconhecido.",
    );
    a.provenance.push({ year, action, holder: holder?.id, event: id });
    if (action === "destruição") a.destroyed = year;
  };
  for (const c of w.civs) {
    for (const s of w.settlements.filter((s) => s.civ === c.id))
      event(
        0,
        "fundação",
        [c.id, s.id],
        s.id,
        "O assentamento abriu suas portas.",
      );
    const leader = birth(c.id, 0, [], true);
    leader.role = "líder";
    c.leader = leader.id;
    birth(c.id, 0, [], true);
    birth(c.id, 0, [], true);
    event(
      0,
      "religião",
      [c.id, leader.id],
      c.capital,
      `Instituiu-se ${w.cultures.find((u) => u.id === c.culture)!.religion}.`,
    );
  }
  for (let year = 1; year <= w.params.years; year++) {
    for (const c of w.civs) {
      const sites = w.settlements.filter(
        (s) => s.civ === c.id && s.abandoned === undefined,
      );
      for (const s of sites)
        s.population = Math.max(
          0,
          Math.floor(s.population * (1.003 + r() * 0.009)),
        );
      const site = pick(
        r,
        sites.length ? sites : [w.settlements.find((s) => s.id === c.capital)!],
      );
      let living = w.people.filter(
        (p) => p.civ === c.id && p.died === undefined,
      );
      let adults = living.filter((p) => year - p.born >= 18);
      // Relevant births only; common inhabitants remain aggregated.
      if (living.length < 16 && r() < 0.2) {
        const couples = adults.filter((p) => p.spouse && year - p.born < 65);
        const parent = couples.length ? pick(r, couples) : undefined;
        birth(
          c.id,
          year,
          parent ? [parent, w.people.find((p) => p.id === parent.spouse)!] : [],
          !parent,
        );
      }
      const singles = adults.filter((p) => !p.spouse);
      if (singles.length >= 2 && r() < 0.07) {
        const a = pick(r, singles),
          b = pick(
            r,
            singles.filter(
              (b) =>
                b !== a &&
                !a.parents.includes(b.id) &&
                !b.parents.includes(a.id) &&
                !a.parents.some((id) => b.parents.includes(id)),
            ),
          );
        if (b) {
          a.spouse = b.id;
          b.spouse = a.id;
          a.relations[b.id] = "cônjuge";
          b.relations[a.id] = "cônjuge";
          event(
            year,
            "casamento",
            [a.id, b.id],
            site.id,
            "Duas histórias passaram a compartilhar um destino.",
          );
        }
      }
      for (const p of living) {
        const age = year - p.born;
        if (age > 95 || (age > 45 && r() < 0.018)) {
          p.died = year;
          p.cause = age > 85 ? "velhice" : "doença";
          const death = event(
            year,
            "morte",
            [p.id],
            site.id,
            `Morreu por ${p.cause}.`,
          );
          if (p.spouse) {
            const spouse = w.people.find((o) => o.id === p.spouse)!;
            spouse.spouse = undefined;
            p.spouse = undefined;
          }
          const heirs = w.people.filter(
            (o) =>
              o.civ === c.id &&
              o.died === undefined &&
              o.id !== p.id &&
              year - o.born >= 18,
          );
          const heir = heirs.find((o) => p.children.includes(o.id)) || heirs[0];
          for (const id of [...p.possessions])
            transfer(
              w.artifacts.find((a) => a.id === id)!,
              heir,
              year,
              heir ? "herança" : "perda",
              [p.id],
              site.id,
            );
          if (c.leader === p.id) {
            const successor = heir || birth(c.id, year, [], true);
            c.leader = successor.id;
            successor.role = "líder";
            event(
              year,
              "sucessão",
              [successor.id, c.id],
              site.id,
              "O conselho reconheceu uma nova liderança.",
              death,
            );
          }
        }
      }
      living = w.people.filter((p) => p.civ === c.id && p.died === undefined);
      adults = living.filter((p) => year - p.born >= 18);
      const actor = adults.length
        ? pick(r, adults)
        : birth(c.id, year, [], true);
      if (r() < 0.045) {
        const a: Artifact = {
          id: `a${w.artifacts.length}`,
          kind: "artefato",
          name: `${pick(r, ["Espada", "Coroa", "Tomo", "Estátua", "Livro"])} de ${name(r)}`,
          creator: actor.id,
          material: pick(r, [
            "ferro estelar",
            "ouro",
            "obsidiana",
            "prata",
            "madeira antiga",
          ]),
          properties: pick(r, [
            "guarda memórias",
            "brilha ao luar",
            "inspira coragem",
            "sussurra profecias",
          ]),
          created: year,
          provenance: [],
        };
        w.artifacts.push(a);
        transfer(a, actor, year, "criação", [actor.id], site.id);
      }
      if (r() < 0.035) {
        const artifacts = w.artifacts.filter((a) => a.destroyed === undefined);
        if (artifacts.length) {
          const a = pick(r, artifacts),
            action = pick(r, ["roubo", "perda", "destruição"]);
          transfer(
            a,
            action === "roubo" ? actor : undefined,
            year,
            action,
            [actor.id],
            site.id,
          );
        }
      }
      if (r() < 0.08) {
        const type = pick(r, [
          "descoberta",
          "culto",
          "cisma",
          "missão",
          "feito",
          "crescimento",
        ]);
        if (type === "crescimento") site.population += 100;
        event(
          year,
          type,
          [actor.id, c.id],
          site.id,
          (
            {
              descoberta: "Novos veios minerais enriqueceram o povo.",
              culto: "Uma nova devoção reuniu seguidores.",
              cisma: "Uma disputa dividiu a fé local.",
              missão: "Uma expedição partiu rumo às fronteiras.",
              feito: "Uma expedição regressou com saberes esquecidos.",
              crescimento: "Novas famílias chegaram ao assentamento.",
            } as Record<string, string>
          )[type],
        );
      }
      if (r() < 0.035 * w.params.chaos) {
        const type = pick(r, ["praga", "fome", "desastre"]);
        const lost = Math.floor(site.population * 0.25);
        site.population -= lost;
        event(
          year,
          type,
          [c.id, site.id],
          site.id,
          `${lost} habitantes foram perdidos.`,
        );
      }
      if (
        year > 60 &&
        site.id !== c.capital &&
        site.abandoned === undefined &&
        r() < 0.002 * w.params.chaos
      ) {
        site.abandoned = year;
        site.population = 0;
        event(
          year,
          "abandono",
          [site.id, c.id],
          site.id,
          "Os últimos habitantes partiram.",
        );
      }
      if (r() < 0.028 * w.params.chaos) {
        const monster = pick(
          r,
          w.creatures.filter((m) => m.slain === undefined),
        );
        if (monster) {
          const attack = event(
            year,
            "ataque",
            [monster.id, c.id],
            site.id,
            "O ataque destruiu casas e colheitas.",
          );
          site.population = Math.floor(site.population * 0.85);
          if (r() < 0.35) {
            monster.slain = year;
            monster.slayer = actor.id;
            event(
              year,
              "caçada",
              [monster.id, actor.id],
              site.id,
              "A ameaça foi derrotada por um herói.",
              attack,
            );
          }
        }
      }
      if (r() < 0.045 * w.params.chaos) {
        const other = pick(
          r,
          w.civs.filter((o) => o !== c),
        );
        const relation = c.relations[other.id];
        if (relation === "guerra") {
          if (r() < 0.35) {
            c.relations[other.id] = other.relations[c.id] = "paz";
            event(
              year,
              "paz",
              [c.id, other.id, actor.id],
              site.id,
              "Um tratado encerrou as hostilidades.",
            );
          } else {
            const target = pick(
              r,
              w.settlements.filter(
                (s) => s.civ === other.id && s.abandoned === undefined,
              ),
            );
            if (target) {
              const type = pick(r, ["batalha", "cerco"]);
              target.population = Math.floor(target.population * 0.8);
              if (target.id !== other.capital && r() < 0.4) {
                target.civ = c.id;
                w.geography.tiles.forEach((tile, i) => {
                  if (
                    Math.abs(
                      (i % w.params.size) - (target.tile % w.params.size),
                    ) +
                      Math.abs(
                        Math.floor(i / w.params.size) -
                          Math.floor(target.tile / w.params.size),
                      ) <
                      7 &&
                    !tile.water
                  )
                    tile.owner = c.id;
                });
              }
              event(
                year,
                type,
                [c.id, other.id, actor.id, target.id],
                target.id,
                `A população caiu; ${target.name} pertence agora a ${w.civs.find((c) => c.id === target.civ)!.name}.`,
              );
            }
          }
        } else {
          const type =
            relation === "aliança" ? "traição" : pick(r, ["guerra", "aliança"]);
          c.relations[other.id] = other.relations[c.id] =
            type === "aliança" ? "aliança" : "guerra";
          actor.relations[other.leader] =
            type === "aliança" ? "amigo" : "rival";
          event(
            year,
            type,
            [c.id, other.id, actor.id],
            site.id,
            type === "aliança"
              ? "As fronteiras foram abertas ao comércio."
              : "Os exércitos marcharam e as fronteiras se fecharam.",
          );
        }
      }
      c.population = w.settlements
        .filter((s) => s.civ === c.id)
        .reduce((sum, s) => sum + s.population, 0);
    }
    if (year % 10 === 0) progress(year / w.params.years);
  }
  w.civs.forEach(
    (c) =>
      (c.population = w.settlements
        .filter((s) => s.civ === c.id)
        .reduce((n, s) => n + s.population, 0)),
  );
  return w;
}
