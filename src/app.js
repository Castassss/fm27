import { clubs as initialClubs } from "./data.js";
import { filterClubs, eliminationOrder, validateImport } from "./engine.js";
const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
let clubs = initialClubs,
  importedData = false;
try {
  const imported = read("draw-import", null);
  if (imported) {
    clubs = validateImport(imported);
    importedData = true;
  }
} catch {}
const preferences = read("draw-preferences", {});
const state = {
  country: "",
  league: [],
  shortlistOnly: false,
  shortlist: Array.isArray(preferences?.shortlist) ? preferences.shortlist : [],
  excluded: Array.isArray(preferences?.excluded) ? preferences.excluded : [],
};
let history = read("draw-history", []);
if (!Array.isArray(history)) history = [];
history = history
  .filter(
    (c) =>
      c &&
      typeof c.name === "string" &&
      typeof c.country === "string" &&
      typeof c.league === "string",
  )
  .slice(0, 100);
let search = "",
  catalogSearch = "",
  liveSearch = "",
  liveTab = "remaining",
  clubLimit = 100,
  catalogLimit = 100,
  liveLimit = 150;
let session = null,
  timer = null,
  deadline = 0,
  pendingBase = 0,
  speed = 1,
  audioContext,
  toastTimer;
const running = () => !!session?.active;
const pool = () => filterClubs(clubs, state);
const match = (club, query) =>
  `${club.name} ${club.country} ${club.league}`
    .toLocaleLowerCase("pt")
    .includes(query.toLocaleLowerCase("pt"));
function badge(club) {
  const initials = club.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
  const palette = ["#80d9f0", "#ac9df6", "#70d8bd", "#f2bd89", "#e49bce"];
  const index =
    Array.from(club.name).reduce((sum, c) => sum + c.charCodeAt(0), 0) %
    palette.length;
  return `<span class="badge" style="--club-color:${palette[index]}" aria-hidden="true">${esc(initials)}</span>`;
}
function persist() {
  try {
    localStorage.setItem(
      "draw-preferences",
      JSON.stringify({ shortlist: state.shortlist, excluded: state.excluded }),
    );
    localStorage.setItem("draw-history", JSON.stringify(history));
  } catch {
    toast(
      "Armazenamento indisponível. As alterações ficam apenas nesta sessão.",
    );
  }
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 5000);
}
function announce(message) {
  $("#announcer").textContent = message;
}
function populate() {
  const countries = [...new Set(clubs.map((c) => c.country))].sort((a, b) =>
    a.localeCompare(b, "pt"),
  );
  $("#country").innerHTML =
    '<option value="">🌐 Todos os países</option>' +
    countries
      .map(
        (country) =>
          `<option value="${esc(country)}">${esc(clubs.find((c) => c.country === country).flag)} ${esc(country)}</option>`,
      )
      .join("");
  $("#country").value = state.country;
  populateLeagues();
}
function populateLeagues() {
  const leagues = [
    ...new Set(
      clubs
        .filter((c) => !state.country || c.country === state.country)
        .map((c) => c.league),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt"));
  state.league = state.league.filter((l) => leagues.includes(l));
  $("#league-options").innerHTML =
    leagues
      .map(
        (league, i) =>
          `<label class="league-option"><input type="checkbox" value="${esc(league)}" id="league-${i}" ${state.league.includes(league) ? "checked" : ""}><span>${esc(league)}</span></label>`,
      )
      .join("") +
    '<button class="league-done secondary" type="button">Concluir seleção ✓</button>';
  leagueSummary();
}
function leagueSummary() {
  $("#league-summary").textContent = !state.league.length
    ? "Todas as ligas"
    : state.league.length === 1
      ? state.league[0]
      : `${state.league.length} ligas selecionadas`;
}
function renderSetup() {
  const candidates = pool();
  const visible = filterClubs(clubs, { ...state, excluded: [] }).filter((c) =>
    match(c, search),
  );
  $("#pool-count").textContent = candidates.length + " no pote";
  $("#eligible-count").textContent = candidates.length + " clubes no pote";
  const duration = Math.ceil(
    (Math.max(0, candidates.length - 1) * 1.7) / speed,
  );
  $("#pool-description").textContent =
    candidates.length < 2
      ? "Seleciona pelo menos 2 para eliminar."
      : `${candidates.length - 1} eliminações · ~${duration < 60 ? duration + " s" : Math.ceil(duration / 60) + " min"} · chances iguais`;
  const shortlist = new Set(state.shortlist),
    excluded = new Set(state.excluded);
  $("#list-count").textContent = clubs.filter((c) =>
    shortlist.has(c.id),
  ).length;
  $("#all-mode").classList.toggle("selected", !state.shortlistOnly);
  $("#list-mode").classList.toggle("selected", state.shortlistOnly);
  $("#all-mode").setAttribute("aria-pressed", String(!state.shortlistOnly));
  $("#list-mode").setAttribute("aria-pressed", String(state.shortlistOnly));
  $("#club-list").innerHTML =
    visible
      .slice(0, clubLimit)
      .map(
        (c) =>
          `<div class="club-row ${excluded.has(c.id) ? "excluded" : ""}">${badge(c)}<div class="club-info"><strong>${esc(c.name)}</strong><small>${esc(c.country)} · ${esc(c.league)}</small></div><button class="icon-button ${shortlist.has(c.id) ? "chosen" : ""}" data-star="${esc(c.id)}" aria-label="${shortlist.has(c.id) ? "Remover da" : "Adicionar à"} shortlist: ${esc(c.name)}" aria-pressed="${shortlist.has(c.id)}" title="${shortlist.has(c.id) ? "Remover da shortlist" : "Adicionar à shortlist"}">${shortlist.has(c.id) ? "★" : "☆"}</button><button class="icon-button exclude-button" data-exclude="${esc(c.id)}" aria-label="${excluded.has(c.id) ? "Reincluir" : "Excluir"} ${esc(c.name)}" aria-pressed="${excluded.has(c.id)}" title="${excluded.has(c.id) ? "Reincluir no pote" : "Excluir do pote"}">${excluded.has(c.id) ? "+" : "−"}</button></div>`,
      )
      .join("") ||
    `<div class="empty"><strong>${state.shortlistOnly && !state.shortlist.length ? "A tua shortlist está vazia." : "Nenhum clube encontrado."}</strong>${state.shortlistOnly && !state.shortlist.length ? "Adiciona clubes com a estrela ☆ no modo Todo o mundo." : "Experimenta outra pesquisa ou repõe os filtros."}</div>`;
  $("#more-clubs").hidden = visible.length <= clubLimit;
  $("#draw").disabled = candidates.length < 2 || running();
  $("#draw").hidden = running();
  $("#session-controls").hidden = !running();
  $("#setup-fields").disabled = running();
  $("#reset").disabled = running();
  $("#data-count").textContent =
    clubs.length +
    " clubes " +
    (importedData ? "importados" : "de demonstração");
  $(".data-badge").textContent = importedData ? "IMPORTED DATA" : "DEMO DATA";
  $("#restore-data").hidden = !importedData;
}
function renderContenders() {
  const remaining = session ? session.remaining : pool();
  const eliminated = session ? session.eliminated : [];
  const total = session ? session.total : remaining.length;
  const done = eliminated.length;
  const progress = total > 1 ? Math.round((done / (total - 1)) * 100) : 0;
  $("#remaining-count").textContent = remaining.length;
  $("#remaining-tab-count").textContent = remaining.length;
  $("#eliminated-count").textContent = done;
  $("#progress-label").textContent = !session
    ? "À espera do sorteio"
    : !session.active
      ? "Sorteio concluído"
      : session.paused
        ? "Cerimónia em pausa"
        : `${done} de ${total - 1} eliminações`;
  $("#progress-value").textContent = progress + "%";
  $("#progress-fill").style.width = progress + "%";
  $("#remaining-tab").classList.toggle("selected", liveTab === "remaining");
  $("#eliminated-tab").classList.toggle("selected", liveTab === "eliminated");
  $("#remaining-tab").setAttribute(
    "aria-selected",
    String(liveTab === "remaining"),
  );
  $("#eliminated-tab").setAttribute(
    "aria-selected",
    String(liveTab === "eliminated"),
  );
  $("#contenders").setAttribute(
    "aria-labelledby",
    liveTab === "remaining" ? "remaining-tab" : "eliminated-tab",
  );
  const list = (
    liveTab === "remaining"
      ? [...remaining].sort((a, b) => a.name.localeCompare(b.name, "pt"))
      : [...eliminated].reverse()
  ).filter((c) => match(c, liveSearch));
  $("#contenders").innerHTML =
    list
      .slice(0, liveLimit)
      .map(
        (c, i) =>
          `<div class="contender ${liveTab === "eliminated" ? "out" : ""} ${session && !session.active && liveTab === "remaining" ? "winner" : ""}">${badge(c)}<div class="club-info"><strong>${esc(c.name)}</strong><small>${esc(c.country)}</small></div><span class="club-state">${liveTab === "eliminated" ? "OUT / " + String(eliminated.indexOf(c) + 1).padStart(3, "0") : session && !session.active ? "VENCEDOR" : "●"}</span></div>`,
      )
      .join("") ||
    `<div class="empty">${liveSearch ? "Nenhum clube corresponde à pesquisa." : liveTab === "eliminated" ? "Ainda ninguém foi eliminado. Cada clube que sair fica registado aqui." : "O pote está vazio. Adiciona clubes ou repõe os filtros."}</div>`;
  $("#more-contenders").hidden = list.length <= liveLimit;
  $("#live-update").innerHTML =
    '<span class="status-dot"></span>' +
    (!session
      ? "A lista atualiza a cada eliminação."
      : !session.active
        ? "Um sobrevivente. Um novo capítulo."
        : session.paused
          ? "Em pausa. Avança manualmente ou retoma."
          : remaining.length === 2
            ? "Só restam dois. Estamos na grande final."
            : `${remaining.length} clubes ainda podem ser o teu destino.`);
}
function renderCatalog() {
  const visible = clubs.filter((c) => match(c, catalogSearch)),
    shortlist = new Set(state.shortlist);
  $("#catalog").innerHTML =
    visible
      .slice(0, catalogLimit)
      .map(
        (c) =>
          `<article class="card">${badge(c)}<h3>${esc(c.name)}</h3><p>${esc(c.flag)} ${esc(c.country)}<br>${esc(c.league)}</p><button class="secondary ${shortlist.has(c.id) ? "chosen" : ""}" data-star="${esc(c.id)}" aria-pressed="${shortlist.has(c.id)}">${shortlist.has(c.id) ? "★ Na shortlist" : "☆ Adicionar à shortlist"}</button></article>`,
      )
      .join("") || '<p class="empty">Nenhum clube encontrado.</p>';
  $("#more-catalog").hidden = visible.length <= catalogLimit;
}
function renderHistory() {
  $("#history-count").textContent = history.length;
  $("#clear-history").disabled = !history.length;
  $("#history").innerHTML =
    history
      .map(
        (c) =>
          `<article class="card">${badge(c)}<span class="history-tag">${c.elimination ? "ÚLTIMO SOBREVIVENTE" : "SORTEIO CLÁSSICO"}</span><h3>${esc(c.name)}</h3><p>${esc(c.country)} · ${esc(c.league)}</p><p>${esc(new Date(c.date).toLocaleString("pt-PT"))}</p><small>${Number(c.poolSize) || 0} clubes no pote${c.elimination ? " · " + ((Number(c.poolSize) || 1) - 1) + " eliminações" : ""}</small></article>`,
      )
      .join("") ||
    '<div class="empty"><strong>Ainda não há destinos no arquivo.</strong>Conclui uma cerimónia. O clube que resistir até ao fim fica guardado aqui.</div>';
}
function render() {
  renderSetup();
  renderContenders();
  renderCatalog();
  renderHistory();
}
function configure() {
  if (running()) return;
  session = null;
  resetArena();
  persist();
  render();
}
function view(name) {
  if (running()) {
    if (name !== "draw") toast("Conclui ou cancela o sorteio antes de sair da sala.");
    return;
  }
  document
    .querySelectorAll(".view")
    .forEach((el) => (el.hidden = el.id !== name + "-view"));
  document
    .querySelectorAll(".nav")
    .forEach((el) => el.classList.toggle("active", el.dataset.view === name));
}
function setStage({ eyebrow, title, description, stamp }) {
  if (eyebrow !== undefined) $("#stage-eyebrow").textContent = eyebrow;
  if (title !== undefined) $("#stage-title").textContent = title;
  if (description !== undefined)
    $("#stage-description").textContent = description;
  if (stamp !== undefined) $("#round-stamp").textContent = stamp;
}
function resetArena() {
  clearTimeout(timer);
  timer = null;
  $(".arena").classList.remove(
    "running",
    "elimination",
    "duel",
    "won",
    "paused",
  );
  document.body.classList.remove("session-active");
  $("#reactor").hidden = false;
  $("#reveal-crest").hidden = true;
  $("#finalists").hidden = true;
  $("#result-actions").hidden = true;
  $("#live-label").textContent = "STANDBY";
  $("#round-label").textContent = "ROUND 000";
  $("#arena-footer").textContent = "O ÚLTIMO CLUBE É O TEU DESTINO";
  $("#draw").innerHTML = "Iniciar eliminação <span>↗</span>";
  $("#deck-title").textContent = "O último a ficar ganha.";
  $("#deck-description").textContent =
    "Uma eliminação de cada vez. Sem atalhos para o destino.";
  setStage({
    eyebrow: "O TEU PRÓXIMO SAVE ESTÁ AQUI",
    description: "Vê os clubes cair. Sente a tensão. Descobre quem fica.",
    stamp: "PRONTO PARA COMEÇAR",
  });
  $("#stage-title").innerHTML =
    "O próximo capítulo<br>é uma <em>incógnita.</em>";
  $(".confetti")?.remove();
}
function tone(frequency, duration = 0.3, type = "sine") {
  if (!$("#sound").checked || !audioContext) return;
  const oscillator = audioContext.createOscillator(),
    gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(0.045, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration,
  );
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}
async function initAudio() {
  if (!$("#sound").checked) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
  } catch {
    toast("O som não está disponível neste navegador.");
  }
}
function schedule(base) {
  clearTimeout(timer);
  pendingBase = base;
  if (!running() || session.paused) {
    timer = null;
    return;
  }
  deadline = performance.now() + base / speed;
  timer = setTimeout(advance, base / speed);
}
function refreshPlayback() {
  const active = running();
  $("#live-label").textContent = active
    ? session.paused
      ? "EM PAUSA"
      : "EM DIRETO"
    : session
      ? "CONCLUÍDO"
      : "STANDBY";
  $(".arena").classList.toggle("paused", active && session.paused);
  $("#pause").textContent = session?.paused ? "▷ Retomar" : "Ⅱ Pausar";
  $("#pause").setAttribute("aria-pressed", String(!!session?.paused));
  $("#deck-title").textContent = active
    ? session.paused
      ? "O destino pode esperar."
      : "A tensão está a subir."
    : "O teu próximo capítulo está escolhido.";
  $("#deck-description").textContent = active
    ? session.paused
      ? "Retoma a cerimónia ou elimina um clube com Próxima."
      : `${session.remaining.length} ainda em jogo · ${session.eliminated.length} eliminados · controla o ritmo à direita.`
    : "Volta a sortear ou guarda este nome para o teu próximo save.";
}
function replayAnimation() {
  const target = $("#arena-content");
  target.classList.remove("reveal-motion");
  void target.offsetWidth;
  target.classList.add("reveal-motion");
}
function advance() {
  clearTimeout(timer);
  timer = null;
  if (!running()) return;
  if (session.remaining.length === 1) {
    finish();
    return;
  }
  if (session.remaining.length === 2 && !session.finalShown) {
    session.finalShown = true;
    session.phase = "duel";
    $(".arena").classList.remove("elimination");
    $(".arena").classList.add("duel");
    $("#reactor").hidden = true;
    $("#reveal-crest").hidden = true;
    $("#finalists").hidden = false;
    $("#finalists").innerHTML = session.remaining
      .map(
        (c) =>
          `<div class="finalist">${badge(c)}<strong>${esc(c.name)}</strong><small>${esc(c.country)}<br>${esc(c.league)}</small></div>`,
      )
      .join('<span class="versus">VS</span>');
    setStage({
      eyebrow: "GRANDE FINAL / SÓ RESTAM DOIS",
      title: "Um deles vai ficar.",
      description: "O próximo clube a sair entrega o destino ao outro.",
      stamp: "A ÚLTIMA ELIMINAÇÃO",
    });
    $("#arena-footer").textContent = "DOIS CLUBES. UM NOVO SAVE.";
    announce(
      "Grande final: " + session.remaining.map((c) => c.name).join(" contra "),
    );
    tone(330, 0.7);
    replayAnimation();
    renderContenders();
    refreshPlayback();
    schedule(3400);
    return;
  }
  const removed = session.remaining.shift();
  session.eliminated.push(removed);
  session.phase = "elimination";
  $(".arena").classList.remove("duel");
  $(".arena").classList.add("elimination");
  $("#reactor").hidden = true;
  $("#finalists").hidden = true;
  $("#reveal-crest").innerHTML = badge(removed);
  $("#reveal-crest").hidden = false;
  setStage({
    eyebrow:
      session.remaining.length === 1
        ? "A ÚLTIMA BOLA FOI ABERTA"
        : "O DESTINO SEGUE EM FRENTE",
    title: removed.name,
    description: `${removed.country} · ${removed.league}`,
    stamp: "ELIMINADO / NÃO SERÁ DESTA VEZ",
  });
  $("#round-label").textContent =
    "ROUND " + String(session.eliminated.length).padStart(3, "0");
  $("#arena-footer").textContent =
    session.remaining.length === 1
      ? "UM CLUBE RESISTIU A TUDO"
      : session.remaining.length + " CLUBES AINDA EM JOGO";
  announce(
    `${removed.name} eliminado. ${session.remaining.length} ${session.remaining.length === 1 ? "clube continua" : "clubes continuam"} em jogo.`,
  );
  tone(155, 0.4, "triangle");
  replayAnimation();
  renderContenders();
  refreshPlayback();
  schedule(
    session.remaining.length === 1
      ? 2000
      : session.remaining.length <= 6
        ? 2300
        : 1550,
  );
}
function finish() {
  clearTimeout(timer);
  timer = null;
  session.active = false;
  session.paused = false;
  session.phase = "won";
  const winner = session.remaining[0];
  $(".arena").classList.remove("running", "elimination", "duel", "paused");
  $(".arena").classList.add("won");
  document.body.classList.remove("session-active");
  $("#reveal-crest").innerHTML = badge(winner);
  $("#reveal-crest").hidden = false;
  $("#reactor").hidden = true;
  $("#finalists").hidden = true;
  $("#result-actions").hidden = false;
  setStage({
    eyebrow: "ÚLTIMO SOBREVIVENTE / O BANCO É TEU",
    title: winner.name,
    description: `${winner.country} · ${winner.league}`,
    stamp: `${session.total - 1} ELIMINAÇÕES. UM NOVO CAPÍTULO.`,
  });
  $("#arena-footer").textContent = "DISPONIBILIDADE NO FM27 POR CONFIRMAR";
  announce(
    `O vencedor é ${winner.name}. Último sobrevivente entre ${session.total} clubes.`,
  );
  history.unshift({
    ...winner,
    date: new Date().toISOString(),
    poolSize: session.total,
    elimination: true,
  });
  history = history.slice(0, 100);
  persist();
  liveTab = "remaining";
  liveSearch = "";
  $("#live-search").value = "";
  render();
  $("#draw").innerHTML = "Novo sorteio <span>↗</span>";
  refreshPlayback();
  replayAnimation();
  [440, 554, 659, 880].forEach((f, i) =>
    setTimeout(() => tone(f, 0.8), i * 160),
  );
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const particles = document.createElement("div");
    particles.className = "confetti";
    particles.innerHTML = Array.from(
      { length: 32 },
      (_, i) =>
        `<span style="left:${(i * 37) % 100}%;animation-delay:${i * 0.035}s;transform:rotate(${i * 29}deg)"></span>`,
    ).join("");
    $(".arena").append(particles);
  }
}
$("#draw").onclick = () => {
  if (running()) return;
  const candidates = pool();
  if (candidates.length < 2) return;
  resetArena();
  void initAudio();
  session = {
    active: true,
    paused: false,
    total: candidates.length,
    remaining: eliminationOrder(candidates),
    eliminated: [],
    finalShown: false,
    phase: "intro",
  };
  liveTab = "remaining";
  liveSearch = "";
  $("#live-search").value = "";
  liveLimit = 150;
  $("#league-picker").open = false;
  $(".arena").classList.add("running");
  document.body.classList.add("session-active");
  setStage({
    eyebrow: "TODOS ENTRAM. SÓ UM FICA.",
    title: "O destino está em movimento.",
    description: `${candidates.length} clubes. A primeira eliminação está a chegar.`,
    stamp: "A MISTURAR O POTE",
  });
  renderSetup();
  renderContenders();
  refreshPlayback();
  announce(`Cerimónia iniciada com ${candidates.length} clubes.`);
  tone(260, 0.6);
  schedule(1800);
  if (matchMedia("(max-width: 700px)").matches)
    requestAnimationFrame(() =>
      $(".arena").scrollIntoView({ behavior: "instant", block: "start" }),
    );
};
$("#pause").onclick = () => {
  if (!running()) return;
  if (session.paused) {
    session.paused = false;
    schedule(pendingBase);
  } else {
    pendingBase = timer
      ? Math.max(0, deadline - performance.now()) * speed
      : pendingBase;
    clearTimeout(timer);
    timer = null;
    session.paused = true;
  }
  refreshPlayback();
  renderContenders();
  announce(session.paused ? "Cerimónia em pausa." : "Cerimónia retomada.");
};
$("#next").onclick = () => {
  if (running()) advance();
};
$("#cancel").onclick = () => {
  if (!running()) return;
  session = null;
  resetArena();
  render();
  toast("Sorteio cancelado. Nenhum resultado foi guardado.");
  announce("Sorteio cancelado.");
};
$("#speed").onchange = (e) => {
  const base =
    running() && !session.paused && timer
      ? Math.max(0, deadline - performance.now()) * speed
      : pendingBase;
  speed = Number(e.target.value);
  if (running()) schedule(base);
  renderSetup();
};
$("#sound").onchange = () => {
  if ($("#sound").checked) {
    void initAudio();
  } else {
    audioContext?.suspend().catch(() => {});
  }
};
$("#focus").onclick = () => {
  const active = document.body.classList.toggle("focus-mode");
  $("#focus").setAttribute("aria-pressed", String(active));
  $("#focus").setAttribute(
    "aria-label",
    active ? "Reduzir palco" : "Expandir palco",
  );
};
$("#share").onclick = async () => {
  if (!session || session.active) return;
  try {
    const winner = session.remaining[0];
    await navigator.clipboard.writeText(
      `O meu próximo save: ${winner.name} (${winner.country}, ${winner.league}). Último sobrevivente de ${session.total} clubes no The Draw!`,
    );
    toast("Resultado copiado. O próximo capítulo é teu.");
  } catch {
    toast(
      "Não foi possível copiar. Podes selecionar o nome do clube no palco.",
    );
  }
};
$("#exclude-result").onclick = () => {
  if (!session || session.active) return;
  const winner = session.remaining[0];
  if (!state.excluded.includes(winner.id)) state.excluded.push(winner.id);
  configure();
  if (pool().length >= 2) $("#draw").click();
  else
    toast(
      "O vencedor foi excluído. Adiciona mais clubes para um novo sorteio.",
    );
};
$("#country").onchange = (e) => {
  if (running()) return;
  state.country = e.target.value;
  clubLimit = 100;
  populateLeagues();
  configure();
};
$("#league-options").onchange = (e) => {
  if (running() || !e.target.matches("input")) return;
  const league = e.target.value;
  state.league = e.target.checked
    ? [...state.league, league]
    : state.league.filter((l) => l !== league);
  leagueSummary();
  clubLimit = 100;
  configure();
};
$("#clear-leagues").onclick = () => {
  if (running()) return;
  state.league = [];
  populateLeagues();
  configure();
};
$("#search").oninput = (e) => {
  search = e.target.value;
  clubLimit = 100;
  renderSetup();
};
$("#live-search").oninput = (e) => {
  liveSearch = e.target.value;
  liveLimit = 150;
  renderContenders();
};
$("#catalog-search").oninput = (e) => {
  catalogSearch = e.target.value;
  catalogLimit = 100;
  renderCatalog();
};
$("#all-mode").onclick = () => {
  if (running()) return;
  state.shortlistOnly = false;
  configure();
};
$("#list-mode").onclick = () => {
  if (running()) return;
  state.shortlistOnly = true;
  configure();
};
$("#reset").onclick = () => {
  if (running()) return;
  Object.assign(state, {
    country: "",
    league: [],
    shortlistOnly: false,
    excluded: [],
  });
  search = "";
  $("#search").value = "";
  populate();
  configure();
};
$("#remaining-tab").onclick = () => {
  liveTab = "remaining";
  liveLimit = 150;
  renderContenders();
};
$("#eliminated-tab").onclick = () => {
  liveTab = "eliminated";
  liveLimit = 150;
  renderContenders();
};
$("#more-clubs").onclick = () => {
  clubLimit += 100;
  renderSetup();
};
$("#more-contenders").onclick = () => {
  liveLimit += 150;
  renderContenders();
};
$("#more-catalog").onclick = () => {
  catalogLimit += 100;
  renderCatalog();
};
$("#explore-link").onclick = () => view("clubs");
$("#clear-history").onclick = () => {
  history = [];
  persist();
  renderHistory();
  toast("Histórico limpo.");
};
document.addEventListener("click", (e) => {
  const nav = e.target.closest("[data-view]");
  if (nav) view(nav.dataset.view);
  const star = e.target.closest("[data-star]"),
    exclude = e.target.closest("[data-exclude]");
  if (star || exclude) {
    if (running()) return;
    const key = star ? "shortlist" : "excluded",
      id = (star || exclude).dataset[star ? "star" : "exclude"];
    state[key] = state[key].includes(id)
      ? state[key].filter((x) => x !== id)
      : [...state[key], id];
    configure();
  }
  if (!e.target.closest("#league-picker")) $("#league-picker").open = false;
});
document.addEventListener("focusin", (e) => {
  if (!e.target.closest("#league-picker")) $("#league-picker").open = false;
});
$("#league-options").addEventListener("click", (e) => {
  if (e.target.closest(".league-done")) $("#league-picker").open = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("#league-picker").open = false;
});
$("#import-button").onclick = () => $("#import-file").click();
$("#import-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file || running()) return;
  try {
    if (file.size > 15000000)
      throw new Error("O ficheiro não pode exceder 15 MB.");
    const imported = validateImport(JSON.parse(await file.text()));
    localStorage.setItem("draw-import", JSON.stringify(imported));
    clubs = imported;
    importedData = true;
    Object.assign(state, {
      country: "",
      league: [],
      shortlist: [],
      excluded: [],
      shortlistOnly: false,
    });
    search = "";
    catalogSearch = "";
    $("#search").value = "";
    $("#catalog-search").value = "";
    populate();
    configure();
    toast(
      imported.length +
        " clubes importados. Disponibilidade no FM27 por confirmar.",
    );
  } catch (error) {
    toast(error.message);
  }
  e.target.value = "";
};
$("#restore-data").onclick = () => {
  if (running()) return;
  try {
    localStorage.removeItem("draw-import");
  } catch {
    toast("Não foi possível restaurar os dados.");
    return;
  }
  clubs = initialClubs;
  importedData = false;
  Object.assign(state, {
    country: "",
    league: [],
    shortlist: [],
    excluded: [],
    shortlistOnly: false,
  });
  search = "";
  catalogSearch = "";
  $("#search").value = "";
  $("#catalog-search").value = "";
  populate();
  configure();
  toast("Base de demonstração restaurada.");
};
populate();
render();
