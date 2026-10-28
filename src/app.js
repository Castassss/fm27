import { clubs as initialClubs } from "./data.js";
import { eliminationOrder, validateImport } from "./engine.js";
import {
  journeys,
  challenges,
  candidatesFor,
  selectionSnapshot,
  restoreSelection,
  probabilityLabel,
} from "./experience.js";
import { icon } from "./icons.js";

const $ = (s) => document.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const id = () =>
  crypto.randomUUID?.() ||
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    toast(
      "Não foi possível guardar no navegador. Liberta espaço ou permite o armazenamento local.",
    );
    return false;
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
const oldPreferences = read("draw-preferences", {});
let selection;
try {
  selection = restoreSelection(
    read("draw-selection", {
      journey: "world",
      challenge: "free",
      shortlist: oldPreferences?.shortlist || [],
      excluded: oldPreferences?.excluded || [],
    }),
  );
} catch {
  selection = restoreSelection({});
}
const themes = [
  { id: "lavender", name: "Lavanda", color: "#7860ca" },
  { id: "mint", name: "Campo", color: "#287b65" },
  { id: "rose", name: "Rosa", color: "#b34e74" },
  { id: "ocean", name: "Oceano", color: "#346eae" },
  { id: "night", name: "Noite", color: "#43374f" },
];
const storedSettings = read("draw-settings", {});
const settings = {
  theme: themes.some((t) => t.id === storedSettings?.theme)
    ? storedSettings.theme
    : "lavender",
  sound: storedSettings?.sound === true,
  volume: Number.isFinite(storedSettings?.volume)
    ? Math.max(0, Math.min(100, storedSettings.volume))
    : 45,
  voice: storedSettings?.voice === true && "speechSynthesis" in window,
  milestones: storedSettings?.milestones !== false,
  reducedMotion: storedSettings?.reducedMotion === true,
  manual: storedSettings?.manual === true,
  speed: [1, 2, 4].includes(storedSettings?.speed) ? storedSettings.speed : 1,
};
function validRecords(value) {
  return Array.isArray(value)
    ? value
        .filter(
          (c) =>
            c &&
            typeof c.name === "string" &&
            typeof c.country === "string" &&
            typeof c.league === "string",
        )
        .slice(0, 100)
        .map((c) => ({
          ...c,
          runId: typeof c.runId === "string" ? c.runId : id(),
          challenge: challenges.some((r) => r.id === c.challenge)
            ? c.challenge
            : "free",
        }))
    : [];
}
let history = validRecords(read("draw-history", [])),
  accepted = validRecords(read("draw-saves", []));
let presets = [];
try {
  const saved = read("draw-presets", []);
  if (Array.isArray(saved))
    presets = saved
      .filter(
        (p) => p && typeof p.id === "string" && typeof p.name === "string",
      )
      .slice(0, 20)
      .map((p) => ({ ...p, selection: restoreSelection(p.selection) }));
} catch {}
let currentStep = 1,
  activeView = "draw",
  search = "",
  liveSearch = "",
  liveTab = "remaining",
  clubLimit = 60,
  liveLimit = 100,
  session = null,
  timer = null,
  deadline = 0,
  pendingBase = 0,
  toastTimer,
  confirmation = null,
  audioContext,
  masterGain;
const running = () => !!session?.active;
const pool = () => candidatesFor(clubs, selection);
const rule = (key) => challenges.find((c) => c.id === key) || challenges[0];
const journey = (key) => journeys.find((j) => j.id === key) || journeys[0];
const match = (club, query) =>
  `${club.name} ${club.country} ${club.league}`
    .toLocaleLowerCase("pt")
    .includes(query.toLocaleLowerCase("pt"));
const reduced = () =>
  settings.reducedMotion ||
  matchMedia("(prefers-reduced-motion: reduce)").matches;
function hydrate(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
function badge(club) {
  const initials = club.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
  const palette = ["#7c66b1", "#b56a7e", "#34816f", "#ae7a3a", "#537fa6"];
  const color =
    palette[
      Array.from(club.name).reduce((sum, c) => sum + c.charCodeAt(0), 0) %
        palette.length
    ];
  return `<span class="badge" style="--club-color:${color}" aria-hidden="true">${esc(initials)}</span>`;
}
function toast(message) {
  const dialog = document.querySelector("dialog[open]");
  if (dialog) {
    let status = dialog.querySelector(".dialog-status");
    if (!status) {
      status = document.createElement("p");
      status.className = "dialog-status";
      status.setAttribute("role", "status");
      dialog.append(status);
    }
    status.textContent = message;
    setTimeout(() => status.remove(), 5000);
    return;
  }
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 5000);
}
function announce(message) {
  $("#announcer").textContent = message;
  if (!settings.voice || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "pt-PT";
    utterance.rate = 1.05;
    utterance.volume = settings.volume / 100;
    const voice =
      speechSynthesis.getVoices().find((v) => v.lang === "pt-PT") ||
      speechSynthesis.getVoices().find((v) => v.lang.startsWith("pt"));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  } catch {}
}
function persistSelection() {
  write("draw-selection", selectionSnapshot(selection));
  write("draw-preferences", {
    shortlist: selection.shortlist,
    excluded: selection.excluded,
  });
}
function persistSettings() {
  write("draw-settings", settings);
}
function baseForFilters() {
  return candidatesFor(clubs, {
    ...selection,
    countries: [],
    leagues: [],
    excluded: [],
  });
}
function visibleClubs() {
  return candidatesFor(clubs, { ...selection, excluded: [] }).filter((c) =>
    match(c, search),
  );
}
function renderJourneys() {
  $("#journeys").innerHTML = journeys
    .map((j) => {
      const count = candidatesFor(clubs, {
        journey: j.id,
        shortlist: selection.shortlist,
      }).length;
      return `<button class="journey-card ${selection.journey === j.id ? "selected" : ""}" data-journey="${j.id}" aria-pressed="${selection.journey === j.id}" ${count < 2 && j.id !== "shortlist" ? "disabled" : ""}><span class="journey-icon ${j.color}">${icon(j.icon)}</span><span class="selection-indicator">${selection.journey === j.id ? icon("check") : ""}</span><strong>${j.title}</strong><p>${j.description}</p><span class="journey-count">${count} ${j.id === "shortlist" ? "favoritos guardados" : "clubes nesta base"}</span></button>`;
    })
    .join("");
  $("#challenges").innerHTML = challenges
    .map(
      (c) =>
        `<button class="challenge-card ${selection.challenge === c.id ? "selected" : ""}" data-challenge="${c.id}" aria-pressed="${selection.challenge === c.id}">${icon(c.icon)}<span><strong>${c.title}</strong><small>${c.description}</small></span></button>`,
    )
    .join("");
}
function renderFilters() {
  const base = baseForFilters(),
    countries = [...new Set(base.map((c) => c.country))].sort((a, b) =>
      a.localeCompare(b, "pt"),
    );
  const selectedCountries = new Set(selection.countries);
  $("#country-options").innerHTML =
    countries
      .map(
        (country) =>
          `<label class="filter-option"><input type="checkbox" data-country="${esc(country)}" ${selectedCountries.has(country) ? "checked" : ""}><span>${esc(base.find((c) => c.country === country).flag)} ${esc(country)}</span><small>${base.filter((c) => c.country === country).length}</small></label>`,
      )
      .join("") ||
    '<p class="empty">Adiciona favoritos para filtrar a tua shortlist.</p>';
  const countryClubs = base.filter(
    (c) =>
      !selection.countries.length || selection.countries.includes(c.country),
  );
  const leagues = [...new Set(countryClubs.map((c) => c.league))].sort((a, b) =>
    a.localeCompare(b, "pt"),
  );
  $("#league-options").innerHTML = leagues
    .map(
      (league) =>
        `<label class="filter-option"><input type="checkbox" data-league="${esc(league)}" ${selection.leagues.includes(league) ? "checked" : ""}><span>${esc(league)}</span></label>`,
    )
    .join("");
  const j = journey(selection.journey);
  $("#journey-summary").innerHTML =
    icon(j.icon) + esc(j.title) + "<span>Alterar</span>";
}
function renderClubs() {
  const visible = visibleClubs(),
    excluded = new Set(selection.excluded),
    shortlist = new Set(selection.shortlist),
    eligible = pool();
  $("#visible-count").textContent = visible.length + " resultados";
  $("#club-list").innerHTML =
    visible
      .slice(0, clubLimit)
      .map(
        (c) =>
          `<article class="club-card ${excluded.has(c.id) ? "" : "included"}"><button class="club-toggle" data-toggle="${esc(c.id)}" aria-pressed="${!excluded.has(c.id)}" aria-label="${excluded.has(c.id) ? "Incluir" : "Retirar"} ${esc(c.name)}">${badge(c)}<div><strong>${esc(c.name)}</strong><small>${esc(c.flag)} ${esc(c.country)}<br>${esc(c.league)}</small></div><span class="club-check">${icon("check")}</span></button><button class="club-favorite ${shortlist.has(c.id) ? "chosen" : ""}" data-star="${esc(c.id)}" aria-pressed="${shortlist.has(c.id)}" aria-label="${shortlist.has(c.id) ? "Remover dos" : "Adicionar aos"} favoritos: ${esc(c.name)}" title="${shortlist.has(c.id) ? "Remover dos favoritos" : "Guardar nos favoritos"}">${icon("heart")}</button></article>`,
      )
      .join("") ||
    `<div class="empty"><strong>${selection.journey === "shortlist" && !selection.shortlist.length ? "A tua shortlist ainda está em branco." : "Nenhum clube por aqui."}</strong>${selection.journey === "shortlist" && !selection.shortlist.length ? "Escolhe primeiro os teus favoritos com o coração. Depois voltamos ao sorteio." : "Experimenta outro país, outra liga ou uma pesquisa diferente."}<br><button class="text-button" data-action="explore-world">Explorar todos os clubes ${icon("arrow")}</button></div>`;
  $("#more-clubs").hidden = visible.length <= clubLimit;
  $("#include-visible").disabled = !visible.some((c) => excluded.has(c.id));
  $("#exclude-visible").disabled = !visible.some((c) => !excluded.has(c.id));
  $("#eligible-count").textContent = eligible.length + " clubes no teu pote";
  $("#pool-description").textContent =
    eligible.length < 2
      ? "Precisamos de pelo menos 2 clubes."
      : probabilityLabel(eligible.length) + " de hipótese por clube";
  $("#go-ceremony").disabled = eligible.length < 2;
  $("#odds-label").textContent = eligible.length
    ? "1 em " + eligible.length + " para cada clube."
    : "O teu pote está vazio.";
  $("#selection-save-summary").textContent =
    eligible.length +
    " clubes · " +
    journey(selection.journey).title +
    " · " +
    rule(selection.challenge).title;
}
function renderContenders() {
  const remaining = session ? session.remaining : pool(),
    eliminated = session ? session.eliminated : [],
    total = session ? session.total : remaining.length,
    done = eliminated.length;
  $("#remaining-count").textContent = remaining.length;
  $("#remaining-tab-count").textContent = remaining.length;
  $("#eliminated-count").textContent = done;
  const progress = total > 1 ? Math.round((done / (total - 1)) * 100) : 0;
  $("#progress-fill").style.width = progress + "%";
  $("#progress-value").textContent = progress + "%";
  $("#progress-label").textContent = !session
    ? "Prontos para entrar"
    : !session.active
      ? "Um clube ficou. Uma história começa."
      : session.paused
        ? settings.manual
          ? "A tua próxima revelação"
          : "O momento está em pausa"
        : done + " de " + (total - 1) + " eliminações";
  for (const key of ["remaining", "eliminated"]) {
    const selected = liveTab === key;
    $("#" + key + "-tab").classList.toggle("selected", selected);
    $("#" + key + "-tab").setAttribute("aria-selected", String(selected));
    $("#" + key + "-tab").tabIndex = selected ? 0 : -1;
  }
  $("#contenders").setAttribute("aria-labelledby", liveTab + "-tab");
  const list = (
    liveTab === "remaining"
      ? [...remaining].sort((a, b) => a.name.localeCompare(b.name, "pt"))
      : eliminated
          .map((club, index) => ({ ...club, round: index + 1 }))
          .reverse()
  ).filter((c) => match(c, liveSearch));
  $("#contenders").innerHTML =
    list
      .slice(0, liveLimit)
      .map(
        (c) =>
          `<div class="contender ${liveTab === "eliminated" ? "out" : ""} ${session && !session.active && liveTab === "remaining" ? "winner" : ""}">${badge(c)}<div class="club-info"><strong>${esc(c.name)}</strong><small>${esc(c.country)}</small></div>${running() && liveTab === "remaining" ? `<button class="cheer-button ${session.cheer === c.id ? "cheering" : ""}" data-cheer="${esc(c.id)}" aria-pressed="${session.cheer === c.id}" aria-label="Torcer por ${esc(c.name)}" title="Torcer, sem alterar probabilidades">${icon("heart")}</button>` : `<span class="club-state">${liveTab === "eliminated" ? "#" + c.round : session && !session.active ? "É TEU" : "●"}</span>`}</div>`,
      )
      .join("") ||
    `<div class="empty">${liveSearch ? "Não encontramos esse clube." : liveTab === "eliminated" ? "Por enquanto, todos têm uma hipótese." : "Ainda não há clubes neste pote."}</div>`;
  $("#more-contenders").hidden = list.length <= liveLimit;
  $("#live-update").textContent = !session
    ? "Cada eliminação fica registada aqui."
    : !session.active
      ? "O último a ficar é o teu próximo desafio."
      : remaining.length === 2
        ? "Só restam dois. O frio na barriga é real."
        : done +
          " " +
          (done === 1
            ? "clube ficou pelo caminho."
            : "clubes ficaram pelo caminho.");
}
function renderCollection() {
  $("#collection-count").textContent = presets.length + accepted.length;
  $("#saved-selections").innerHTML =
    presets
      .map((p) => {
        const j = journey(p.selection.journey),
          count = candidatesFor(clubs, p.selection).length;
        return `<article class="collection-card"><span class="journey-icon ${j.color}">${icon(j.icon)}</span><span class="card-tag">SELEÇÃO GUARDADA</span><h3>${esc(p.name)}</h3><p>${count} clubes disponíveis · ${esc(j.title)}<br>${esc(rule(p.selection.challenge).title)}</p><div class="card-actions"><button class="secondary" data-load="${esc(p.id)}">Voltar a este pote ${icon("arrow")}</button><button class="text-button" data-delete-preset="${esc(p.id)}">Eliminar</button></div></article>`;
      })
      .join("") ||
    '<div class="empty"><strong>Aquela seleção que vale a pena guardar.</strong>Prepara o teu pote e usa “Guardar seleção”. Na próxima visita, está tudo pronto.</div>';
  $("#accepted-saves").innerHTML =
    accepted.map((c) => recordCard(c, true)).join("") ||
    '<div class="empty"><strong>A tua próxima grande história ainda está para chegar.</strong>Depois do sorteio, aceita o teu destino. Guardamos aqui o clube e o desafio que escolheste.</div>';
  $("#restore-data").hidden = !importedData;
}
function recordCard(c, isAccepted = false) {
  return `<article class="collection-card">${badge(c)}<span class="card-tag">${isAccepted ? "SAVE ESCOLHIDO" : c.elimination ? "ÚLTIMO SOBREVIVENTE" : "SORTEIO CLÁSSICO"}</span><h3>${esc(c.saveName || c.name)}</h3><p>${esc(c.saveName ? c.name + " · " : "")}${esc(c.country)} · ${esc(c.league)}</p><p>${Number(c.poolSize) || 0} clubes no pote · ${esc(rule(c.challenge).title)}</p><p>${esc(new Date(c.date).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" }))}</p><div class="card-actions"><button class="secondary" data-detail="${esc(c.runId)}">Abrir a minha ficha ${icon("arrow")}</button>${isAccepted ? `<button class="text-button" data-delete-save="${esc(c.runId)}">Retirar da coleção</button>` : ""}</div></article>`;
}
function renderHistory() {
  $("#history-count").textContent = history.length;
  $("#clear-history").disabled = !history.length;
  $("#history").innerHTML =
    history.map((c) => recordCard(c)).join("") ||
    '<div class="empty"><strong>O primeiro capítulo ainda não foi escrito.</strong>Conclui um sorteio e o resultado fica guardado aqui.</div>';
}
function renderData() {
  $("#data-count").textContent =
    clubs.length +
    " clubes " +
    (importedData ? "importados" : "de demonstração");
  $(".demo-tag").textContent = importedData
    ? "A TUA BASE IMPORTADA"
    : "BASE DE DEMONSTRAÇÃO";
}
function renderAll() {
  renderJourneys();
  renderFilters();
  renderClubs();
  renderContenders();
  renderCollection();
  renderHistory();
  renderData();
  renderMode();
}
function configChanged() {
  if (running()) return;
  session = null;
  resetArena();
  persistSelection();
  renderAll();
}
function goStep(step, scroll = true) {
  if (running() && step !== 3) {
    toast("Termina ou cancela a cerimónia para alterar o pote.");
    return;
  }
  if (step === 3 && pool().length < 2) {
    toast("Escolhe pelo menos dois clubes.");
    step = 2;
  }
  if (step !== 3) setCinema(false);
  activeView = "draw";
  currentStep = step;
  document
    .querySelectorAll(".view")
    .forEach((el) => (el.hidden = el.id !== "draw-view"));
  document
    .querySelectorAll(".nav")
    .forEach((el) => el.classList.toggle("active", el.dataset.view === "draw"));
  document
    .querySelectorAll(".wizard-step")
    .forEach((el) => (el.hidden = el.id !== "step-" + step));
  document.querySelectorAll("[data-step]").forEach((el) => {
    if (!el.closest(".wizard-nav")) return;
    const index = Number(el.dataset.step);
    el.classList.toggle("current", index === step);
    el.classList.toggle("complete", index < step);
    if (index === step) el.setAttribute("aria-current", "step");
    else el.removeAttribute("aria-current");
  });
  if (step === 3) {
    renderContenders();
    refreshPlayback();
  }
  if (scroll)
    requestAnimationFrame(() =>
      $(".wizard-nav").scrollIntoView({ behavior: "instant", block: "start" }),
    );
}
function showView(name) {
  if (running()) {
    if (name !== "draw") toast("Termina ou cancela a cerimónia antes de sair.");
    return;
  }
  if (name === "draw") {
    goStep(currentStep);
    return;
  }
  setCinema(false);
  activeView = name;
  document
    .querySelectorAll(".view")
    .forEach((el) => (el.hidden = el.id !== name + "-view"));
  document
    .querySelectorAll(".nav")
    .forEach((el) => el.classList.toggle("active", el.dataset.view === name));
  renderCollection();
  renderHistory();
  window.scrollTo({ top: 0, behavior: "instant" });
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
    "four-final",
    "won",
    "paused",
  );
  $(".confetti")?.remove();
  document.body.classList.remove("session-active");
  $("#stage-ball").hidden = false;
  $("#reveal-crest").hidden = true;
  $("#countdown").hidden = true;
  $("#finalists").hidden = true;
  $("#winner-dossier").hidden = true;
  $("#ceremony-options").hidden = false;
  $("#live-label").textContent = "O TEU LUGAR ESTÁ RESERVADO";
  $("#round-label").textContent = "CERIMÓNIA / 2027";
  $("#arena-footer").textContent = "O ÚLTIMO CLUBE É O TEU DESTINO";
  setStage({
    eyebrow: "UM CLUBE. INFINITAS POSSIBILIDADES.",
    description: "É aqui que a indecisão dá lugar a uma nova aventura.",
    stamp: "À TUA ESPERA",
  });
  $("#stage-title").innerHTML = "O próximo capítulo<br>ainda não tem nome.";
  refreshPlayback();
}
function renderMode() {
  $("#auto-mode").classList.toggle("selected", !settings.manual);
  $("#manual-mode").classList.toggle("selected", settings.manual);
  $("#auto-mode").setAttribute("aria-pressed", String(!settings.manual));
  $("#manual-mode").setAttribute("aria-pressed", String(settings.manual));
  $("#auto-mode").disabled = running();
  $("#manual-mode").disabled = running();
}
function refreshPlayback() {
  const active = running(),
    eligible = pool();
  $("#draw").hidden = active;
  $("#draw").disabled = eligible.length < 2;
  $("#session-controls").hidden = !active;
  $("#draw").innerHTML =
    (session && !session.active
      ? "Outra história? Sortear de novo"
      : "Vamos a isto") + icon("play");
  $("#pause").hidden = active && session.manual;
  $("#pause").innerHTML =
    icon(session?.paused ? "play" : "pause") +
    (session?.paused ? "Retomar" : "Pausar");
  $("#pause").setAttribute("aria-pressed", String(!!session?.paused));
  $("#next").innerHTML =
    (session?.remaining.length === 1
      ? "Conhecer o meu clube"
      : "Revelar próximo") + icon("arrow");
  $("#edit-clubs").disabled = active;
  $("#back-selection").hidden = active;
  $("#ceremony-options").hidden = active;
  $("#deck-title").textContent = active
    ? session.paused
      ? session.manual
        ? "És tu que comandas o momento."
        : "Respira. O destino pode esperar."
      : "Cada vez mais perto do teu próximo save."
    : session
      ? "Um clube ficou. Agora começa a tua parte."
      : "Pronto para deixar o destino jogar?";
  $("#deck-description").textContent = active
    ? `${session.remaining.length} em jogo · ${session.eliminated.length} eliminados · ${session.manual ? "revela um momento de cada vez." : "o teu ritmo não altera o resultado."}`
    : session
      ? "Aceita o desafio, guarda o cartão ou volta a tentar."
      : `${eligible.length} clubes · ${probabilityLabel(eligible.length)} por clube · ${rule(selection.challenge).title}`;
  $("#live-label").textContent = active
    ? session.paused
      ? session.manual
        ? "A TUA VEZ DE REVELAR"
        : "UM INSTANTE PARA RESPIRAR"
      : "A ACONTECER AGORA"
    : session
      ? "O DESTINO ESTÁ ESCOLHIDO"
      : "O TEU LUGAR ESTÁ RESERVADO";
  $(".arena").classList.toggle("paused", !!session?.paused);
  renderMode();
}
async function initAudio() {
  if (!settings.sound) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (!masterGain) {
      masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
    }
    masterGain.gain.setValueAtTime(
      (settings.volume / 100) * 0.2,
      audioContext.currentTime,
    );
    await audioContext.resume();
  } catch {
    toast("O som não está disponível neste navegador.");
  }
}
function playCue(kind) {
  if (!settings.sound || !audioContext || !masterGain) return;
  const now = audioContext.currentTime;
  const notes =
    kind === "winner"
      ? [261.63, 329.63, 392, 523.25]
      : kind === "final"
        ? [220, 329.63, 440]
        : kind === "out"
          ? [330, 220]
          : kind === "count"
            ? [440]
            : [261.63, 392];
  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator(),
      gain = audioContext.createGain(),
      start = now + index * (kind === "winner" ? 0.14 : 0.11),
      duration = kind === "winner" ? 1.2 : 0.35;
    oscillator.type = kind === "out" ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration);
  });
}
function silence() {
  try {
    speechSynthesis?.cancel();
  } catch {}
  if (masterGain && audioContext)
    masterGain.gain.setValueAtTime(0, audioContext.currentTime);
}
function replay() {
  const el = $("#arena-content");
  el.classList.remove("reveal-motion");
  if (!reduced()) {
    void el.offsetWidth;
    el.classList.add("reveal-motion");
  }
}
function schedule(base) {
  clearTimeout(timer);
  pendingBase = base;
  if (!running() || session.paused) {
    timer = null;
    return;
  }
  deadline = performance.now() + base / settings.speed;
  timer = setTimeout(advance, base / settings.speed);
}
function displayFinalists(count) {
  $(".arena").classList.remove("elimination", "duel", "four-final");
  $(".arena").classList.add(count === 2 ? "duel" : "four-final");
  $("#stage-ball").hidden = true;
  $("#countdown").hidden = true;
  $("#reveal-crest").hidden = true;
  $("#finalists").hidden = false;
  $("#finalists").classList.toggle("four", count === 4);
  $("#finalists").innerHTML = session.remaining
    .map(
      (c) =>
        `<div class="finalist">${badge(c)}<strong>${esc(c.name)}</strong><small>${esc(c.country)}<br>${esc(c.league)}</small></div>`,
    )
    .join(count === 2 ? '<span class="versus">ou</span>' : "");
  setStage({
    eyebrow: count === 2 ? "A GRANDE FINAL" : "OS QUATRO FINALISTAS",
    title: count === 2 ? "Um deles vai ser teu." : "Agora está mesmo perto.",
    description:
      count === 2
        ? "Uma última bola. Uma história à tua espera."
        : "Quatro clubes resistiram. Qual deles te faz sonhar?",
    stamp:
      count === 2
        ? "O TEU PRÓXIMO CAPÍTULO ESTÁ AQUI"
        : "AINDA HÁ TUDO PARA JOGAR",
  });
  announce(
    (count === 2 ? "A grande final: " : "Os quatro finalistas: ") +
      session.remaining.map((c) => c.name).join(", "),
  );
  playCue("final");
  replay();
  renderContenders();
  refreshPlayback();
  schedule(count === 2 ? 3800 : 2800);
}
function advance() {
  clearTimeout(timer);
  timer = null;
  if (!running()) return;
  if (session.countdown > 1) {
    session.countdown--;
    $("#countdown").textContent = session.countdown;
    playCue("count");
    replay();
    schedule(800);
    return;
  }
  if (session.countdown === 1) {
    session.countdown = 0;
    $("#countdown").hidden = true;
  }
  if (session.remaining.length === 1) {
    finish();
    return;
  }
  if (session.remaining.length === 4 && session.moments && !session.fourShown) {
    session.fourShown = true;
    displayFinalists(4);
    return;
  }
  if (session.remaining.length === 2 && !session.finalShown) {
    session.finalShown = true;
    displayFinalists(2);
    return;
  }
  const removed = session.remaining.shift();
  session.eliminated.push(removed);
  $(".arena").classList.remove("duel", "four-final");
  $(".arena").classList.add("elimination");
  $("#stage-ball").hidden = true;
  $("#countdown").hidden = true;
  $("#finalists").hidden = true;
  $("#reveal-crest").innerHTML = badge(removed);
  $("#reveal-crest").hidden = false;
  setStage({
    eyebrow:
      session.remaining.length === 1
        ? "A ÚLTIMA ELIMINAÇÃO"
        : session.cheer === removed.id
          ? "O TEU PALPITE FICOU PELO CAMINHO"
          : "HOJE, A HISTÓRIA NÃO É AQUI",
    title: removed.name,
    description: `${removed.country} · ${removed.league}`,
    stamp:
      session.remaining.length === 1
        ? "UM CLUBE RESISTIU A TUDO"
        : "ELIMINADO. O SONHO CONTINUA NOUTRO BANCO.",
  });
  $("#round-label").textContent =
    "ELIMINAÇÃO " + session.eliminated.length + " DE " + (session.total - 1);
  $("#arena-footer").textContent =
    session.remaining.length === 1
      ? "PREPARA-TE PARA O TEU NOVO CLUBE"
      : session.remaining.length + " HISTÓRIAS AINDA PODEM SER TUAS";
  playCue("out");
  announce(
    removed.name +
      " está eliminado. " +
      session.remaining.length +
      (session.remaining.length === 1
        ? " clube continua."
        : " clubes continuam."),
  );
  replay();
  renderContenders();
  refreshPlayback();
  schedule(
    session.remaining.length === 1
      ? 2200
      : session.remaining.length <= 6
        ? 2500
        : 1700,
  );
}
function finish() {
  clearTimeout(timer);
  timer = null;
  session.active = false;
  session.paused = false;
  const winner = session.remaining[0];
  session.record = {
    ...winner,
    runId: id(),
    date: new Date().toISOString(),
    poolSize: session.total,
    elimination: true,
    challenge: session.challenge,
    prediction: session.cheer,
  };
  $(".arena").classList.remove(
    "running",
    "elimination",
    "duel",
    "four-final",
    "paused",
  );
  $(".arena").classList.add("won");
  document.body.classList.remove("session-active");
  $("#stage-ball").hidden = true;
  $("#countdown").hidden = true;
  $("#finalists").hidden = true;
  $("#reveal-crest").innerHTML = badge(winner);
  $("#reveal-crest").hidden = false;
  setStage({
    eyebrow: "O BANCO É TEU. FAZ HISTÓRIA.",
    title: winner.name,
    description: `${winner.country} · ${winner.league}`,
    stamp: "O ÚLTIMO SOBREVIVENTE. O TEU PRÓXIMO SAVE.",
  });
  $("#arena-footer").textContent = "UMA NOVA HISTÓRIA COMEÇA CONTIGO";
  history.unshift(session.record);
  history = history.slice(0, 100);
  write("draw-history", history);
  liveTab = "remaining";
  liveSearch = "";
  $("#live-search").value = "";
  $("#winner-dossier").hidden = false;
  const challenge = rule(session.challenge);
  $("#winner-promise").textContent =
    challenge.id === "free"
      ? "O destino escolheu o clube. Agora és tu que decides o futebol que queres jogar e a história que queres deixar."
      : challenge.title + ": " + challenge.description;
  updateAcceptance();
  renderHistory();
  renderCollection();
  renderContenders();
  refreshPlayback();
  playCue("winner");
  announce(
    "O teu próximo clube é " + winner.name + ". O banco é teu. Faz história.",
  );
  replay();
  if (!reduced()) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.innerHTML = Array.from(
      { length: 40 },
      (_, i) =>
        `<span style="left:${(i * 37) % 100}%;animation-delay:${i * 0.03}s"></span>`,
    ).join("");
    $(".arena").append(confetti);
  }
}
function startDraw() {
  if (running() || pool().length < 2) return;
  const candidates = pool();
  resetArena();
  void initAudio();
  session = {
    active: true,
    paused: settings.manual,
    manual: settings.manual,
    cheer: null,
    total: candidates.length,
    remaining: eliminationOrder(candidates),
    eliminated: [],
    countdown: settings.manual ? 0 : 3,
    finalShown: false,
    fourShown: false,
    moments: settings.milestones,
    challenge: selection.challenge,
  };
  liveTab = "remaining";
  liveSearch = "";
  liveLimit = 100;
  $("#live-search").value = "";
  $(".arena").classList.add("running");
  document.body.classList.add("session-active");
  if (settings.manual) {
    setStage({
      eyebrow: "O TEU MOMENTO, AO TEU RITMO",
      title: "A primeira bola é contigo.",
      description: "Carrega em “Revelar próximo” para descobrir quem sai.",
      stamp: candidates.length + " CLUBES. UMA HISTÓRIA PARA COMEÇAR.",
    });
  } else {
    $("#stage-ball").hidden = true;
    $("#countdown").hidden = false;
    $("#countdown").textContent = "3";
    setStage({
      eyebrow: "ESTÁ QUASE A COMEÇAR",
      title: "Há um novo save à tua espera.",
      description: candidates.length + " clubes. Um só destino.",
      stamp: "RESPIRA FUNDO. DEIXA ACONTECER.",
    });
    playCue("count");
  }
  renderMode();
  renderContenders();
  refreshPlayback();
  announce("O sorteio vai começar com " + candidates.length + " clubes.");
  schedule(800);
  if (matchMedia("(max-width: 600px)").matches)
    requestAnimationFrame(() =>
      $(".arena").scrollIntoView({ behavior: "instant", block: "start" }),
    );
}
function updateAcceptance() {
  const exists =
    !!session?.record && accepted.some((c) => c.runId === session.record.runId);
  $("#accept-winner").disabled = exists;
  $("#accept-winner").innerHTML =
    icon(exists ? "check" : "bookmark") +
    (exists ? "Na tua coleção" : "Aceitar este destino");
}
function acceptRecord(record) {
  if (accepted.some((c) => c.runId === record.runId)) return;
  if (accepted.length >= 100) {
    toast("A coleção tem 100 saves. Retira um para guardar outro.");
    return;
  }
  const next = [{ ...record }, ...accepted];
  if (!write("draw-saves", next)) return;
  accepted = next;
  write("draw-history", history);
  updateAcceptance();
  renderCollection();
  toast("Está decidido. O teu próximo save ficou na coleção.");
}
function applySettings() {
  document.body.dataset.theme = settings.theme;
  document.body.classList.toggle("reduced-motion", settings.reducedMotion);
  document.querySelector('meta[name="theme-color"]').content =
    settings.theme === "night" ? "#201f26" : "#f8f7f3";
  $("#sound").checked = settings.sound;
  $("#voice").checked = settings.voice;
  $("#voice").disabled = !("speechSynthesis" in window);
  $("#voice-help").textContent =
    "speechSynthesis" in window
      ? "Usa as vozes disponíveis no teu navegador."
      : "Este navegador não suporta anúncio por voz.";
  $("#volume").value = settings.volume;
  $("#volume-value").textContent = settings.volume + "%";
  $("#milestones").checked = settings.milestones;
  $("#reduced-motion").checked = settings.reducedMotion;
  $("#speed").value = settings.speed;
  $("#themes").innerHTML = themes
    .map(
      (t) =>
        `<button class="theme-option ${settings.theme === t.id ? "selected" : ""}" data-theme-choice="${t.id}" aria-pressed="${settings.theme === t.id}"><span class="theme-swatch" style="background:${t.color}">${settings.theme === t.id ? icon("check") : ""}</span>${t.name}</button>`,
    )
    .join("");
  if (masterGain && audioContext)
    masterGain.gain.setValueAtTime(
      settings.sound ? (settings.volume / 100) * 0.2 : 0,
      audioContext.currentTime,
    );
  renderMode();
}
function openSettings() {
  applySettings();
  $("#settings-dialog").showModal();
}
function confirmAction(title, description, action) {
  confirmation = action;
  $("#confirm-title").textContent = title;
  $("#confirm-description").textContent = description;
  $("#confirm-dialog").showModal();
}
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCard(record) {
  const palette = themes.find((t) => t.id === settings.theme) || themes[0];
  const words = record.name.split(" "),
    lines = [""];
  for (const word of words) {
    const last = lines.length - 1;
    if ((lines[last] + " " + word).trim().length > 25 && lines[last])
      lines.push(word);
    else lines[last] = (lines[last] + " " + word).trim();
  }
  const title = lines
    .slice(0, 4)
    .map(
      (line, index) =>
        `<text x="70" y="${240 + index * 62}" font-family="Georgia,serif" font-size="54" fill="#292637">${esc(line)}</text>`,
    )
    .join("");
  const challenge = rule(record.challenge);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700"><rect width="1000" height="700" rx="30" fill="#f8f7f3"/><circle cx="920" cy="100" r="240" fill="${palette.color}" opacity=".12"/><text x="70" y="80" font-family="Arial,sans-serif" font-weight="700" font-size="30" fill="#292637">the draw.</text><text x="70" y="155" font-family="Arial,sans-serif" font-size="13" letter-spacing="3" fill="${palette.color}">O BANCO É TEU. FAZ HISTÓRIA.</text>${title}<text x="70" y="${280 + Math.min(lines.length, 4) * 62}" font-family="Arial,sans-serif" font-size="21" fill="#777383">${esc(record.country)} · ${esc(record.league)}</text><rect x="70" y="535" width="860" height="70" rx="12" fill="${palette.color}" opacity=".12"/><text x="95" y="577" font-family="Arial,sans-serif" font-size="20" fill="${palette.color}">${esc(challenge.title)} · ${Number(record.poolSize) || 0} clubes no pote</text><text x="70" y="652" font-family="Arial,sans-serif" font-size="12" fill="#777383">FM27 · Disponibilidade por confirmar · ${esc(new Date(record.date).toLocaleDateString("pt-PT"))}</text></svg>`;
  download(
    svg,
    "the-draw-" +
      record.name.replace(/[<>:"/\\|?*]/g, "").slice(0, 80) +
      ".svg",
    "image/svg+xml",
  );
  toast("O cartão do teu novo capítulo está a caminho.");
}
async function copyRecord(record) {
  try {
    await navigator.clipboard.writeText(
      `O meu próximo save: ${record.name} (${record.country}, ${record.league}). Último sobrevivente entre ${record.poolSize} clubes no The Draw. Desafio: ${rule(record.challenge).title}.`,
    );
    toast("Copiado. Agora só falta contar a alguém.");
  } catch {
    toast(
      "O navegador não permitiu copiar. Podes selecionar o nome do clube na ficha.",
    );
  }
}
function openDetail(runId) {
  const record =
    accepted.find((c) => c.runId === runId) ||
    history.find((c) => c.runId === runId);
  if (!record) return;
  const saved = accepted.some((c) => c.runId === runId),
    challenge = rule(record.challenge);
  $("#detail-content").innerHTML =
    `<div class="detail-hero"><span class="eyebrow muted">O TEU PRÓXIMO CAPÍTULO</span>${badge(record)}<h2>${esc(record.name)}</h2><p>${esc(record.country)} · ${esc(record.league)}</p><p>${Number(record.poolSize) || 0} clubes. Um sobrevivente.</p></div><div class="detail-promise"><strong>${esc(challenge.title)}</strong>${esc(challenge.description)}</div>${saved ? `<form id="rename-form"><label class="field-label" for="save-name">COMO SE CHAMA ESTA HISTÓRIA?</label><input id="save-name" class="name-input" maxlength="60" value="${esc(record.saveName || record.name)}" required><button class="text-button" type="submit">Guardar nome ${icon("check")}</button></form>` : ""}<div class="inline-actions"><button id="detail-export" class="secondary">${icon("download")}Descarregar cartão</button>${!saved ? `<button id="detail-accept" class="primary">${icon("bookmark")}Aceitar destino</button>` : ""}</div><p class="verification-note">Disponibilidade no FM27 por confirmar. Guardado apenas neste navegador.</p>`;
  $("#detail-export").onclick = () => exportCard(record);
  if (!saved)
    $("#detail-accept").onclick = () => {
      acceptRecord(record);
      openDetail(runId);
    };
  if (saved)
    $("#rename-form").onsubmit = (e) => {
      e.preventDefault();
      const name = $("#save-name").value.trim();
      if (!name) return;
      const updated = accepted.map((c) =>
        c.runId === runId ? { ...c, saveName: name } : c,
      );
      if (write("draw-saves", updated)) {
        accepted = updated;
        renderCollection();
        toast("A tua história já tem nome.");
      }
    };
  if (!$("#detail-dialog").open) $("#detail-dialog").showModal();
}

$("#draw").onclick = startDraw;
$("#pause").onclick = () => {
  if (!running() || session.manual) return;
  if (session.paused) {
    session.paused = false;
    void initAudio();
    schedule(pendingBase);
  } else {
    pendingBase = timer
      ? Math.max(0, deadline - performance.now()) * settings.speed
      : pendingBase;
    clearTimeout(timer);
    timer = null;
    session.paused = true;
    silence();
  }
  refreshPlayback();
  renderContenders();
};
$("#next").onclick = () => {
  if (running()) {
    if (session.paused) void initAudio();
    advance();
  }
};
$("#cancel").onclick = () => {
  if (!running()) return;
  session = null;
  silence();
  resetArena();
  renderContenders();
  renderMode();
  toast("Sorteio cancelado. Nenhum vencedor foi guardado.");
};
$("#speed").onchange = (e) => {
  const base =
    running() && !session.paused && timer
      ? Math.max(0, deadline - performance.now()) * settings.speed
      : pendingBase;
  settings.speed = Number(e.target.value);
  persistSettings();
  if (running()) schedule(base);
};
$("#auto-mode").onclick = () => {
  if (running()) return;
  settings.manual = false;
  persistSettings();
  renderMode();
};
$("#manual-mode").onclick = () => {
  if (running()) return;
  settings.manual = true;
  persistSettings();
  renderMode();
};
function setCinema(active) {
  document.body.classList.toggle("cinema-mode", active);
  $("#focus").setAttribute("aria-pressed", String(active));
  $("#focus").innerHTML = active ? "Sair do cinema ×" : "Modo cinema ↗";
}
$("#focus").onclick = () =>
  setCinema(!document.body.classList.contains("cinema-mode"));
$("#accept-winner").onclick = () => {
  if (session?.record) acceptRecord(session.record);
};
$("#export-winner").onclick = () => {
  if (session?.record) exportCard(session.record);
};
$("#share").onclick = () => {
  if (session?.record) void copyRecord(session.record);
};
$("#exclude-result").onclick = () => {
  if (!session?.record || running()) return;
  selection.excluded = [...new Set([...selection.excluded, session.record.id])];
  configChanged();
  if (pool().length >= 2) startDraw();
  else {
    goStep(2);
    toast("Clube excluído. Escolhe mais participantes para voltar a sortear.");
  }
};
$("#search").oninput = (e) => {
  search = e.target.value;
  clubLimit = 60;
  renderClubs();
};
$("#live-search").oninput = (e) => {
  liveSearch = e.target.value;
  liveLimit = 100;
  renderContenders();
};
$("#include-visible").onclick = () => {
  const ids = new Set(visibleClubs().map((c) => c.id));
  selection.excluded = selection.excluded.filter((key) => !ids.has(key));
  configChanged();
};
$("#exclude-visible").onclick = () => {
  selection.excluded = [
    ...new Set([...selection.excluded, ...visibleClubs().map((c) => c.id)]),
  ];
  configChanged();
};
$("#reset").onclick = () => {
  selection.countries = [];
  selection.leagues = [];
  selection.excluded = [];
  search = "";
  $("#search").value = "";
  configChanged();
};
$("#clear-countries").onclick = () => {
  selection.countries = [];
  selection.leagues = [];
  configChanged();
};
$("#clear-leagues").onclick = () => {
  selection.leagues = [];
  configChanged();
};
$("#more-clubs").onclick = () => {
  clubLimit += 60;
  renderClubs();
};
$("#more-contenders").onclick = () => {
  liveLimit += 100;
  renderContenders();
};
for (const tab of ["remaining", "eliminated"]) {
  $("#" + tab + "-tab").onclick = () => {
    liveTab = tab;
    liveLimit = 100;
    renderContenders();
  };
  $("#" + tab + "-tab").onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    liveTab =
      e.key === "Home"
        ? "remaining"
        : e.key === "End"
          ? "eliminated"
          : liveTab === "remaining"
            ? "eliminated"
            : "remaining";
    renderContenders();
    $("#" + liveTab + "-tab").focus();
  };
}
$("#country-options").onchange = (e) => {
  const country = e.target.dataset.country;
  if (!country || running()) return;
  selection.countries = e.target.checked
    ? [...selection.countries, country]
    : selection.countries.filter((c) => c !== country);
  selection.leagues = [];
  clubLimit = 60;
  configChanged();
  Array.from(document.querySelectorAll("[data-country]"))
    .find((el) => el.dataset.country === country)
    ?.focus({ preventScroll: true });
};
$("#league-options").onchange = (e) => {
  const league = e.target.dataset.league;
  if (!league || running()) return;
  selection.leagues = e.target.checked
    ? [...selection.leagues, league]
    : selection.leagues.filter((l) => l !== league);
  clubLimit = 60;
  configChanged();
  Array.from(document.querySelectorAll("[data-league]"))
    .find((el) => el.dataset.league === league)
    ?.focus({ preventScroll: true });
};
$("#appearance").onclick = openSettings;
$("#stage-settings").onclick = openSettings;
$("#ceremony-settings").onclick = openSettings;
$("#settings-done").onclick = () => $("#settings-dialog").close();
$("#sound").onchange = (e) => {
  settings.sound = e.target.checked;
  if (settings.sound) {
    void initAudio().then(() => playCue("intro"));
  } else silence();
  persistSettings();
};
$("#voice").onchange = (e) => {
  settings.voice = e.target.checked;
  if (!settings.voice && "speechSynthesis" in window) speechSynthesis.cancel();
  persistSettings();
};
$("#volume").oninput = (e) => {
  settings.volume = Number(e.target.value);
  $("#volume-value").textContent = settings.volume + "%";
  if (masterGain && audioContext)
    masterGain.gain.setValueAtTime(
      settings.sound ? (settings.volume / 100) * 0.2 : 0,
      audioContext.currentTime,
    );
  persistSettings();
};
$("#milestones").onchange = (e) => {
  settings.milestones = e.target.checked;
  persistSettings();
};
$("#reduced-motion").onchange = (e) => {
  settings.reducedMotion = e.target.checked;
  applySettings();
  persistSettings();
};
$("#save-selection").onclick = () => {
  if (running()) return;
  if (pool().length < 2) {
    toast("Inclui pelo menos dois clubes antes de guardar.");
    return;
  }
  if (presets.length >= 20) {
    toast("Tens 20 seleções guardadas. Elimina uma para criar outra.");
    return;
  }
  $("#selection-name").value = "";
  $("#save-dialog").showModal();
};
$("#save-form").onsubmit = (e) => {
  e.preventDefault();
  const name = $("#selection-name").value.trim();
  if (!name) return;
  const next = [
    { id: id(), name, selection: selectionSnapshot(selection) },
    ...presets,
  ];
  if (write("draw-presets", next)) {
    presets = next;
    $("#save-dialog").close();
    renderCollection();
    toast("Seleção guardada. Para quando a vontade voltar.");
  }
};
$("#open-presets").onclick = () => showView("collection");
$("#confirm-no").onclick = () => {
  confirmation = null;
  $("#confirm-dialog").close();
};
$("#confirm-yes").onclick = () => {
  const action = confirmation;
  confirmation = null;
  $("#confirm-dialog").close();
  action?.();
};
$("#confirm-dialog").addEventListener("close", () => (confirmation = null));
$("#clear-history").onclick = () =>
  confirmAction(
    "Limpar o histórico?",
    "Os sorteios são removidos deste navegador. Os saves aceites na coleção continuam guardados.",
    () => {
      if (write("draw-history", [])) {
        history = [];
        renderHistory();
        toast("Histórico limpo. Os teus saves continuam na coleção.");
      }
    },
  );
$("#import-button").onclick = () => $("#import-file").click();
$("#sample-data").onclick = () =>
  download(
    JSON.stringify(
      [
        { name: "O meu clube", country: "Portugal", league: "A minha liga" },
        { name: "Outro clube", country: "Portugal", league: "A minha liga" },
      ],
      null,
      2,
    ),
    "the-draw-exemplo.json",
    "application/json",
  );
async function importFile(file) {
  if (!file) return;
  try {
    if (file.size > 15000000)
      throw new Error("O ficheiro não pode exceder 15 MB.");
    const imported = validateImport(JSON.parse(await file.text()));
    confirmAction(
      "Usar esta nova base?",
      `${imported.length} clubes serão importados. Os favoritos, filtros e seleções guardadas serão limpos. O histórico e os saves aceites continuam guardados.`,
      () => {
        if (!write("draw-import", imported)) return;
        clubs = imported;
        importedData = true;
        presets = [];
        write("draw-presets", presets);
        selection = restoreSelection({});
        search = "";
        $("#search").value = "";
        configChanged();
        showView("collection");
        toast(
          imported.length +
            " clubes importados. Confirma a disponibilidade no FM27.",
        );
      },
    );
  } catch (error) {
    toast(error.message);
  }
}
$("#import-file").onchange = (e) => {
  void importFile(e.target.files[0]);
  e.target.value = "";
};
$("#restore-data").onclick = () =>
  confirmAction(
    "Voltar à base de demonstração?",
    "A base importada, os favoritos e as seleções guardadas serão removidos. O histórico e os saves aceites continuam guardados.",
    () => {
      try {
        localStorage.removeItem("draw-import");
      } catch {
        toast("Não foi possível alterar a base.");
        return;
      }
      clubs = initialClubs;
      importedData = false;
      presets = [];
      write("draw-presets", presets);
      selection = restoreSelection({});
      search = "";
      $("#search").value = "";
      configChanged();
      showView("collection");
      toast("Base de demonstração restaurada.");
    },
  );
document.addEventListener("click", (e) => {
  const cheer = e.target.closest("[data-cheer]");
  if (cheer && running()) {
    session.cheer =
      session.cheer === cheer.dataset.cheer ? null : cheer.dataset.cheer;
    renderContenders();
    toast(
      session.cheer
        ? "Palpite guardado. Torcer não altera as probabilidades."
        : "Palpite retirado. O sorteio continua igual.",
    );
    return;
  }
  const step = e.target.closest("[data-step]");
  if (step) {
    goStep(Number(step.dataset.step));
    return;
  }
  const view = e.target.closest("[data-view]");
  if (view) {
    showView(view.dataset.view);
    return;
  }
  const theme = e.target.closest("[data-theme-choice]");
  if (theme) {
    settings.theme = theme.dataset.themeChoice;
    applySettings();
    persistSettings();
    document
      .querySelector('[data-theme-choice="' + settings.theme + '"]')
      ?.focus({ preventScroll: true });
    return;
  }
  const close = e.target.closest("[data-close-dialog]");
  if (close) {
    close.closest("dialog").close();
    return;
  }
  const journeyButton = e.target.closest("[data-journey]");
  if (journeyButton && !running()) {
    selection.journey = journeyButton.dataset.journey;
    selection.countries = [];
    selection.leagues = [];
    selection.excluded = [];
    search = "";
    $("#search").value = "";
    clubLimit = 60;
    configChanged();
    return;
  }
  const challengeButton = e.target.closest("[data-challenge]");
  if (challengeButton && !running()) {
    selection.challenge = challengeButton.dataset.challenge;
    configChanged();
    return;
  }
  const toggle = e.target.closest("[data-toggle]"),
    star = e.target.closest("[data-star]");
  if ((toggle || star) && !running()) {
    const key = toggle ? "excluded" : "shortlist",
      value = (toggle || star).dataset[toggle ? "toggle" : "star"];
    selection[key] = selection[key].includes(value)
      ? selection[key].filter((c) => c !== value)
      : [...selection[key], value];
    const focused = e.target.closest("button"),
      selector = toggle ? "[data-toggle]" : "[data-star]";
    configChanged();
    if (focused) {
      const replacement = Array.from(document.querySelectorAll(selector)).find(
        (el) => el.dataset[toggle ? "toggle" : "star"] === value,
      );
      replacement?.focus({ preventScroll: true });
    }
    return;
  }
  const load = e.target.closest("[data-load]");
  if (load && !running()) {
    const preset = presets.find((p) => p.id === load.dataset.load);
    if (preset) {
      selection = restoreSelection(preset.selection);
      search = "";
      $("#search").value = "";
      configChanged();
      goStep(2);
      toast("Seleção carregada. Confirma os clubes antes do sorteio.");
    }
    return;
  }
  const deletePreset = e.target.closest("[data-delete-preset]");
  if (deletePreset) {
    const preset = presets.find(
      (p) => p.id === deletePreset.dataset.deletePreset,
    );
    if (preset)
      confirmAction(
        "Eliminar esta seleção?",
        preset.name + " será removida da tua coleção.",
        () => {
          const next = presets.filter((p) => p.id !== preset.id);
          if (write("draw-presets", next)) {
            presets = next;
            renderCollection();
          }
        },
      );
    return;
  }
  const detail = e.target.closest("[data-detail]");
  if (detail) {
    openDetail(detail.dataset.detail);
    return;
  }
  const deleteSave = e.target.closest("[data-delete-save]");
  if (deleteSave) {
    const record = accepted.find(
      (c) => c.runId === deleteSave.dataset.deleteSave,
    );
    if (record)
      confirmAction(
        "Retirar este save da coleção?",
        record.name +
          " continua no histórico, caso esse sorteio ainda esteja guardado.",
        () => {
          const next = accepted.filter((c) => c.runId !== record.runId);
          if (write("draw-saves", next)) {
            accepted = next;
            renderCollection();
            updateAcceptance();
          }
        },
      );
    return;
  }
  if (e.target.closest('[data-action="explore-world"]')) {
    selection.journey = "world";
    selection.countries = [];
    selection.leagues = [];
    search = "";
    $("#search").value = "";
    configChanged();
  }
});
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    )
      dialog.close();
  });
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    document.body.classList.contains("cinema-mode") &&
    !document.querySelector("dialog[open]")
  ) {
    $("#focus").click();
  }
});
window.addEventListener("pagehide", () => {
  silence();
  clearTimeout(timer);
});
hydrate();
applySettings();
renderAll();
resetArena();
goStep(1, false);
