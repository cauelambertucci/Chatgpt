/** Presentation only: deterministic ID selection, no simulation RNG. */
export const notableChange = { facet: 10, value: 20, stress: 100 } as const;
export function chooseText(id: string, options: readonly string[]) {
  let n = 2166136261;
  for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  return options[n % options.length];
}
export const capital = (s: string) =>
  s ? s[0].toLocaleUpperCase("pt-BR") + s.slice(1) : s;
export function withoutDate(text: string) {
  return capital(text.replace(/^No ano -?\d+, mês \d+, /, ""));
}
export function momentLead(id: string, month: number, age?: number) {
  const y = Math.floor(month / 12),
    m = (month % 12) + 1;
  return chooseText(id, [
    `No ano ${y}, mês ${m},`,
    `No mês ${m} do ano ${y},`,
    ...(age !== undefined ? [`Aos ${age} anos,`] : [`Em ${y}, no mês ${m},`]),
  ]);
}
export function qualitative(
  key: string,
  label: string,
  before: number,
  after: number,
) {
  const up = after > before;
  const descriptions: Record<string, [string, string]> = {
    rancor: ["passou a guardar mais rancor", "passou a guardar menos rancor"],
    cautela: [
      "passou a agir com mais cautela",
      "passou a agir com menos cautela",
    ],
    compaixao: ["passou a ter mais compaixão", "passou a ter menos compaixão"],
    esperanca: ["ganhou esperança", "perdeu esperança"],
    paz: ["passou a valorizar mais a paz", "passou a valorizar menos a paz"],
    vinganca: [
      "passou a valorizar mais a vingança",
      "passou a valorizar menos a vingança",
    ],
    solidariedade: [
      "passou a valorizar mais a solidariedade",
      "passou a valorizar menos a solidariedade",
    ],
    honra: [
      "passou a valorizar mais a honra",
      "passou a valorizar menos a honra",
    ],
  };
  return (
    descriptions[key]?.[up ? 0 : 1] ||
    `${label.toLocaleLowerCase("pt-BR")} ${up ? "aumentou" : "diminuiu"}`
  );
}
