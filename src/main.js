import "./styles.css";
import * as api from "./api.js";
import { DANCE_STYLES, LEVELS, DANCE_ROLES, REPORT_CATEGORIES } from "./config.js";
import { filterProfilesByRadius } from "./geo.js";

const app = document.querySelector("#app");
const PENDING_KEY = "kizconnect_pending_action";
const APP_VERSION = "3.5.0";

const state = {
  screen: "home",
  previous: "home",
  session: null,
  profile: null,
  selectedProfile: null,
  selectedConversation: null,
  reportTarget: null,
  authMode: "signup",
  authReason: "",
  trainingInterestIds: [],
  trainingMatches: [],
  notice: "",
  error: ""
};

let stopRealtime = null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}

function initials(name = "?") {
  return String(name).trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "?";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Date non précisée";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : "";
}

function avatar(profile, size = "normal") {
  const cls = size === "large" ? "avatar avatar-large" : "avatar";
  if (profile?.avatar_url) return `<div class="${cls}"><img src="${escapeHtml(profile.avatar_url)}" alt="Photo de ${escapeHtml(profile.display_name || "profil")}" /></div>`;
  return `<div class="${cls}" aria-hidden="true">${escapeHtml(initials(profile?.display_name))}</div>`;
}

function setFlash(message, type = "notice") {
  state[type] = message;
  if (type === "notice") state.error = "";
  if (type === "error") state.notice = "";
}

function go(screen, { preserveFlash = false } = {}) {
  if (stopRealtime && screen !== "chat") {
    stopRealtime();
    stopRealtime = null;
  }
  state.previous = state.screen;
  state.screen = screen;
  if (!preserveFlash) {
    state.error = "";
    state.notice = "";
  }
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function savePendingAction(action) {
  if (!action) {
    sessionStorage.removeItem(PENDING_KEY);
    return;
  }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(action));
}

function readPendingAction() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
  } catch {
    return null;
  }
}

async function executePendingAction(action) {
  if (!action) return false;
  savePendingAction(null);
  if (action.type === "messages") { go("messages"); return true; }
  if (action.type === "training-create") { go("training-create"); return true; }
  if (action.type === "carpool-offer") { go("carpool-offer"); return true; }
  if (action.type === "message-user") { await openConversation(action.userId, action.draft || ""); return true; }
  if (action.type === "report-user") { state.reportTarget = { id: action.userId, name: action.name || "ce profil" }; go("report"); return true; }
  if (action.type === "feedback") { go("feedback"); return true; }
  if (action.type === "training-interest") { await handleTrainingInterest(action.userId, true); return true; }
  if (action.type === "enable-training-match") { setFlash("Activez « Connexion training » puis enregistrez votre profil."); go("profile", { preserveFlash: true }); return true; }
  return false;
}

async function requireAuth(reason, action) {
  if (state.session) return executePendingAction(action);
  savePendingAction(action);
  state.authReason = reason;
  state.authMode = "signup";
  state.previous = state.screen;
  state.screen = "auth";
  state.error = "";
  state.notice = "";
  render();
  return false;
}

function pageHead(title, subtitle, back = "home") {
  return `<div class="page-head">
    <button class="back-btn" data-action="go" data-screen="${escapeHtml(back)}" aria-label="Retour">←</button>
    <div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>
  </div>`;
}

function header() {
  const label = state.session ? "Mon profil" : "Connexion";
  return `<header class="topbar">
    <div class="topbar-inner">
      <button class="brand" data-action="home" aria-label="Accueil KizConnect">
        <img class="brand-mark" src="/assets/kizconnect-symbol.png" alt="" aria-hidden="true" />
        <span><strong>KIZ CONNECT</strong><small>Trouvez avec qui danser.</small></span>
      </button>
      <button class="header-action" data-action="account">${label}</button>
    </div>
  </header>`;
}

function statusBlock() {
  const blocks = [];
  if (!api.isConfigured()) blocks.push(`<div class="status info"><strong>Mode aperçu.</strong> Ajoutez vos variables Supabase pour activer les comptes et les données réelles.</div>`);
  if (state.error) blocks.push(`<div class="status error" role="alert">${escapeHtml(state.error)}</div>`);
  if (state.notice) blocks.push(`<div class="status success" role="status">${escapeHtml(state.notice)}</div>`);
  return blocks.join("");
}

function homeIcon(type) {
  const icons = {
    partner: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="10" r="4"/><circle cx="22" cy="11" r="3.5"/><path d="M4.5 25c.6-5.1 3.2-8 7.2-8 4.1 0 6.6 2.9 7.2 8"/><path d="M17.2 23.7c.7-3.8 2.7-6 5.7-6 3.1 0 5 2.2 5.6 6"/></svg>`,
    car: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 20h18l-2.2-7.2a3 3 0 0 0-2.9-2.1h-7.8a3 3 0 0 0-2.9 2.1L7 20Z"/><path d="M5.5 20v4.5M26.5 20v4.5M7 24.5h18"/><circle cx="10" cy="24.5" r="2"/><circle cx="22" cy="24.5" r="2"/></svg>`,
    message: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 7.5h20v14H15l-6 4v-4H6v-14Z"/><path d="M10 13h12M10 17h8"/></svg>`
  };
  return icons[type] || "";
}

function homeView() {
  return `${statusBlock()}
    <section class="home-core" aria-labelledby="home-title">
      <section class="home-intro">
        <div class="home-intro-copy">
          <span class="eyebrow">DANSE • RENCONTRE • PARTAGE</span>
          <div class="home-kicker"><span class="pulse-dot"></span> KIZ CONNECT</div>
          <h1 id="home-title">Trouvez avec qui danser.</h1>
          <p class="lead">Partenaire, covoiturage, messages. Allez directement à l’essentiel.</p>
          <div class="home-intro-promise"><strong>La danse rapproche.</strong><span>Simple. Humain. Accessible.</span></div>
        </div>
        <div class="home-mini-art" aria-hidden="true">
          <div class="mini-glow"></div>
          <img src="/assets/kizconnect-symbol.png" alt="" />
        </div>
      </section>

      <section class="home-actions home-actions-priority" aria-labelledby="home-actions-title">
        <div class="home-section-head compact">
          <span class="eyebrow">DIRECTEMENT À L’ESSENTIEL</span>
          <h2 id="home-actions-title">Que cherchez-vous ?</h2>
          <p>Choisissez votre besoin.</p>
        </div>
        <div class="primary-menu home-priority-menu" aria-label="Fonctions principales">
          <button class="big-choice featured-choice" data-action="go" data-screen="partners">
            <span class="choice-icon" aria-hidden="true">${homeIcon("partner")}</span><span><strong>TROUVER UN PARTENAIRE</strong><span>Ville, style et niveau.</span></span>
          </button>
          <button class="big-choice" data-action="go" data-screen="carpool">
            <span class="choice-icon" aria-hidden="true">${homeIcon("car")}</span><span><strong>COVOITURAGE</strong><span>Chercher ou proposer des places.</span></span>
          </button>
          <button class="big-choice" data-action="messages">
            <span class="choice-icon" aria-hidden="true">${homeIcon("message")}</span><span><strong>MES MESSAGES</strong><span>Retrouvez vos conversations.</span></span>
          </button>
        </div>
      </section>
    </section>
    ${state.session && state.profile?.training_match_enabled ? `<div id="home-training-match-alert"></div>` : ""}
    <section class="beta-note" aria-label="Version bêta">
      <div><strong>KizConnect est ouvert à tous les danseurs.</strong><span>Version bêta · Vos retours nous aident à améliorer l’app.</span></div>
      <button class="secondary beta-feedback-btn" data-action="feedback">💬 Donner mon avis</button>
    </section>
    <div class="home-signature home-signature-compact"><span></span><p><strong>Ouvrir → Choisir → Rechercher → Contacter.</strong></p><span></span></div>`;
}

function partnersView() {
  return `${pageHead("Trouver un partenaire", "Recherchez simplement autour de vous.")}
    ${statusBlock()}
    <form class="form-card" id="partner-search-form">
      <div class="field"><label for="partner-city">📍 Ville</label><input id="partner-city" name="city" maxlength="80" autocomplete="address-level2" placeholder="Ex : Tours" /></div>
      <div class="field"><label for="partner-radius">📏 Rayon autour de la ville</label><select id="partner-radius" name="radius"><option value="0">Ville exacte</option><option value="5">+ 5 km</option><option value="10">+ 10 km</option><option value="25">+ 25 km</option><option value="50">+ 50 km</option></select><div class="help">Le rayon utilise le centre des communes françaises. La distance est approximative.</div></div>
      <div class="field"><label for="partner-style">💃 Style de danse</label><select id="partner-style" name="style"><option value="">Tous les styles</option>${DANCE_STYLES.map(x => `<option>${x}</option>`).join("")}</select></div>
      <div class="field"><label for="partner-level">🎯 Niveau</label><select id="partner-level" name="level"><option value="">Tous les niveaux</option>${LEVELS.map(x => `<option>${x}</option>`).join("")}</select></div>
      <div class="field"><label for="partner-role">↔️ Je cherche</label><select id="partner-role" name="dance_role"><option value="">Peu importe le rôle</option>${DANCE_ROLES.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("")}</select><div class="help">Facultatif · Leader, Follower ou une personne qui pratique les deux rôles.</div></div>
      <button class="primary" type="submit">RECHERCHER</button>
    </form>
    <section class="mutual-card" aria-labelledby="mutual-title">
      <div class="mutual-icon" aria-hidden="true">✨</div>
      <div class="mutual-copy">
        <span class="eyebrow">OPTIONNEL · PRIVÉ</span>
        <h3 id="mutual-title">Connexion training</h3>
        <p>Indiquez discrètement avec qui vous aimeriez essayer un training. Aucun refus n'est affiché : vous êtes prévenus seulement si le choix est réciproque.</p>
        ${state.session
          ? (state.profile?.training_match_enabled
            ? `<div id="training-matches" class="mutual-matches"><div class="empty compact-empty">Recherche de vos connexions mutuelles…</div></div>`
            : `<button class="secondary compact-btn" data-action="enable-training-match">ACTIVER DANS MON PROFIL</button>`)
          : `<button class="secondary compact-btn" data-action="training-match-login">ME CONNECTER POUR PARTICIPER</button>`}
      </div>
    </section>
    <div id="partner-results"></div>
    <div class="section-title"><h3>Vous cherchez un training précis ?</h3><p>Publiez une demande avec une date et une heure.</p></div>
    <button class="secondary" data-action="training-create">PUBLIER UNE DEMANDE DE TRAINING</button>
    <div class="section-title"><h3>Demandes de training</h3><p>Les prochaines demandes apparaissent ici.</p></div>
    <div id="training-list" class="empty">Chargement des demandes…</div>`;
}

function profileCard(profile) {
  const styles = Array.isArray(profile.styles) ? profile.styles : [];
  const distance = Number.isFinite(profile._distanceKm) ? ` · ≈ ${Math.max(1, Math.round(profile._distanceKm))} km` : "";
  return `<article class="card">
    <div class="person-line">${avatar(profile)}<div><h3>${escapeHtml(profile.display_name || "Danseur")}</h3><div class="meta">📍 ${escapeHtml(profile.city || "Ville non indiquée")}${distance} · ${escapeHtml(profile.level || "Niveau non indiqué")}</div></div></div>
    <div class="tags">${profile.dance_role ? `<span class="tag role-tag">↔️ ${escapeHtml(profile.dance_role)}</span>` : ""}${styles.map(style => `<span class="tag">${escapeHtml(style)}</span>`).join("")}${profile.training_match_enabled ? `<span class="tag mutual-tag">✨ Connexion training</span>` : ""}</div>
    <button class="secondary top-gap" data-action="view-profile" data-id="${escapeHtml(profile.id)}">VOIR LE PROFIL</button>
  </article>`;
}

async function searchPartners(form) {
  const target = document.querySelector("#partner-results");
  if (!target) return;
  target.innerHTML = `<div class="section-title"><h3>Résultats</h3></div><div class="empty">Recherche…</div>`;
  if (!api.isConfigured()) {
    target.innerHTML = `<div class="section-title"><h3>Résultats</h3></div><div class="empty">Connectez Supabase pour afficher de vrais profils.</div>`;
    return;
  }
  try {
    const formData = new FormData(form);
    const city = String(formData.get("city") || "").trim();
    const radius = Number(formData.get("radius") || 0);
    const style = formData.get("style") || "";
    const level = formData.get("level") || "";
    const danceRole = formData.get("dance_role") || "";
    const useRadius = Boolean(city && radius > 0);

    const [profiles, blockedIds] = await Promise.all([
      api.searchPartners({ city, style, level, danceRole, broad: useRadius }),
      api.listBlockedIds(state.session?.user?.id)
    ]);

    let visible = (profiles || []).filter(profile => profile.id !== state.session?.user?.id && !blockedIds.includes(profile.id));
    let info = "";
    if (useRadius) {
      try {
        const nearby = await filterProfilesByRadius(visible, city, radius);
        if (!nearby.geocoded) {
          target.innerHTML = `<div class="status error">Ville introuvable pour le calcul du rayon. Essayez la ville exacte ou une autre commune française.</div>`;
          return;
        }
        visible = nearby.profiles;
        info = ` dans un rayon d’environ ${radius} km autour de ${escapeHtml(nearby.origin?.name || city)}`;
      } catch {
        target.innerHTML = `<div class="status error">Le service de localisation des communes est momentanément indisponible. Essayez « Ville exacte ».</div>`;
        return;
      }
    }

    if (!document.querySelector("#partner-results")) return;
    target.innerHTML = `<div class="section-title"><h3>Résultats</h3><p>${visible.length} profil${visible.length === 1 ? "" : "s"} trouvé${visible.length === 1 ? "" : "s"}${info}.</p></div>${visible.length ? visible.map(profileCard).join("") : `<div class="empty"><strong>Aucun partenaire trouvé.</strong><span>Essayez un rayon plus large, une autre ville ou tous les styles.</span></div>`}`;
  } catch {
    target.innerHTML = `<div class="status error">Impossible d'effectuer la recherche pour le moment.</div>`;
  }
}

async function loadHomeTrainingMatchAlert() {
  const target = document.querySelector("#home-training-match-alert");
  if (!target || !state.session || !state.profile?.training_match_enabled) return;
  try {
    await refreshTrainingConnectionState();
    if (!document.querySelector("#home-training-match-alert") || !state.trainingMatches.length) return;
    target.innerHTML = `<button class="home-match-alert" data-action="go" data-screen="partners"><span>✨</span><div><strong>${state.trainingMatches.length} connexion${state.trainingMatches.length === 1 ? "" : "s"} training mutuelle${state.trainingMatches.length === 1 ? "" : "s"}</strong><small>Voir vos connexions</small></div><b>→</b></button>`;
  } catch {
    target.innerHTML = "";
  }
}

async function refreshTrainingConnectionState() {
  if (!state.session || !api.isConfigured()) {
    state.trainingInterestIds = [];
    state.trainingMatches = [];
    return;
  }
  try {
    const [ids, matches] = await Promise.all([api.listMyTrainingInterestIds(state.session.user.id), api.listTrainingMatches()]);
    state.trainingInterestIds = ids || [];
    state.trainingMatches = matches || [];
  } catch {
    state.trainingInterestIds = [];
    state.trainingMatches = [];
  }
}

async function loadTrainingMatches() {
  const target = document.querySelector("#training-matches");
  if (!target || !state.session || !state.profile?.training_match_enabled) return;
  try {
    await refreshTrainingConnectionState();
    if (!document.querySelector("#training-matches")) return;
    if (!state.trainingMatches.length) {
      target.innerHTML = `<div class="empty compact-empty"><strong>Aucune connexion mutuelle pour le moment.</strong><span>Vos choix restent privés tant qu'ils ne sont pas réciproques.</span></div>`;
      return;
    }
    target.innerHTML = `<div class="mutual-success"><strong>✨ ${state.trainingMatches.length} connexion${state.trainingMatches.length === 1 ? "" : "s"} mutuelle${state.trainingMatches.length === 1 ? "" : "s"}</strong><span>Vous pouvez maintenant échanger librement.</span></div>` + state.trainingMatches.map(match => `<article class="mutual-match-row">${avatar(match)}<div><strong>${escapeHtml(match.display_name || "Danseur")}</strong><span>${escapeHtml(match.city || "")}${match.level ? ` · ${escapeHtml(match.level)}` : ""}</span></div><button class="small-action" data-action="message-user" data-id="${escapeHtml(match.id)}">MESSAGE</button></article>`).join("");
  } catch {
    target.innerHTML = `<div class="status error">Impossible de charger vos connexions training.</div>`;
  }
}

async function handleTrainingInterest(userId, active) {
  if (!state.session) {
    await requireAuth("Connectez-vous pour utiliser la connexion training.", { type: "training-interest", userId });
    return;
  }
  if (!state.profile?.training_match_enabled) {
    setFlash("Activez d'abord « Connexion training » dans votre profil. Votre participation reste facultative.");
    go("profile", { preserveFlash: true });
    return;
  }
  try {
    const result = await api.setTrainingInterest(userId, active);
    await refreshTrainingConnectionState();
    if (result?.matched && active) {
      setFlash(`✨ Connexion mutuelle avec ${result.target_name || "ce danseur"} ! Vous pouvez maintenant échanger.`);
    } else if (active) {
      setFlash("Votre intérêt a été enregistré discrètement. L'autre personne n'en saura rien sauf si elle vous choisit aussi.");
    } else {
      setFlash("Votre intérêt a été retiré.");
    }
    render();
  } catch (error) {
    setFlash(friendlyError(error, "Impossible de mettre à jour cette connexion training."), "error");
    render();
  }
}

async function loadTraining() {
  const target = document.querySelector("#training-list");
  if (!target) return;
  if (!api.isConfigured()) { target.innerHTML = "Aucune donnée réelle en mode aperçu."; return; }
  try {
    const [rows, blockedIds] = await Promise.all([api.listTrainingRequests(), api.listBlockedIds(state.session?.user?.id)]);
    const data = (rows || []).filter(item => !blockedIds.includes(item.owner_id));
    if (!document.querySelector("#training-list")) return;
    if (!data.length) { target.className = "empty"; target.innerHTML = `<strong>Aucun training pour le moment.</strong><span>Vous pouvez publier une demande et être le premier.</span>`; return; }
    target.className = "";
    target.innerHTML = data.map(item => `<article class="card">
      <div class="person-line">${avatar(item.owner)}<div><h3>${escapeHtml(item.owner?.display_name || "Danseur")} cherche un partenaire</h3><div class="meta">📍 ${escapeHtml(item.city)} · 📅 ${escapeHtml(formatDate(item.event_date))}${item.event_time ? ` · 🕒 ${escapeHtml(formatTime(item.event_time))}` : ""}</div></div></div>
      <div class="tags"><span class="tag">${escapeHtml(item.style)}</span><span class="tag">${escapeHtml(item.level)}</span></div>
      ${item.note ? `<p class="profile-bio">${escapeHtml(item.note)}</p>` : ""}
      ${item.owner_id === state.session?.user?.id
        ? `<button class="danger-btn top-gap" data-action="delete-training" data-id="${escapeHtml(item.id)}">SUPPRIMER MA DEMANDE</button>`
        : `<button class="secondary top-gap" data-action="message-user" data-id="${escapeHtml(item.owner_id)}">ENVOYER UN MESSAGE</button>`}
    </article>`).join("");
  } catch {
    target.className = "";
    target.innerHTML = `<div class="status error">Impossible de charger les demandes.</div>`;
  }
}

function trainingCreateView() {
  return `${pageHead("Publier un training", "Quelques informations suffisent.", "partners")}
    ${statusBlock()}
    <form class="form-card" id="training-form">
      <div class="field"><label>📍 Ville</label><input name="city" required maxlength="80" value="${escapeHtml(state.profile?.city || "")}" placeholder="Ex : Tours" /></div>
      <div class="grid-2"><div class="field"><label>📅 Date</label><input type="date" name="event_date" min="${todayIso()}" required /></div><div class="field"><label>🕒 Heure</label><input type="time" name="event_time" /></div></div>
      <div class="field"><label>💃 Style</label><select name="style" required>${DANCE_STYLES.map(x => `<option>${x}</option>`).join("")}</select></div>
      <div class="field"><label>🎯 Niveau recherché</label><select name="level" required>${LEVELS.map(x => `<option>${x}</option>`).join("")}</select></div>
      <div class="field"><label>Petit message <span class="help">(facultatif)</span></label><textarea name="note" maxlength="500" placeholder="Ex : Je souhaite travailler la marche et la musicalité."></textarea></div>
      <button class="primary" type="submit">PUBLIER</button>
    </form>`;
}

function carpoolView() {
  return `${pageHead("Covoiturage", "Une petite annonce simple, rien de plus.")}
    ${statusBlock()}
    <div class="choice-pair">
      <button class="big-choice" data-action="go" data-screen="carpool-search"><span class="emoji">🙋</span><span><strong>JE CHERCHE UNE VOITURE</strong><span>Rechercher un trajet disponible.</span></span></button>
      <button class="big-choice" data-action="carpool-offer"><span class="emoji">🚗</span><span><strong>JE PROPOSE DES PLACES</strong><span>Publier votre trajet.</span></span></button>
    </div>`;
}

function carpoolSearchView() {
  return `${pageHead("Chercher une voiture", "Recherchez par départ, destination et date.", "carpool")}
    ${statusBlock()}
    <form class="form-card" id="carpool-search-form">
      <div class="field"><label>Lieu de départ</label><input name="from_city" maxlength="100" placeholder="Ex : Tours" /></div>
      <div class="field"><label>Destination ou événement</label><input name="destination" maxlength="120" placeholder="Ex : Paris ou Kizomba Festival" /></div>
      <div class="field"><label>Date</label><input type="date" name="travel_date" min="${todayIso()}" /></div>
      <div class="field"><label>Nombre de personnes</label><input type="number" min="1" max="8" value="1" name="people_count" /></div>
      <button class="primary" type="submit">RECHERCHER</button>
    </form>
    <div id="carpool-results"></div>`;
}

function carpoolCard(item) {
  const own = item.owner_id === state.session?.user?.id;
  return `<article class="card">
    <div class="person-line">${avatar({ display_name: item.owner_display_name, avatar_url: item.owner_avatar_url })}<div><h3>${escapeHtml(item.from_city)} → ${escapeHtml(item.destination)}</h3><div class="meta">${escapeHtml(item.owner_display_name || "Danseur")} · 📅 ${escapeHtml(formatDate(item.travel_date))}${item.travel_time ? ` · 🕒 ${escapeHtml(formatTime(item.travel_time))}` : ""}</div></div></div>
    <div class="tags"><span class="tag">${escapeHtml(item.seats_available)} place${Number(item.seats_available) === 1 ? "" : "s"}</span>${item.contribution !== null && item.contribution !== undefined ? `<span class="tag">${escapeHtml(item.contribution)} € / pers.</span>` : `<span class="tag">Participation non indiquée</span>`}</div>
    ${item.event_name ? `<p><strong>Événement :</strong> ${escapeHtml(item.event_name)}</p>` : ""}
    ${item.note ? `<p class="profile-bio">${escapeHtml(item.note)}</p>` : ""}
    ${own ? `<button class="danger-btn top-gap" data-action="delete-carpool" data-id="${escapeHtml(item.id)}">SUPPRIMER MON TRAJET</button>` : `<button class="secondary top-gap" data-action="message-user" data-id="${escapeHtml(item.owner_id)}">CONTACTER ${escapeHtml(item.owner_display_name || "LE CONDUCTEUR")}</button>`}
  </article>`;
}

async function searchCarpools(form) {
  const target = document.querySelector("#carpool-results");
  if (!target) return;
  target.innerHTML = `<div class="section-title"><h3>Résultats</h3></div><div class="empty">Recherche…</div>`;
  if (!api.isConfigured()) { target.innerHTML = `<div class="section-title"><h3>Résultats</h3></div><div class="empty">Connectez Supabase pour afficher de vrais trajets.</div>`; return; }
  try {
    const fd = new FormData(form);
    const [rows, blockedIds] = await Promise.all([
      api.searchCarpoolOffers({ fromCity: fd.get("from_city") || "", destination: fd.get("destination") || "", travelDate: fd.get("travel_date") || null, peopleCount: fd.get("people_count") || 1 }),
      api.listBlockedIds(state.session?.user?.id)
    ]);
    const data = (rows || []).filter(item => !blockedIds.includes(item.owner_id));
    if (!document.querySelector("#carpool-results")) return;
    target.innerHTML = `<div class="section-title"><h3>Résultats</h3><p>${data.length} trajet${data.length === 1 ? "" : "s"} trouvé${data.length === 1 ? "" : "s"}.</p></div>${data.length ? data.map(carpoolCard).join("") : `<div class="empty"><strong>Aucun covoiturage trouvé.</strong><span>Essayez une autre date, un autre départ ou une autre destination.</span></div>`}`;
  } catch {
    target.innerHTML = `<div class="status error">Impossible de charger les trajets.</div>`;
  }
}

function carpoolOfferView() {
  return `${pageHead("Proposer des places", "Publiez uniquement les informations utiles.", "carpool")}
    ${statusBlock()}
    <div class="status info">Indiquez une ville ou un point général. Échangez l'adresse exacte du rendez-vous uniquement en message privé.</div>
    <form class="form-card" id="carpool-offer-form">
      <div class="field"><label>Ville de départ</label><input name="from_city" required maxlength="100" value="${escapeHtml(state.profile?.city || "")}" placeholder="Ex : Tours" /></div>
      <div class="field"><label>Destination</label><input name="destination" required maxlength="120" placeholder="Ex : Paris" /></div>
      <div class="field"><label>Événement <span class="help">(facultatif)</span></label><input name="event_name" maxlength="120" /></div>
      <div class="grid-2"><div class="field"><label>Date</label><input type="date" name="travel_date" min="${todayIso()}" required /></div><div class="field"><label>Heure</label><input type="time" name="travel_time" required /></div></div>
      <div class="grid-2"><div class="field"><label>Places disponibles</label><input type="number" min="1" max="8" name="seats_available" value="1" required /></div><div class="field"><label>Participation (€)</label><input type="number" min="0" max="999" step="0.01" name="contribution" placeholder="Facultatif" /></div></div>
      <div class="field"><label>Petit message <span class="help">(facultatif)</span></label><textarea maxlength="500" name="note" placeholder="Ex : Petit bagage de préférence."></textarea></div>
      <button class="primary" type="submit">PUBLIER</button>
    </form>`;
}

function authView() {
  const signup = state.authMode === "signup";
  return `${pageHead(signup ? "Créer mon compte" : "Me connecter", state.authReason || "Votre compte est demandé uniquement quand il devient nécessaire.", state.previous || "home")}
    ${statusBlock()}
    <form class="form-card" id="auth-form">
      ${signup ? `<div class="field"><label>Prénom ou pseudo</label><input name="display_name" required maxlength="50" autocomplete="nickname" /></div><div class="field"><label>Ville</label><input name="city" required maxlength="80" autocomplete="address-level2" /></div>` : ""}
      <div class="field"><label>Email</label><input type="email" name="email" required maxlength="254" autocomplete="email" /></div>
      <div class="field"><label>Mot de passe</label><input type="password" name="password" required minlength="8" maxlength="128" autocomplete="${signup ? "new-password" : "current-password"}" /><div class="help">8 caractères minimum.</div></div>
      <button class="primary" type="submit">${signup ? "CRÉER MON COMPTE" : "ME CONNECTER"}</button>
    </form>
    <button class="text-btn" data-action="toggle-auth">${signup ? "J'ai déjà un compte" : "Créer un compte"}</button>`;
}

function ownProfileView() {
  if (!state.session) return authView();
  const styles = Array.isArray(state.profile?.styles) ? state.profile.styles : [];
  return `${pageHead("Mon profil", "Seulement les informations utiles aux autres danseurs.")}
    ${statusBlock()}
    <form class="form-card" id="profile-form">
      <div class="profile-photo-row">${avatar(state.profile, "large")}<div><strong>Photo facultative</strong><div class="help">JPG, PNG ou WebP · 2 Mo maximum.</div><input class="file-input" type="file" name="avatar" accept="image/jpeg,image/png,image/webp" /></div></div>
      <div class="field"><label>Prénom ou pseudo</label><input name="display_name" required maxlength="50" value="${escapeHtml(state.profile?.display_name || "")}" /></div>
      <div class="field"><label>Ville</label><input name="city" required maxlength="80" value="${escapeHtml(state.profile?.city || "")}" /></div>
      <div class="field"><label>Niveau</label><select name="level"><option value="">Choisir</option>${LEVELS.map(x => `<option ${state.profile?.level === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div class="field"><label>Rôle dans la danse <span class="help">(facultatif)</span></label><select name="dance_role"><option value="">Non précisé</option>${DANCE_ROLES.map(x => `<option value="${escapeHtml(x)}" ${state.profile?.dance_role === x ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}</select><div class="help">Leader, Follower ou Les deux. Ce choix n'est jamais lié au genre.</div></div>
      <fieldset class="field fieldset"><legend>Styles pratiqués</legend>${DANCE_STYLES.map(style => `<label class="check-row"><input type="checkbox" name="styles" value="${escapeHtml(style)}" ${styles.includes(style) ? "checked" : ""}/> <span>${escapeHtml(style)}</span></label>`).join("")}</fieldset>
      <div class="field"><label>Courte présentation <span class="help">(facultatif)</span></label><textarea name="bio" maxlength="500">${escapeHtml(state.profile?.bio || "")}</textarea></div>
      <label class="check-row visibility-row"><input type="checkbox" name="is_visible" ${state.profile?.is_visible !== false ? "checked" : ""} /><span>Profil visible dans les recherches</span></label>
      <div class="mutual-setting">
        <label class="check-row"><input type="checkbox" name="training_match_enabled" ${state.profile?.training_match_enabled ? "checked" : ""} /><span><strong>Activer Connexion training</strong><small>Vos choix restent privés. Une connexion n'apparaît que si les deux personnes se choisissent.</small></span></label>
      </div>
      <button class="primary" type="submit">ENREGISTRER</button>
    </form>
    <div class="actions"><button class="secondary" data-action="my-posts">MES ANNONCES</button><button class="secondary" data-action="blocked-users">PERSONNES BLOQUÉES</button><button class="secondary" data-action="messages">MES MESSAGES</button><button class="danger-btn" data-action="logout">ME DÉCONNECTER</button></div>`;
}

function publicProfileView() {
  const p = state.selectedProfile;
  if (!p) return `${pageHead("Profil", "Profil danseur", "partners")}<div class="empty">Profil introuvable.</div>`;
  const styles = Array.isArray(p.styles) ? p.styles : [];
  return `${pageHead(p.display_name || "Profil", "Profil danseur", "partners")}
    ${statusBlock()}
    <article class="card profile-card">
      <div class="person-line">${avatar(p, "large")}<div><h2>${escapeHtml(p.display_name)}</h2><div class="meta">📍 ${escapeHtml(p.city || "Ville non indiquée")} · ${escapeHtml(p.level || "Niveau non indiqué")}</div></div></div>
      <div class="tags">${p.dance_role ? `<span class="tag role-tag">↔️ ${escapeHtml(p.dance_role)}</span>` : ""}${styles.map(style => `<span class="tag">${escapeHtml(style)}</span>`).join("")}</div>
      ${p.bio ? `<div class="divider"></div><p class="profile-bio">${escapeHtml(p.bio)}</p>` : ""}
      ${p.training_match_enabled ? (() => {
        const interested = state.trainingInterestIds.includes(p.id);
        const matched = state.trainingMatches.some(match => match.id === p.id);
        if (matched) return `<div class="mutual-profile-panel matched"><span class="eyebrow">CONNEXION TRAINING</span><strong>✨ Connexion mutuelle</strong><p>Vous vous êtes choisis tous les deux pour essayer un training.</p></div>`;
        if (state.session && !state.profile?.training_match_enabled) return `<div class="mutual-profile-panel"><span class="eyebrow">CONNEXION TRAINING · PRIVÉE</span><p>Activez cette option dans votre profil pour participer.</p><button class="secondary" data-action="enable-training-match">ACTIVER DANS MON PROFIL</button></div>`;
        return `<div class="mutual-profile-panel"><span class="eyebrow">CONNEXION TRAINING · PRIVÉE</span><p>Votre choix reste invisible. Il n'est révélé que si ${escapeHtml(p.display_name || "cette personne")} vous choisit aussi.</p><button class="${interested ? "secondary" : "primary"}" data-action="training-interest" data-id="${escapeHtml(p.id)}" data-active="${interested ? "false" : "true"}">${interested ? "INTÉRÊT ENVOYÉ · ANNULER" : "ÇA POURRAIT FONCTIONNER EN TRAINING"}</button></div>`;
      })() : ""}
      <div class="actions"><button class="primary" data-action="message-user" data-id="${escapeHtml(p.id)}">ENVOYER UN MESSAGE</button><button class="secondary" data-action="training-with" data-id="${escapeHtml(p.id)}">PROPOSER UN TRAINING</button><button class="text-btn danger-text" data-action="report-profile" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.display_name)}">SIGNALER CE PROFIL</button></div>
    </article>`;
}

function messagesView() {
  return `${pageHead("Mes messages", "Vos conversations privées.")}${statusBlock()}<div id="threads"><div class="empty">Chargement des conversations…</div></div>`;
}

async function loadThreads() {
  const target = document.querySelector("#threads");
  if (!target) return;
  if (!state.session || !api.isConfigured()) { target.innerHTML = `<div class="empty">Connectez-vous pour retrouver vos messages.</div>`; return; }
  try {
    const rows = await api.listConversations(state.session.user.id);
    if (!document.querySelector("#threads")) return;
    if (!rows.length) { target.innerHTML = `<div class="empty"><strong>Aucune conversation pour le moment.</strong><span>Trouvez un partenaire puis envoyez-lui un message.</span></div>`; return; }
    target.innerHTML = rows.map(thread => {
      const other = thread.participant_a === state.session.user.id ? thread.profile_b : thread.profile_a;
      return `<button class="thread-btn card" data-action="open-thread" data-id="${escapeHtml(thread.id)}" data-other="${escapeHtml(other?.id || "")}" data-name="${escapeHtml(other?.display_name || "Danseur")}"><div class="person-line">${avatar(other)}<div><h3>${escapeHtml(other?.display_name || "Danseur")}</h3><div class="meta">${escapeHtml(other?.city || "")} · Ouvrir la conversation</div></div></div></button>`;
    }).join("");
  } catch {
    target.innerHTML = `<div class="status error">Impossible de charger les conversations.</div>`;
  }
}

function chatView() {
  const c = state.selectedConversation;
  if (!c) return `${pageHead("Messages", "Conversation privée", "messages")}<div class="empty">Conversation introuvable.</div>`;
  return `${pageHead(c.name, "Conversation privée", "messages")}
    ${statusBlock()}
    <div class="chat-tools"><button class="small-action" data-action="hide-conversation">MASQUER</button><button class="small-action" data-action="block-user" data-id="${escapeHtml(c.otherId)}">BLOQUER</button><button class="small-action" data-action="report-profile" data-id="${escapeHtml(c.otherId)}" data-name="${escapeHtml(c.name)}">SIGNALER</button></div>
    <div id="chat" class="chat" aria-live="polite"><div class="empty">Chargement des messages…</div></div>
    <form id="message-form" class="chat-compose"><input name="body" maxlength="1500" autocomplete="off" placeholder="Écrire un message" aria-label="Écrire un message" value="${escapeHtml(c.draft || "")}" required /><button type="submit">ENVOYER</button></form>`;
}

function appendMessage(message) {
  const target = document.querySelector("#chat");
  if (!target || !state.session) return;
  if (target.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`)) return;
  const empty = target.querySelector(".empty");
  if (empty) empty.remove();
  target.insertAdjacentHTML("beforeend", `<div class="bubble ${message.sender_id === state.session.user.id ? "mine" : "theirs"}" data-message-id="${escapeHtml(message.id)}">${escapeHtml(message.body)}</div>`);
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function loadChat() {
  const target = document.querySelector("#chat");
  if (!target || !state.selectedConversation || !state.session || !api.isConfigured()) return;
  try {
    const messages = await api.listMessages(state.selectedConversation.id);
    if (!document.querySelector("#chat")) return;
    target.innerHTML = messages.length ? messages.map(msg => `<div class="bubble ${msg.sender_id === state.session.user.id ? "mine" : "theirs"}" data-message-id="${escapeHtml(msg.id)}">${escapeHtml(msg.body)}</div>`).join("") : `<div class="empty"><strong>La conversation est prête.</strong><span>Envoyez votre premier message.</span></div>`;
    window.scrollTo(0, document.body.scrollHeight);
    if (stopRealtime) stopRealtime();
    stopRealtime = api.subscribeToMessages(state.selectedConversation.id, appendMessage);
  } catch {
    target.innerHTML = `<div class="status error">Impossible de charger les messages.</div>`;
  }
}

async function openConversation(otherId, draft = "") {
  if (!api.isConfigured()) { setFlash("Supabase doit être configuré pour utiliser la messagerie.", "error"); render(); return; }
  try {
    const [conversationId, profile] = await Promise.all([api.startConversation(otherId), api.getPublicProfile(otherId)]);
    state.selectedConversation = { id: conversationId, otherId, name: profile?.display_name || "Danseur", draft };
    go("chat");
  } catch (error) {
    setFlash(friendlyError(error, "Impossible d'ouvrir cette conversation."), "error");
    render();
  }
}

function myPostsView() {
  return `${pageHead("Mes annonces", "Retrouvez et supprimez vos annonces.", "profile")}${statusBlock()}<div id="my-posts"><div class="empty">Chargement de vos annonces…</div></div>`;
}

async function loadMyPosts() {
  const target = document.querySelector("#my-posts");
  if (!target || !state.session || !api.isConfigured()) return;
  try {
    const { training, carpools } = await api.listMyPosts(state.session.user.id);
    const trainingHtml = training.length ? training.map(item => `<article class="card"><h3>Training · ${escapeHtml(item.city)}</h3><div class="meta">📅 ${escapeHtml(formatDate(item.event_date))}${item.event_time ? ` · 🕒 ${escapeHtml(formatTime(item.event_time))}` : ""}</div><div class="tags"><span class="tag">${escapeHtml(item.style)}</span><span class="tag">${escapeHtml(item.level)}</span></div><button class="danger-btn top-gap" data-action="delete-training" data-id="${escapeHtml(item.id)}" data-return="my-posts">SUPPRIMER</button></article>`).join("") : `<div class="empty">Aucune demande de training.</div>`;
    const carpoolHtml = carpools.length ? carpools.map(item => `<article class="card"><h3>Covoiturage · ${escapeHtml(item.from_city)} → ${escapeHtml(item.destination)}</h3><div class="meta">📅 ${escapeHtml(formatDate(item.travel_date))}${item.travel_time ? ` · 🕒 ${escapeHtml(formatTime(item.travel_time))}` : ""}</div><button class="danger-btn top-gap" data-action="delete-carpool" data-id="${escapeHtml(item.id)}" data-return="my-posts">SUPPRIMER</button></article>`).join("") : `<div class="empty">Aucun covoiturage publié.</div>`;
    target.innerHTML = `<div class="section-title"><h3>Training</h3></div>${trainingHtml}<div class="section-title"><h3>Covoiturage</h3></div>${carpoolHtml}`;
  } catch {
    target.innerHTML = `<div class="status error">Impossible de charger vos annonces.</div>`;
  }
}

function blockedUsersView() {
  return `${pageHead("Personnes bloquées", "Vous pouvez débloquer une personne à tout moment.", "profile")}${statusBlock()}<div id="blocked-users"><div class="empty">Chargement…</div></div>`;
}

async function loadBlockedUsers() {
  const target = document.querySelector("#blocked-users");
  if (!target || !state.session || !api.isConfigured()) return;
  try {
    const rows = await api.listBlockedUsers(state.session.user.id);
    if (!rows.length) { target.innerHTML = `<div class="empty">Vous n'avez bloqué personne.</div>`; return; }
    target.innerHTML = rows.map(row => `<article class="card"><div class="person-line">${avatar(row.profile)}<div><h3>${escapeHtml(row.profile?.display_name || "Utilisateur")}</h3><div class="meta">${escapeHtml(row.profile?.city || "")}</div></div></div><button class="secondary top-gap" data-action="unblock-user" data-id="${escapeHtml(row.blocked_user_id)}">DÉBLOQUER</button></article>`).join("");
  } catch {
    target.innerHTML = `<div class="status error">Impossible de charger cette liste.</div>`;
  }
}

function reportView() {
  const target = state.reportTarget;
  if (!target) return `${pageHead("Signaler", "Aidez-nous à protéger la communauté.", state.previous || "home")}<div class="empty">Profil introuvable.</div>`;
  return `${pageHead(`Signaler ${target.name || "ce profil"}`, "Le signalement reste privé.", state.previous || "home")}
    ${statusBlock()}
    <form class="form-card" id="report-form">
      <div class="field"><label>Motif</label><select name="category" required>${REPORT_CATEGORIES.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("")}</select></div>
      <div class="field"><label>Détails <span class="help">(facultatif)</span></label><textarea name="details" maxlength="500" placeholder="Décrivez brièvement le problème."></textarea></div>
      <button class="danger-btn" type="submit">ENVOYER LE SIGNALEMENT</button>
    </form>`;
}

function feedbackView() {
  return `${pageHead("Votre avis sur la bêta", "Un retour court suffit pour nous aider.", "home")}
    ${statusBlock()}
    <form class="form-card" id="feedback-form">
      <div class="field"><label for="feedback-category">Type de retour</label><select id="feedback-category" name="category" required><option value="ux">Simplicité / UX</option><option value="bug">Bug ou blocage</option><option value="idea">Idée d'amélioration</option><option value="other">Autre</option></select></div>
      <div class="field"><label for="feedback-message">Votre retour</label><textarea id="feedback-message" name="message" minlength="3" maxlength="1000" required placeholder="Qu'est-ce qui est clair, moins intuitif ou à améliorer ?"></textarea></div>
      <div class="help">Votre retour est associé à votre compte uniquement pour limiter le spam. Il n'est pas affiché publiquement.</div>
      <button class="primary top-gap" type="submit">ENVOYER MON AVIS</button>
    </form>`;
}

function friendlyError(error, fallback) {
  const message = String(error?.message || "").toLowerCase();
  if (error?.code === "SUPABASE_NOT_CONFIGURED") return "Supabase n'est pas encore configuré.";
  if (error?.code === "AVATAR_TYPE") return "Choisissez une image JPG, PNG ou WebP.";
  if (error?.code === "AVATAR_SIZE") return "La photo doit faire moins de 2 Mo.";
  if (message.includes("rate_limit_message")) return "Vous envoyez trop de messages. Réessayez dans une minute.";
  if (message.includes("rate_limit_listing")) return "Vous avez publié plusieurs annonces récemment. Réessayez un peu plus tard.";
  if (message.includes("feedback rate limited")) return "Merci pour votre retour. Attendez quelques secondes avant d’en envoyer un autre.";
  if (message.includes("past_date")) return "Choisissez une date d'aujourd'hui ou future.";
  if (message.includes("conversation blocked")) return "Cette conversation est bloquée.";
  if (message.includes("training match disabled")) return "Activez d’abord Connexion training dans votre profil.";
  if (message.includes("target unavailable")) return "Cette personne ne participe plus à Connexion training.";
  if (message.includes("pair blocked")) return "Cette connexion n’est pas disponible.";
  if (message.includes("invalid login credentials")) return "Votre email ou votre mot de passe est incorrect.";
  if (message.includes("user already registered") || message.includes("already registered")) return "Un compte existe déjà avec cet email.";
  return fallback;
}

function render() {
  let content;
  switch (state.screen) {
    case "home": content = homeView(); break;
    case "partners": content = partnersView(); break;
    case "training-create": content = trainingCreateView(); break;
    case "carpool": content = carpoolView(); break;
    case "carpool-search": content = carpoolSearchView(); break;
    case "carpool-offer": content = carpoolOfferView(); break;
    case "auth": content = authView(); break;
    case "profile": content = ownProfileView(); break;
    case "public-profile": content = publicProfileView(); break;
    case "messages": content = messagesView(); break;
    case "chat": content = chatView(); break;
    case "my-posts": content = myPostsView(); break;
    case "blocked-users": content = blockedUsersView(); break;
    case "report": content = reportView(); break;
    case "feedback": content = feedbackView(); break;
    default: content = homeView();
  }
  app.innerHTML = `<div class="app-shell">${header()}<main class="${state.screen === "home" ? "main-home" : ""}">${content}</main></div>`;
  wireForms();
  if (state.screen === "home") loadHomeTrainingMatchAlert();
  if (state.screen === "partners") { loadTraining(); loadTrainingMatches(); }
  if (state.screen === "messages") loadThreads();
  if (state.screen === "chat") loadChat();
  if (state.screen === "my-posts") loadMyPosts();
  if (state.screen === "blocked-users") loadBlockedUsers();
}

function wireForms() {
  document.querySelector("#partner-search-form")?.addEventListener("submit", event => { event.preventDefault(); searchPartners(event.currentTarget); });
  document.querySelector("#carpool-search-form")?.addEventListener("submit", event => { event.preventDefault(); searchCarpools(event.currentTarget); });

  document.querySelector("#training-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.session) return;
    const fd = new FormData(event.currentTarget);
    try {
      await api.createTrainingRequest(state.session.user.id, {
        city: String(fd.get("city") || "").trim(),
        event_date: fd.get("event_date"),
        event_time: fd.get("event_time") || null,
        style: fd.get("style"),
        level: fd.get("level"),
        note: String(fd.get("note") || "").trim() || null
      });
      setFlash("Votre demande de training est publiée.");
      go("partners", { preserveFlash: true });
    } catch (error) {
      setFlash(friendlyError(error, "La demande n'a pas pu être publiée."), "error");
      render();
    }
  });

  document.querySelector("#carpool-offer-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.session) return;
    const fd = new FormData(event.currentTarget);
    try {
      await api.createCarpoolOffer(state.session.user.id, {
        from_city: String(fd.get("from_city") || "").trim(),
        destination: String(fd.get("destination") || "").trim(),
        event_name: String(fd.get("event_name") || "").trim() || null,
        travel_date: fd.get("travel_date"),
        travel_time: fd.get("travel_time") || null,
        seats_available: Number(fd.get("seats_available") || 1),
        contribution: fd.get("contribution") === "" ? null : Number(fd.get("contribution")),
        note: String(fd.get("note") || "").trim() || null
      });
      setFlash("Votre covoiturage est publié.");
      go("carpool-search", { preserveFlash: true });
    } catch (error) {
      setFlash(friendlyError(error, "Le covoiturage n'a pas pu être publié."), "error");
      render();
    }
  });

  document.querySelector("#auth-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!api.isConfigured()) { setFlash("Ajoutez les variables Supabase dans .env avant d'utiliser les comptes.", "error"); render(); return; }
    const fd = new FormData(event.currentTarget);
    try {
      if (state.authMode === "signup") {
        const data = await api.signUp({
          email: String(fd.get("email") || "").trim(),
          password: fd.get("password"),
          displayName: String(fd.get("display_name") || "").trim(),
          city: String(fd.get("city") || "").trim()
        });
        if (!data.session) {
          state.authMode = "login";
          setFlash("Compte créé. Vérifiez votre email pour confirmer votre inscription.");
          render();
          return;
        }
      } else {
        await api.signIn({ email: String(fd.get("email") || "").trim(), password: fd.get("password") });
      }
      await refreshSession();
      const resumed = await executePendingAction(readPendingAction());
      if (!resumed) go("home");
    } catch (error) {
      setFlash(friendlyError(error, state.authMode === "signup" ? "Impossible de créer le compte. Vérifiez les informations saisies." : "Votre email ou votre mot de passe est incorrect."), "error");
      render();
    }
  });

  document.querySelector("#profile-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.session) return;
    const fd = new FormData(event.currentTarget);
    try {
      let avatarUrl = state.profile?.avatar_url || null;
      const file = fd.get("avatar");
      if (file instanceof File && file.size > 0) avatarUrl = await api.uploadAvatar(state.session.user.id, file);
      state.profile = await api.updateOwnProfile(state.session.user.id, {
        display_name: String(fd.get("display_name") || "").trim(),
        city: String(fd.get("city") || "").trim(),
        level: fd.get("level") || null,
        dance_role: fd.get("dance_role") || null,
        styles: fd.getAll("styles"),
        bio: String(fd.get("bio") || "").trim() || null,
        avatar_url: avatarUrl,
        is_visible: fd.get("is_visible") === "on",
        training_match_enabled: fd.get("training_match_enabled") === "on"
      });
      setFlash("Profil enregistré.");
      render();
    } catch (error) {
      setFlash(friendlyError(error, "Votre profil n'a pas pu être enregistré."), "error");
      render();
    }
  });

  document.querySelector("#message-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.session || !state.selectedConversation) return;
    const input = event.currentTarget.elements.body;
    const body = input.value.trim();
    if (!body) return;
    input.disabled = true;
    try {
      const message = await api.sendMessage({ conversationId: state.selectedConversation.id, senderId: state.session.user.id, body });
      state.selectedConversation.draft = "";
      input.value = "";
      appendMessage(message);
    } catch (error) {
      setFlash(friendlyError(error, "Le message n'a pas pu être envoyé."), "error");
      render();
    } finally {
      const currentInput = document.querySelector("#message-form input");
      if (currentInput) { currentInput.disabled = false; currentInput.focus(); }
    }
  });

  document.querySelector("#feedback-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.session) return;
    const fd = new FormData(event.currentTarget);
    try {
      await api.submitBetaFeedback({
        userId: state.session.user.id,
        category: fd.get("category"),
        message: String(fd.get("message") || "").trim(),
        appVersion: APP_VERSION
      });
      setFlash("Merci ! Votre retour bêta a bien été envoyé.");
      go("home", { preserveFlash: true });
    } catch (error) {
      setFlash(friendlyError(error, "Votre retour n'a pas pu être envoyé."), "error");
      render();
    }
  });

  document.querySelector("#report-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!state.session || !state.reportTarget) return;
    const fd = new FormData(event.currentTarget);
    try {
      await api.reportUser({ reporterId: state.session.user.id, reportedUserId: state.reportTarget.id, category: fd.get("category"), details: String(fd.get("details") || "").trim() });
      setFlash("Signalement envoyé. Merci.");
      state.reportTarget = null;
      go("home", { preserveFlash: true });
    } catch {
      setFlash("Le signalement n'a pas pu être envoyé.", "error");
      render();
    }
  });
}

app.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "home") { go("home"); return; }
  if (action === "go") { go(button.dataset.screen); return; }
  if (action === "account") { if (state.session) go("profile"); else { state.authReason = ""; state.authMode = "login"; go("auth"); } return; }
  if (action === "toggle-auth") { state.authMode = state.authMode === "signup" ? "login" : "signup"; state.error = ""; state.notice = ""; render(); return; }
  if (action === "messages") { await requireAuth("Connectez-vous pour lire et envoyer vos messages.", { type: "messages" }); return; }
  if (action === "feedback") { await requireAuth("Connectez-vous pour envoyer un retour bêta.", { type: "feedback" }); return; }
  if (action === "training-create") { await requireAuth("Créez votre compte pour publier une demande de training.", { type: "training-create" }); return; }
  if (action === "carpool-offer") { await requireAuth("Créez votre compte pour proposer des places.", { type: "carpool-offer" }); return; }
  if (action === "my-posts") { go("my-posts"); return; }
  if (action === "blocked-users") { go("blocked-users"); return; }

  if (action === "view-profile") {
    if (!api.isConfigured()) return;
    try {
      state.selectedProfile = await api.getPublicProfile(button.dataset.id);
      await refreshTrainingConnectionState();
      go("public-profile");
    } catch { setFlash("Ce profil n'est plus disponible.", "error"); render(); }
    return;
  }

  if (action === "training-match-login") { await requireAuth("Connectez-vous pour utiliser la connexion training.", { type: "enable-training-match" }); return; }
  if (action === "enable-training-match") { if (!state.session) { await requireAuth("Connectez-vous pour activer la connexion training.", null); return; } setFlash("Activez « Connexion training » puis enregistrez votre profil."); go("profile", { preserveFlash: true }); return; }
  if (action === "training-interest") { await handleTrainingInterest(button.dataset.id, button.dataset.active !== "false"); return; }
  if (action === "message-user") { await requireAuth("Créez votre compte ou connectez-vous pour contacter ce danseur.", { type: "message-user", userId: button.dataset.id }); return; }
  if (action === "training-with") { await requireAuth("Connectez-vous pour proposer un training.", { type: "message-user", userId: button.dataset.id, draft: "Bonjour, je voudrais te proposer un training." }); return; }

  if (action === "open-thread") {
    state.selectedConversation = { id: button.dataset.id, otherId: button.dataset.other, name: button.dataset.name, draft: "" };
    go("chat");
    return;
  }

  if (action === "delete-training") {
    if (!window.confirm("Supprimer cette demande de training ?")) return;
    try {
      await api.deleteTrainingRequest(button.dataset.id);
      setFlash("Demande supprimée.");
      if (button.dataset.return === "my-posts" || state.screen === "my-posts") { render(); loadMyPosts(); } else loadTraining();
    } catch { setFlash("Impossible de supprimer cette demande.", "error"); render(); }
    return;
  }

  if (action === "delete-carpool") {
    if (!window.confirm("Supprimer ce covoiturage ?")) return;
    try {
      await api.deleteCarpoolPost(button.dataset.id);
      setFlash("Covoiturage supprimé.");
      if (button.dataset.return === "my-posts" || state.screen === "my-posts") { render(); loadMyPosts(); } else go("carpool-search", { preserveFlash: true });
    } catch { setFlash("Impossible de supprimer ce covoiturage.", "error"); render(); }
    return;
  }

  if (action === "hide-conversation") {
    if (!state.selectedConversation || !window.confirm("Masquer cette conversation de votre liste ?")) return;
    try { await api.hideConversation(state.selectedConversation.id); state.selectedConversation = null; setFlash("Conversation masquée."); go("messages", { preserveFlash: true }); }
    catch { setFlash("Impossible de masquer cette conversation.", "error"); render(); }
    return;
  }

  if (action === "block-user") {
    if (!state.session || !window.confirm("Bloquer cette personne ? Elle ne pourra plus vous envoyer de messages.")) return;
    try {
      await api.blockUser(state.session.user.id, button.dataset.id);
      if (state.selectedConversation) await api.hideConversation(state.selectedConversation.id).catch(() => {});
      state.selectedConversation = null;
      setFlash("Cette personne est bloquée.");
      go("messages", { preserveFlash: true });
    } catch (error) {
      if (error?.code === "23505") { setFlash("Cette personne est déjà bloquée."); go("messages", { preserveFlash: true }); }
      else { setFlash("Impossible de bloquer cette personne.", "error"); render(); }
    }
    return;
  }

  if (action === "unblock-user") {
    if (!state.session) return;
    try { await api.unblockUser(state.session.user.id, button.dataset.id); setFlash("Personne débloquée."); render(); loadBlockedUsers(); }
    catch { setFlash("Impossible de débloquer cette personne.", "error"); render(); }
    return;
  }

  if (action === "report-profile") {
    await requireAuth("Connectez-vous pour envoyer un signalement.", null);
    if (!state.session) {
      savePendingAction({ type: "report-user", userId: button.dataset.id, name: button.dataset.name || "ce profil" });
      return;
    }
    state.reportTarget = { id: button.dataset.id, name: button.dataset.name || "ce profil" };
    go("report");
    return;
  }

  if (action === "logout") {
    try { await api.signOut(); } catch {}
    state.session = null;
    state.profile = null;
    state.selectedConversation = null;
    state.trainingInterestIds = [];
    state.trainingMatches = [];
    savePendingAction(null);
    setFlash("Vous êtes déconnecté.");
    go("home", { preserveFlash: true });
  }
});

async function loadOwnProfile() {
  if (!state.session || !api.isConfigured()) { state.profile = null; return; }
  try { state.profile = await api.getOwnProfile(state.session.user.id); }
  catch { state.profile = null; }
}

async function refreshSession() {
  if (!api.isConfigured()) { state.session = null; state.profile = null; return; }
  try { state.session = await api.getSession(); await loadOwnProfile(); }
  catch { state.session = null; state.profile = null; }
}

async function resumeAfterBoot() {
  const pending = readPendingAction();
  if (!state.session || !pending) return false;
  if (pending.type === "report-user") {
    savePendingAction(null);
    state.reportTarget = { id: pending.userId, name: pending.name || "ce profil" };
    go("report");
    return true;
  }
  return executePendingAction(pending);
}

function showUpdatePrompt(registration) {
  if (document.querySelector("#update-toast")) return;
  const toast = document.createElement("div");
  toast.id = "update-toast";
  toast.className = "update-toast";
  toast.innerHTML = `<div><strong>Nouvelle version disponible</strong><span>Mettez KizConnect à jour sans réinstaller l'app.</span></div><button type="button">METTRE À JOUR</button>`;
  toast.querySelector("button")?.addEventListener("click", () => {
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  });
  document.body.appendChild(toast);
}

async function setupServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    if (registration.waiting && navigator.serviceWorker.controller) showUpdatePrompt(registration);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdatePrompt(registration);
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    registration.update().catch(() => {});
  } catch {}
}

async function boot() {
  await refreshSession();
  if (api.isConfigured()) {
    api.onAuthStateChange(async session => {
      state.session = session;
      await loadOwnProfile();
      render();
    });
  }
  const resumed = await resumeAfterBoot();
  if (!resumed) render();
  setupServiceWorkerUpdates();
}

boot();
