export function filterClubs(
  clubs,
  {
    query = "",
    country = "",
    league = "",
    shortlistOnly = false,
    shortlist = [],
    excluded = [],
  } = {},
) {
  return clubs.filter(
    (c) =>
      (!query ||
        `${c.name} ${c.country} ${c.league}`
          .toLocaleLowerCase("pt")
          .includes(query.toLocaleLowerCase("pt"))) &&
      (!country || c.country === country) &&
      (!league ||
        (Array.isArray(league)
          ? !league.length || league.includes(c.league)
          : c.league === league)) &&
      (!shortlistOnly || shortlist.includes(c.id)) &&
      !excluded.includes(c.id),
  );
}
function randomIndex(length, cryptoSource) {
  const limit = 2 ** 32 - (2 ** 32 % length);
  const value = new Uint32Array(1);
  do {
    cryptoSource.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % length;
}
export function choose(clubs, cryptoSource = globalThis.crypto) {
  if (!clubs.length) throw new Error("Sem clubes elegíveis");
  return clubs[randomIndex(clubs.length, cryptoSource)];
}
export function validateImport(data) {
  if (!Array.isArray(data) || !data.length || data.length > 50000)
    throw new Error("O ficheiro deve conter entre 1 e 50 000 clubes.");
  const ids = new Set();
  return data.map((c, i) => {
    if (
      !c ||
      ["name", "country", "league"].some(
        (k) => typeof c[k] !== "string" || !c[k].trim() || c[k].length > 150,
      )
    )
      throw new Error(
        `Clube ${i + 1}: name, country e league são obrigatórios (até 150 caracteres).`,
      );
    const id = "import-" + c.country + "-" + c.league + "-" + c.name;
    if (ids.has(id)) throw new Error("Existem clubes repetidos no ficheiro.");
    ids.add(id);
    return {
      id,
      name: c.name.trim(),
      country: c.country.trim(),
      league: c.league.trim(),
      flag: "🌐",
      verified: false,
    };
  });
}

// Fisher–Yates: every permutation (and therefore every survivor) is equally likely.
export function eliminationOrder(clubs, cryptoSource = globalThis.crypto) {
  if (clubs.length < 2) throw new Error("Seleciona pelo menos dois clubes.");
  const order = [...clubs];
  for (let i = order.length - 1; i > 0; i--) {
    const index = randomIndex(i + 1, cryptoSource);
    [order[i], order[index]] = [order[index], order[i]];
  }
  return order;
}
