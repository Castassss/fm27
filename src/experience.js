import { filterClubs } from "./engine.js";

const europe = new Set([
  "Portugal",
  "Inglaterra",
  "Espanha",
  "Itália",
  "Alemanha",
  "França",
  "Países Baixos",
  "Escócia",
  "Turquia",
]);
const elsewhere = new Set([
  "Brasil",
  "Argentina",
  "Japão",
  "Coreia do Sul",
  "Estados Unidos",
  "África do Sul",
]);
export const journeys = [
  {
    id: "world",
    icon: "globe",
    title: "O mundo é teu",
    description: "Sem fronteiras. Deixa-te surpreender por um novo destino.",
    color: "mint",
  },
  {
    id: "shortlist",
    icon: "heart",
    title: "Os teus favoritos",
    description:
      "Aqueles clubes que não te saem da cabeça. Agora, frente a frente.",
    color: "pink",
  },
  {
    id: "europe",
    icon: "cup",
    title: "Uma noite europeia",
    description: "Uma nova história nas ligas europeias da nossa coleção.",
    color: "lavender",
  },
  {
    id: "elsewhere",
    icon: "compass",
    title: "Fora da tua zona",
    description: "Américas, Ásia ou África. Descobre outro lado do futebol.",
    color: "peach",
  },
];
export const challenges = [
  {
    id: "free",
    icon: "spark",
    title: "À tua maneira",
    description: "O clube é sorteado. As regras são tuas.",
  },
  {
    id: "academy",
    icon: "seed",
    title: "Da casa para o mundo",
    description:
      "Ter 3 jogadores formados no clube no teu onze até à 3.ª época.",
  },
  {
    id: "patient",
    icon: "clock",
    title: "Um projeto a sério",
    description: "Ficar pelo menos 3 épocas, mesmo quando o banco aquecer.",
  },
  {
    id: "window",
    icon: "shield",
    title: "Confiar nos que ficam",
    description:
      "Não contratar jogadores na primeira janela de transferências.",
  },
];
export function candidatesFor(clubs, selection) {
  let candidates = clubs;
  if (selection.journey === "europe")
    candidates = candidates.filter((c) => europe.has(c.country));
  if (selection.journey === "elsewhere")
    candidates = candidates.filter((c) => elsewhere.has(c.country));
  if (selection.countries?.length)
    candidates = candidates.filter((c) =>
      selection.countries.includes(c.country),
    );
  return filterClubs(candidates, {
    league: selection.leagues || [],
    shortlistOnly: selection.journey === "shortlist",
    shortlist: selection.shortlist || [],
    excluded: selection.excluded || [],
  });
}
export function selectionSnapshot(selection) {
  return {
    journey: journeys.some((j) => j.id === selection.journey)
      ? selection.journey
      : "world",
    countries: [...(selection.countries || [])],
    leagues: [...(selection.leagues || [])],
    shortlist: [...(selection.shortlist || [])],
    excluded: [...(selection.excluded || [])],
    challenge: challenges.some((c) => c.id === selection.challenge)
      ? selection.challenge
      : "free",
  };
}
export function restoreSelection(value) {
  if (!value || typeof value !== "object") throw new Error("Seleção inválida.");
  for (const key of ["countries", "leagues", "shortlist", "excluded"])
    if (
      value[key] !== undefined &&
      (!Array.isArray(value[key]) ||
        value[key].length > 50000 ||
        value[key].some((v) => typeof v !== "string" || v.length > 1000))
    )
      throw new Error("Seleção inválida.");
  return selectionSnapshot(value);
}
export function probabilityLabel(count) {
  if (count < 1) return "0%";
  return (
    (100 / count).toLocaleString("pt-PT", {
      maximumFractionDigits: count > 100 ? 4 : 2,
    }) + "%"
  );
}
