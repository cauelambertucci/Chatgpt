import type { SliceWorld } from "./types";
export interface CausalEpisode {
  id: string;
  type: string;
  actor?: string;
  action?: string;
  from: number;
  to: number;
  periods: number;
  gain: number;
  actionCounts?: Record<string, number>;
  monitoringPeriods?: number;
  monitoringGoals?: string[];
  members: string[];
  causes: string[];
}
/** Read-only quotient DAG. Repeated periods are grouped before any depth is computed. */
export function prepareCausality(w: SliceWorld) {
  const bookkeeping = new Map<string, string[]>();
  const events = w.events
    .map((e) => {
      const causes = [
        ...new Set(e.causes.flatMap((id) => bookkeeping.get(id) || [id])),
      ];
      if (e.type === "needs.period") bookkeeping.set(e.id, causes);
      return {
        id: e.id,
        month: e.month,
        type: e.type,
        participants: e.participants,
        decision: e.decision,
        data: e.data,
        causes,
      };
    })
    .filter((e) => e.type !== "needs.period");
  const map = new Map<string, string>(),
    nodes = new Map<string, CausalEpisode>(),
    last = new Map<string, CausalEpisode>();
  const ancestors = new Map<string, Set<string>>(),
    children = new Map<string, Set<string>>();
  const addCause = (node: CausalEpisode, parent: string) => {
    if (parent === node.id || node.causes.includes(parent)) return;
    node.causes.push(parent);
    if (!children.has(parent)) children.set(parent, new Set());
    children.get(parent)!.add(node.id);
    const pending = [
      { id: node.id, additions: [parent, ...(ancestors.get(parent) || [])] },
    ];
    while (pending.length) {
      const { id, additions } = pending.pop()!;
      if (!ancestors.has(id)) ancestors.set(id, new Set());
      const known = ancestors.get(id)!,
        fresh = additions.filter((x) => !known.has(x));
      if (!fresh.length) continue;
      for (const x of fresh) known.add(x);
      for (const child of children.get(id) || [])
        pending.push({ id: child, additions: fresh });
    }
  };
  for (const e of events) {
    const actor =
      e.decision?.actor ||
      (e.type === "protection.monitored" || e.type === "rehabilitation.period"
        ? String(e.data.owner)
        : undefined);
    const action = String(
      e.data.action || (e.type === "protection.monitored" ? "monitorar" : ""),
    );
    const periodic =
      e.type === "activity.period" ||
      e.type === "protection.monitored" ||
      e.type === "work.period" ||
      e.type === "rehabilitation.period";
    const passive = (a: string) =>
      ["treinar", "esperar", "observar", "rotina", "monitorar"].includes(a);
    const key =
      e.type === "rehabilitation.period"
        ? `rehab:${String(e.data.goal)}`
        : e.type === "work.period"
          ? `work:${String(e.data.goal)}`
          : e.type === "protection.monitored"
            ? `monitor:${String(e.data.goal)}`
            : actor;
    let group: CausalEpisode | undefined;
    if (periodic && actor && key) {
      const prev = last.get(key);
      if (
        prev &&
        prev.to <= e.month &&
        (prev.action === action ||
          (passive(prev.action || "") && passive(action)))
      ) {
        // Do not contract across feedback through another event/agent: that would create a quotient cycle.
        const feedback = e.causes.some((cause) => {
          const mapped = map.get(cause);
          return (
            mapped && mapped !== prev.id && ancestors.get(mapped)?.has(prev.id)
          );
        });
        if (!feedback) group = prev;
      }
      if (!group) {
        group = {
          id: e.id,
          type: e.type,
          actor,
          action,
          from: e.month,
          to: e.month,
          periods: 0,
          gain: 0,
          members: [],
          causes: [],
        };
        nodes.set(group.id, group);
        last.set(key, group);
      }
    } else {
      for (const p of e.participants)
        if (p.role !== "reference")
          for (const [key, node] of last)
            if (node.actor === p.id) last.delete(key);
    }
    if (!group) {
      group = {
        id: e.id,
        type: e.type,
        actor,
        from: e.month,
        to: e.month,
        periods: 0,
        gain: 0,
        members: [],
        causes: [],
      };
      nodes.set(group.id, group);
    }
    group.to = e.month;
    group.periods += periodic ? 1 : 0;
    if (periodic) {
      group.actionCounts = {
        ...group.actionCounts,
        [action]: (group.actionCounts?.[action] || 0) + 1,
      };
      if (group.action !== action) group.action = "rotina";
      const monitored = Array.isArray(e.data.monitoringGoals)
        ? e.data.monitoringGoals.map(String)
        : e.type === "protection.monitored"
          ? [String(e.data.goal)]
          : [];
      group.monitoringPeriods =
        (group.monitoringPeriods || 0) + (monitored.length ? 1 : 0);
      group.monitoringGoals = [
        ...new Set([...(group.monitoringGoals || []), ...monitored]),
      ];
    }
    group.gain += Number(e.data.gain || 0);
    group.members.push(e.id);
    map.set(e.id, group.id);
    for (const cause of e.causes) {
      const id = map.get(cause);
      if (!id) throw Error(`Missing cause ${cause}`);
      addCause(group, id);
    }
  }
  return (end: string) => {
    const endNode = map.get(end);
    if (!endNode) throw Error(`Missing end ${end}`);
    const needed = new Set<string>(),
      pending = [endNode];
    while (pending.length) {
      const id = pending.pop()!;
      if (needed.has(id)) continue;
      needed.add(id);
      pending.push(...nodes.get(id)!.causes);
    }
    const indegree = new Map<string, number>(),
      children = new Map<string, string[]>();
    for (const id of needed) {
      const n = nodes.get(id)!;
      indegree.set(id, n.causes.length);
      for (const c of n.causes)
        children.set(c, [...(children.get(c) || []), id]);
    }
    const ready = [...needed].filter((id) => indegree.get(id) === 0).sort(),
      depth = new Map<string, number>(),
      parent = new Map<string, string>();
    let visited = 0;
    while (ready.length) {
      const id = ready.shift()!,
        node = nodes.get(id)!;
      visited++;
      let best = 0,
        prev: string | undefined;
      for (const c of node.causes) {
        const d = depth.get(c)!;
        if (d > best) {
          best = d;
          prev = c;
        }
      }
      depth.set(id, best + 1);
      if (prev) parent.set(id, prev);
      for (const next of children.get(id) || []) {
        indegree.set(next, indegree.get(next)! - 1);
        if (indegree.get(next) === 0) {
          ready.push(next);
          ready.sort();
        }
      }
    }
    if (visited !== needed.size)
      throw Error("Collapsing periods produced a causal cycle");
    const chain: string[] = [];
    let id: string | undefined = endNode;
    while (id) {
      chain.push(id);
      id = parent.get(id);
    }
    return {
      depth: depth.get(endNode)!,
      chain: chain.reverse(),
      episodes: [...needed]
        .map((id) => nodes.get(id)!)
        .sort(
          (a, b) =>
            a.from - b.from ||
            Number(a.id.split(":")[1]) - Number(b.id.split(":")[1]),
        ),
    };
  };
}
export function collapsedCausality(w: SliceWorld, end: string) {
  return prepareCausality(w)(end);
}
