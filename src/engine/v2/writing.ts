import type { Person, SliceEvent, Work } from "./types";
/** Explicit participation/perception, never global knowledge or invented childhood. */
export function experienceParticipants(
  type: string,
  participants: SliceEvent["participants"],
  data: Record<string, unknown>,
): string[] {
  if (type === "person.born")
    return Array.isArray(data.parents)
      ? data.parents.filter((x): x is string => typeof x === "string")
      : [];
  if (["partnership.formed", "friendship.formed"].includes(type))
    return participants.filter((p) => p.role !== "witness").map((p) => p.id);
  if (
    [
      "injury.perceived",
      "sequela.perceived",
      "family.loss.perceived",
      "care.controlled",
      "leadership.changed",
    ].includes(type)
  )
    return participants.filter((p) => p.role === "actor").map((p) => p.id);
  return [];
}
export function themeProof(actor: string, fact: string, evidence: SliceEvent) {
  return evidence.type === "information.received"
    ? evidence.participants[0]?.id === actor && evidence.data.offense === fact
    : evidence.id === fact &&
        Array.isArray(evidence.data.personalWitnesses) &&
        evidence.data.personalWitnesses.includes(actor) &&
        experienceParticipants(
          evidence.type,
          evidence.participants,
          evidence.data,
        ).includes(actor);
}
/** Suposição de design: −180 por livro concluído e −120 por repetição temática consecutiva. Todas as obras atuais são livros; variar assunto não zera a saturação do formato. */
export function writingSaturation(
  works: readonly Work[],
  typeOf: (id: string) => string,
  topic: string,
) {
  let sameTopicRun = 0;
  for (const w of [...works].reverse()) {
    if (!w.theme || typeOf(w.theme) !== topic) break;
    sameTopicRun++;
  }
  return {
    books: works.length,
    sameTopicRun,
    formatPenalty: 180 * works.length,
    topicPenalty: 120 * sameTopicRun,
  };
}
