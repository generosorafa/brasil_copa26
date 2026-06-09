(function () {
  const DATA = window.COPA26_DATA;
  if (!DATA) return;

  const initialParams = new URLSearchParams(window.location.search);

  const state = {
    activeTab: initialParams.get("tab") || "jogos",
    route: "first",
    calendarView: "grid",
    playerFilter: "Todos",
    nowOverride: initialParams.get("now")
  };

  const wikiCache = new Map();
  const months = [
    { label: "Março", month: 3 },
    { label: "Maio", month: 5 },
    { label: "Junho", month: 6 },
    { label: "Julho", month: 7 }
  ];

  const tabConfig = [
    { id: "jogos", label: "Jogos", icon: "trophy" },
    { id: "caminho", label: "Caminho", icon: "route" },
    { id: "grupo", label: "Grupo", icon: "table-2" },
    { id: "calendario", label: "Agenda", icon: "calendar-days" },
    { id: "elenco", label: "Elenco", icon: "users" },
    { id: "estadios", label: "Sedes", icon: "map-pinned" }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function now() {
    return state.nowOverride ? new Date(state.nowOverride) : new Date();
  }

  function team(id) {
    return DATA.teams[id] || DATA.teams.tbd;
  }

  function venue(id) {
    return DATA.venues[id] || DATA.venues.tbdUsa;
  }

  function parseDate(value) {
    return value ? new Date(value) : null;
  }

  function fmtDate(date, options = {}) {
    return new Intl.DateTimeFormat(DATA.meta.locale, {
      timeZone: DATA.meta.timezone,
      ...options
    }).format(date);
  }

  function fmtDayMonth(date) {
    return fmtDate(date, { day: "2-digit", month: "short" }).replace(".", "");
  }

  function fmtLongDate(date) {
    return fmtDate(date, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).replace(".", "");
  }

  function fmtTime(game) {
    if (game.timeLabel) return game.timeLabel;
    return fmtDate(parseDate(game.date), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function icon(name) {
    return `<i data-lucide="${name}" aria-hidden="true"></i>`;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function gameState(game, at = now()) {
    if (game.status === "final") return "final";
    if (game.status === "conditional") return "conditional";
    const start = parseDate(game.date);
    const end = parseDate(game.end);
    if (start && end && at >= start && at <= end) return "live";
    if (end && at > end && !game.score) return "needs-update";
    return "scheduled";
  }

  function isBrazilGame(game) {
    return game.home === "brazil" || game.away === "brazil";
  }

  function brazilGames() {
    return DATA.games.filter(isBrazilGame).sort((a, b) => parseDate(a.date) - parseDate(b.date));
  }

  function groupGames() {
    return DATA.games.filter((game) => game.group === DATA.group.id);
  }

  function statusCopy(game) {
    const status = gameState(game);
    if (status === "live") return { label: "Ao vivo", className: "is-live" };
    if (status === "needs-update") return { label: "Atualizar placar", className: "needs-update" };
    if (status === "final") return { label: "Finalizado", className: "is-final" };
    if (status === "conditional") return { label: "Condicional", className: "is-conditional" };
    if (game.importance === "next") return { label: "Próximo", className: "is-next" };
    return { label: "Em breve", className: "is-scheduled" };
  }

  function scoreMarkup(game) {
    if (!game.score) {
      return game.status === "conditional"
        ? `<span class="score-muted">${esc(game.condition || "Classificação necessária")}</span>`
        : `<span class="score-time">${esc(fmtTime(game))}</span>`;
    }

    return `<span class="score-number">${game.score.home}<span>×</span>${game.score.away}</span>`;
  }

  function goalSummaryText(game) {
    const goals = Array.isArray(game.goals) ? game.goals : [];
    if (!goals.length) return "";

    return [game.home, game.away]
      .map((teamId) => {
        const teamGoals = goals.filter((goal) => goal.team === teamId);
        if (!teamGoals.length) return "";

        const scorers = teamGoals
          .map((goal) => `${goal.player}${goal.minute ? ` (${goal.minute})` : ""}`)
          .join(", ");
        return `${team(teamId).shortName}: ${scorers}`;
      })
      .filter(Boolean)
      .join(" · ");
  }

  function goalSummaryMarkup(game, className = "goal-line") {
    const summary = goalSummaryText(game);
    return summary ? `<div class="${className}">${icon("circle-dot")}<span>${esc(summary)}</span></div>` : "";
  }

  function brazilOutcome(game) {
    if (!game.score || !isBrazilGame(game)) return "";
    const brazilHome = game.home === "brazil";
    const brazilScore = brazilHome ? game.score.home : game.score.away;
    const otherScore = brazilHome ? game.score.away : game.score.home;
    if (brazilScore > otherScore) return "win";
    if (brazilScore < otherScore) return "loss";
    return "draw";
  }

  function getSpotlightGame() {
    const at = now();
    const games = brazilGames();
    const live = games.find((game) => gameState(game, at) === "live");
    if (live) return live;

    const stale = games.find((game) => gameState(game, at) === "needs-update");
    if (stale) return stale;

    const scheduled = games.find((game) => parseDate(game.date) >= at && game.status !== "final");
    return scheduled || games[games.length - 1];
  }

  function countdownParts(game) {
    const target = parseDate(game.date);
    const diff = Math.max(0, target - now());
    return [
      { label: "Dias", value: Math.floor(diff / 86400000) },
      { label: "Horas", value: Math.floor((diff % 86400000) / 3600000) },
      { label: "Min", value: Math.floor((diff % 3600000) / 60000) },
      { label: "Seg", value: Math.floor((diff % 60000) / 1000) }
    ];
  }

  function renderTabs() {
    const nav = $("#tabNav");
    nav.innerHTML = tabConfig
      .map((tab) => `
        <button class="tab-button ${tab.id === state.activeTab ? "active" : ""}" type="button"
          data-tab-target="${tab.id}" aria-controls="section-${tab.id}"
          aria-selected="${tab.id === state.activeTab}">
          ${icon(tab.icon)}
          <span>${tab.label}</span>
        </button>
      `)
      .join("");
  }

  function activateTab(id) {
    state.activeTab = id;
    $$(".app-section").forEach((section) => {
      section.classList.toggle("active", section.id === `section-${id}`);
    });
    renderTabs();
    refreshIcons();
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderHero() {
    const game = getSpotlightGame();
    const home = team(game.home);
    const away = team(game.away);
    const place = venue(game.venue);
    const badge = statusCopy(game);
    const start = parseDate(game.date);
    const status = gameState(game);

    $("#heroBadge").className = `status-pill ${badge.className}`;
    $("#heroBadge").textContent = badge.label;
    $("#heroPhase").textContent = game.phase;
    $("#heroTitle").textContent =
      status === "needs-update" ? "Resultado pendente" : status === "live" ? "Brasil em campo agora" : "Próximo compromisso";

    $("#heroTeams").innerHTML = `
      <div class="hero-team">
        <span class="flag">${home.flag}</span>
        <strong>${esc(home.shortName)}</strong>
      </div>
      <div class="hero-score">${scoreMarkup(game)}</div>
      <div class="hero-team right">
        <span class="flag">${away.flag}</span>
        <strong>${esc(away.shortName)}</strong>
      </div>
    `;

    $("#heroMeta").innerHTML = `
      <span>${icon("calendar")} ${esc(fmtLongDate(start))}</span>
      <span>${icon("clock-3")} ${esc(fmtTime(game))} ${DATA.meta.timezoneLabel}</span>
      <span>${icon("map-pin")} ${esc(place.commonName || place.name)}, ${esc(place.city)}</span>
    `;

    const parts = countdownParts(game);
    $("#heroCountdown").innerHTML = parts
      .map((part) => `
        <div class="count-cell">
          <strong>${String(part.value).padStart(2, "0")}</strong>
          <span>${part.label}</span>
        </div>
      `)
      .join("");

    const insight = status === "needs-update"
      ? "O jogo ja passou pelo horario previsto. Atualize o placar em data/site-data.js para a pagina recalcular tudo."
      : status === "conditional"
        ? game.condition
        : `${home.shortName} x ${away.shortName} em ${place.city}.`;
    $("#heroInsight").textContent = insight;

    const actions = [];
    if (game.watchUrl) {
      actions.push(`<a class="primary-action" href="${esc(game.watchUrl)}" target="_blank" rel="noopener">${icon("play")} Assistir</a>`);
    }
    actions.push(`<button class="ghost-action" type="button" data-download-ics="${esc(game.id)}">${icon("calendar-plus")} Lembrete</button>`);
    actions.push(`<button class="ghost-action" type="button" data-share-game="${esc(game.id)}">${icon("send")} Compartilhar</button>`);
    $("#heroActions").innerHTML = actions.join("");

    loadHeroImage(place);
    renderQuickStats();
    refreshIcons();
  }

  function renderQuickStats() {
    const at = now();
    const games = brazilGames();
    const nextOfficial = games.find((game) => game.stage === "group" && parseDate(game.date) >= at);
    const finished = games.filter((game) => game.status === "final").length;
    const remaining = games.filter((game) => game.status !== "final" && parseDate(game.date) >= at).length;
    const groupKickoff = DATA.games.find((game) => game.id === "group-brazil-morocco");
    const daysToCup = Math.max(0, Math.ceil((parseDate(groupKickoff.date) - at) / 86400000));

    $("#quickStats").innerHTML = `
      <article class="quick-stat">
        <span>${icon("timer")}</span>
        <strong>${daysToCup}</strong>
        <small>dias para estreia</small>
      </article>
      <article class="quick-stat">
        <span>${icon("list-checks")}</span>
        <strong>${remaining}</strong>
        <small>jogos no radar</small>
      </article>
      <article class="quick-stat">
        <span>${icon("badge-check")}</span>
        <strong>${finished}</strong>
        <small>atualizados</small>
      </article>
      <article class="quick-stat">
        <span>${icon("map")}</span>
        <strong>${esc(nextOfficial ? venue(nextOfficial.venue).city : "NJ")}</strong>
        <small>proxima sede FIFA</small>
      </article>
    `;
  }

  function renderGames() {
    const container = $("#gamesTimeline");
    const grouped = [
      { id: "friendly", title: "Preparação", subtitle: "Amistosos e ajustes finais" },
      { id: "group", title: "Fase de Grupos", subtitle: "Jogos oficiais do Grupo C" },
      { id: "knockout", title: "Mata-mata", subtitle: "Cenários condicionais" }
    ];

    container.innerHTML = grouped
      .map((group) => {
        const games = DATA.games
          .filter((game) => isBrazilGame(game) && game.stage === group.id)
          .sort((a, b) => parseDate(a.date) - parseDate(b.date));
        if (!games.length) return "";
        return `
          <div class="timeline-block">
            <div class="section-heading compact">
              <span>${group.title}</span>
              <small>${group.subtitle}</small>
            </div>
            <div class="game-list">
              ${games.map((game) => gameCard(game)).join("")}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function gameCard(game, options = {}) {
    const home = team(game.home);
    const away = team(game.away);
    const place = venue(game.venue);
    const badge = statusCopy(game);
    const outcome = brazilOutcome(game);
    const goals = goalSummaryMarkup(game);
    const cardClasses = [
      "game-card",
      badge.className,
      outcome ? `result-${outcome}` : "",
      options.compact ? "compact" : ""
    ].join(" ");
    const possible = game.possibleOpponents?.length
      ? `<div class="possible-line">${icon("sparkles")} ${esc(game.possibleOpponents.join(" · "))}</div>`
      : "";

    return `
      <article class="${cardClasses}" data-open-game="${esc(game.id)}">
        <div class="game-topline">
          <span>${esc(game.phase)}</span>
          <mark>${esc(badge.label)}</mark>
        </div>
        <div class="match-line">
          <div class="team-side">
            <span class="flag">${home.flag}</span>
            <strong>${esc(home.shortName)}</strong>
          </div>
          <div class="score-box">${scoreMarkup(game)}</div>
          <div class="team-side right">
            <span class="flag">${away.flag}</span>
            <strong>${esc(away.shortName)}</strong>
          </div>
        </div>
        ${goals}
        ${possible}
        <div class="game-footer">
          <span>${icon("calendar")} ${esc(fmtDayMonth(parseDate(game.date)))} · ${esc(fmtTime(game))}</span>
          <span>${icon("map-pin")} ${esc(place.commonName || place.name)}</span>
        </div>
        <div class="card-actions">
          ${game.watchUrl ? `<a href="${esc(game.watchUrl)}" target="_blank" rel="noopener" data-stop-card>${icon("play")} CazéTV</a>` : ""}
          <button type="button" data-download-ics="${esc(game.id)}" data-stop-card>${icon("calendar-plus")} ICS</button>
        </div>
      </article>
    `;
  }

  function renderPath() {
    $("#routeToggle").innerHTML = `
      <button class="${state.route === "first" ? "active" : ""}" type="button" data-route="first">
        ${icon("medal")} 1º do Grupo
      </button>
      <button class="${state.route === "second" ? "active" : ""}" type="button" data-route="second">
        ${icon("flag")} 2º do Grupo
      </button>
    `;

    const games = DATA.games
      .filter((game) => game.stage === "knockout" && (game.route === state.route || game.route === "final"))
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));

    $("#pathSummary").innerHTML = state.route === "first"
      ? "Caminho mais curto no papel: evita alguns cruzamentos mais pesados cedo, mas ainda depende do Grupo F."
      : "Caminho mais duro: pode trazer lideres fortes mais cedo e exige gestao de viagem maior.";

    $("#bracketBoard").innerHTML = games
      .map((game, index) => {
        const place = venue(game.venue);
        return `
          <article class="bracket-node ${index === games.length - 1 ? "gold" : ""}">
            <div class="bracket-stage">${esc(game.phase)}</div>
            <div class="bracket-match">
              <span>${team(game.home).flag} ${esc(team(game.home).shortName)}</span>
              <strong>vs</strong>
              <span>${team(game.away).flag} ${esc(team(game.away).shortName)}</span>
            </div>
            <div class="bracket-meta">
              <span>${esc(fmtDayMonth(parseDate(game.date)))} · ${esc(fmtTime(game))}</span>
              <span>${esc(place.commonName || place.name)}</span>
            </div>
            <p>${esc(game.condition)}</p>
          </article>
        `;
      })
      .join("");
  }

  function computeGroupTable() {
    const rows = DATA.group.teams.reduce((acc, id) => {
      acc[id] = { id, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 };
      return acc;
    }, {});

    groupGames().forEach((game) => {
      if (game.status !== "final" || !game.score) return;
      const home = rows[game.home];
      const away = rows[game.away];
      if (!home || !away) return;

      home.pj += 1; away.pj += 1;
      home.gp += game.score.home; home.gc += game.score.away;
      away.gp += game.score.away; away.gc += game.score.home;

      if (game.score.home > game.score.away) {
        home.v += 1; away.d += 1; home.pts += 3;
      } else if (game.score.home < game.score.away) {
        away.v += 1; home.d += 1; away.pts += 3;
      } else {
        home.e += 1; away.e += 1; home.pts += 1; away.pts += 1;
      }
    });

    Object.values(rows).forEach((row) => {
      row.sg = row.gp - row.gc;
    });

    return Object.values(rows).sort((a, b) =>
      b.pts - a.pts ||
      b.sg - a.sg ||
      b.gp - a.gp ||
      DATA.group.teams.indexOf(a.id) - DATA.group.teams.indexOf(b.id)
    );
  }

  function renderGroup() {
    const rows = computeGroupTable();
    $("#groupTableBody").innerHTML = rows
      .map((row, index) => {
        const t = team(row.id);
        return `
          <tr class="${row.id === "brazil" ? "highlight" : ""}">
            <td><span class="rank ${index < 2 ? "qualifies" : index === 2 ? "third" : ""}">${index + 1}</span></td>
            <td class="team-cell"><span>${t.flag}</span><strong>${esc(t.name)}</strong></td>
            <td>${row.pj}</td>
            <td>${row.v}</td>
            <td>${row.e}</td>
            <td>${row.d}</td>
            <td>${row.gp}</td>
            <td>${row.gc}</td>
            <td class="${row.sg >= 0 ? "positive" : "negative"}">${row.sg > 0 ? `+${row.sg}` : row.sg}</td>
            <td><strong>${row.pts}</strong></td>
          </tr>
        `;
      })
      .join("");

    $("#groupFixtures").innerHTML = groupGames()
      .sort((a, b) => parseDate(a.date) - parseDate(b.date))
      .map((game) => gameCard(game, { compact: true }))
      .join("");

    $("#groupOpponents").innerHTML = DATA.group.teams
      .map((id) => {
        const t = team(id);
        return `
          <article class="opponent-card ${id === "brazil" ? "home" : ""}">
            <span class="opponent-flag">${t.flag}</span>
            <div>
              <strong>${esc(t.name)}</strong>
              <small>${esc(t.seed || "")}</small>
              <p>${esc(t.note || "")}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderCalendar() {
    const gamesByDate = DATA.games.reduce((acc, game) => {
      const key = game.date.slice(0, 10);
      if (!acc[key]) acc[key] = [];
      acc[key].push(game);
      return acc;
    }, {});

    $("#calendarMonths").innerHTML = months.map(({ label, month }) => renderMonth(2026, month, label, gamesByDate)).join("");
    $("#calendarAgenda").innerHTML = DATA.games
      .slice()
      .sort((a, b) => parseDate(a.date) - parseDate(b.date))
      .map((game) => {
        const place = venue(game.venue);
        const badge = statusCopy(game);
        return `
          <button class="agenda-item ${badge.className}" type="button" data-open-game="${esc(game.id)}">
            <span class="agenda-date">${esc(fmtDayMonth(parseDate(game.date)))}</span>
            <span class="agenda-body">
              <strong>${team(game.home).flag} ${esc(team(game.home).shortName)} x ${esc(team(game.away).shortName)} ${team(game.away).flag}</strong>
              <small>${esc(game.phase)} · ${esc(fmtTime(game))} · ${esc(place.city)}</small>
            </span>
            <span class="agenda-status">${esc(badge.label)}</span>
          </button>
        `;
      })
      .join("");

    $("#calendarGridPanel").classList.toggle("hidden", state.calendarView !== "grid");
    $("#calendarAgenda").classList.toggle("hidden", state.calendarView !== "agenda");
    $$(".calendar-toggle button").forEach((button) => {
      button.classList.toggle("active", button.dataset.calendarView === state.calendarView);
    });
  }

  function renderMonth(year, month, label, gamesByDate) {
    const first = new Date(year, month - 1, 1).getDay();
    const total = new Date(year, month, 0).getDate();
    let days = "";

    for (let i = 0; i < first; i += 1) {
      days += `<span class="cal-day empty"></span>`;
    }

    for (let day = 1; day <= total; day += 1) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const items = gamesByDate[key] || [];
      const primary = items[0];
      const classes = ["cal-day"];
      if (primary) classes.push(`has-${primary.stage}`);
      const today = key === now().toISOString().slice(0, 10);
      if (today) classes.push("today");

      days += primary
        ? `<button class="${classes.join(" ")}" type="button" data-open-game="${esc(primary.id)}">
            <span>${day}</span>
            <small>${team(primary.away).flag}</small>
          </button>`
        : `<span class="${classes.join(" ")}"><span>${day}</span></span>`;
    }

    return `
      <article class="month-card">
        <h3>${label}</h3>
        <div class="weekdays"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
        <div class="month-grid">${days}</div>
      </article>
    `;
  }

  function renderPlayers() {
    const positions = ["Todos", ...new Set(DATA.players.map((player) => player.position))];
    $("#playerFilters").innerHTML = positions
      .map((position) => `
        <button class="${state.playerFilter === position ? "active" : ""}" type="button" data-player-filter="${esc(position)}">
          ${esc(position)}
        </button>
      `)
      .join("");

    const players = DATA.players.filter((player) =>
      state.playerFilter === "Todos" || player.position === state.playerFilter
    );

    $("#playersGrid").innerHTML = players
      .map((player) => `
        <article class="player-card ${player.star ? "star" : ""}">
          <div class="sticker-top">
            <span>Fig. ${String(player.card).padStart(2, "0")}</span>
            <strong>${esc(player.role)}</strong>
          </div>
          <div class="player-photo">
            <img data-wiki="${esc(player.wiki)}" alt="${esc(player.name)}" loading="lazy">
            <span>${esc(initials(player.name))}</span>
          </div>
          <div class="player-info">
            <strong>${esc(player.name)}</strong>
            <small>
              <img src="https://api.sofascore.app/api/v1/team/${esc(player.clubId)}/image" alt="" loading="lazy">
              ${esc(player.club)} ${player.countryFlag}
            </small>
          </div>
        </article>
      `)
      .join("");

    hydrateWikiImages($("#playersGrid"));
  }

  function initials(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function renderVenues() {
    const venueIds = [...new Set(DATA.games.filter(isBrazilGame).map((game) => game.venue))];
    $("#venuesGrid").innerHTML = venueIds
      .map((id) => {
        const v = venue(id);
        const games = DATA.games.filter((game) => game.venue === id && isBrazilGame(game));
        return `
          <article class="venue-card">
            <div class="venue-media">
              <img data-wiki="${esc(v.wikiSlug)}" alt="${esc(v.commonName || v.name)}" loading="lazy">
              <span>${icon("image")}</span>
            </div>
            <div class="venue-body">
              <small>${esc(v.region)} · ${esc(v.country)}</small>
              <h3>${esc(v.commonName || v.name)}</h3>
              <p>${esc(v.city)} · ${esc(v.capacity)} lugares · ${esc(v.climate)}</p>
              <div class="venue-games">
                ${games.map((game) => `<span>${esc(fmtDayMonth(parseDate(game.date)))} ${team(game.away).flag}</span>`).join("")}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
    hydrateWikiImages($("#venuesGrid"));
  }

  function renderSources() {
    $("#dataStamp").textContent = `Dados revisados em ${fmtDate(new Date(`${DATA.meta.lastReviewed}T12:00:00-03:00`), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })}`;
    $("#sourceLinks").innerHTML = DATA.meta.sources
      .map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>`)
      .join("");
  }

  async function loadWikiThumbnail(slug) {
    if (!slug) return "";
    if (wikiCache.has(slug)) return wikiCache.get(slug);
    const fallback = "";
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug.replace(/_/g, " "))}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("wiki");
      const data = await response.json();
      const src = data?.thumbnail?.source || data?.originalimage?.source || fallback;
      wikiCache.set(slug, src);
      return src;
    } catch (error) {
      wikiCache.set(slug, fallback);
      return fallback;
    }
  }

  async function hydrateWikiImages(root) {
    const images = $$("img[data-wiki]", root);
    await Promise.all(images.map(async (img) => {
      const slug = img.dataset.wiki;
      if (root?.id === "venuesGrid") img.loading = "eager";
      const src = await loadWikiThumbnail(slug);
      if (!src) {
        img.classList.add("failed");
        return;
      }
      img.onload = () => img.classList.add("loaded");
      img.onerror = () => img.classList.add("failed");
      img.src = src.replace(/\/\d+px-/, "/640px-");
    }));
  }

  async function loadHeroImage(place) {
    const img = $("#heroBg");
    const src = await loadWikiThumbnail(place.wikiSlug);
    if (!src) {
      img.removeAttribute("src");
      img.classList.remove("loaded");
      return;
    }
    img.onload = () => img.classList.add("loaded");
    img.src = src.replace(/\/\d+px-/, "/960px-");
  }

  function openGameSheet(gameId) {
    const game = DATA.games.find((item) => item.id === gameId);
    if (!game) return;
    const home = team(game.home);
    const away = team(game.away);
    const place = venue(game.venue);
    const badge = statusCopy(game);

    $("#sheetBody").innerHTML = `
      <div class="sheet-status ${badge.className}">${esc(badge.label)}</div>
      <div class="sheet-match">
        <div><span>${home.flag}</span><strong>${esc(home.shortName)}</strong></div>
        <div>${scoreMarkup(game)}</div>
        <div><span>${away.flag}</span><strong>${esc(away.shortName)}</strong></div>
      </div>
      ${goalSummaryMarkup(game, "sheet-goals")}
      <div class="sheet-grid">
        <span><small>Fase</small><strong>${esc(game.phase)}</strong></span>
        <span><small>Data</small><strong>${esc(fmtLongDate(parseDate(game.date)))}</strong></span>
        <span><small>Hora</small><strong>${esc(fmtTime(game))} ${DATA.meta.timezoneLabel}</strong></span>
        <span><small>Sede</small><strong>${esc(place.commonName || place.name)}</strong></span>
      </div>
      ${game.possibleOpponents?.length ? `<p class="sheet-note">${esc(game.condition)} · ${esc(game.possibleOpponents.join(", "))}</p>` : ""}
      <div class="sheet-actions">
        ${game.watchUrl ? `<a href="${esc(game.watchUrl)}" target="_blank" rel="noopener">${icon("play")} Assistir</a>` : ""}
        <button type="button" data-download-ics="${esc(game.id)}">${icon("calendar-plus")} Lembrete</button>
      </div>
    `;
    $("#sheetOverlay").classList.add("show");
    $("#gameSheet").classList.add("show");
    document.body.classList.add("sheet-open");
    refreshIcons();
  }

  function closeSheet() {
    $("#sheetOverlay").classList.remove("show");
    $("#gameSheet").classList.remove("show");
    document.body.classList.remove("sheet-open");
  }

  function dateToICS(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function escapeICS(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function buildICS(games) {
    const stamp = dateToICS(new Date());
    const events = games
      .filter((game) => game.date && game.end)
      .map((game) => {
        const home = team(game.home);
        const away = team(game.away);
        const place = venue(game.venue);
        const summary = `${home.shortName} x ${away.shortName} - ${game.phase}`;
        const location = `${place.commonName || place.name}, ${place.city}, ${place.country}`;
        const description = `${game.condition || "Brasil na Copa 2026"} ${game.watchUrl ? `\\nAssistir: ${game.watchUrl}` : ""}`;
        return [
          "BEGIN:VEVENT",
          `UID:${game.id}@brasil-copa26`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${dateToICS(parseDate(game.date))}`,
          `DTEND:${dateToICS(parseDate(game.end))}`,
          `SUMMARY:${escapeICS(summary)}`,
          `LOCATION:${escapeICS(location)}`,
          `DESCRIPTION:${escapeICS(description)}`,
          game.watchUrl ? `URL:${game.watchUrl}` : "",
          "END:VEVENT"
        ].filter(Boolean).join("\r\n");
      })
      .join("\r\n");

    return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Brasil Copa 2026//PT-BR\r\nCALSCALE:GREGORIAN\r\n${events}\r\nEND:VCALENDAR`;
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function downloadICS(gameId) {
    const games = gameId === "all"
      ? brazilGames().filter((game) => game.status !== "final")
      : DATA.games.filter((game) => game.id === gameId);
    if (!games.length) return;
    const filename = gameId === "all" ? "brasil-copa-2026.ics" : `${games[0].id}.ics`;
    downloadText(filename, buildICS(games), "text/calendar;charset=utf-8");
    toast("Lembrete .ics gerado");
  }

  async function shareGame(gameId) {
    const game = DATA.games.find((item) => item.id === gameId);
    if (!game) return;
    const text = `${team(game.home).shortName} x ${team(game.away).shortName} - ${fmtLongDate(parseDate(game.date))}, ${fmtTime(game)} BRT`;
    const shareData = { title: DATA.meta.title, text, url: window.location.href };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(`${text}\n${window.location.href}`).catch(() => {});
    toast("Resumo copiado");
  }

  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => el.classList.remove("show"), 2200);
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const stopCard = event.target.closest("[data-stop-card]");
      if (stopCard) event.stopPropagation();

      const tab = event.target.closest("[data-tab-target]");
      if (tab) {
        activateTab(tab.dataset.tabTarget);
        return;
      }

      const route = event.target.closest("[data-route]");
      if (route) {
        state.route = route.dataset.route;
        renderPath();
        refreshIcons();
        return;
      }

      const calendar = event.target.closest("[data-calendar-view]");
      if (calendar) {
        state.calendarView = calendar.dataset.calendarView;
        renderCalendar();
        return;
      }

      const filter = event.target.closest("[data-player-filter]");
      if (filter) {
        state.playerFilter = filter.dataset.playerFilter;
        renderPlayers();
        return;
      }

      const ics = event.target.closest("[data-download-ics]");
      if (ics) {
        downloadICS(ics.dataset.downloadIcs);
        return;
      }

      const share = event.target.closest("[data-share-game]");
      if (share) {
        shareGame(share.dataset.shareGame);
        return;
      }

      const open = event.target.closest("[data-open-game]");
      if (open && !event.target.closest("a")) {
        openGameSheet(open.dataset.openGame);
        return;
      }

      if (event.target.closest("[data-close-sheet]") || event.target === $("#sheetOverlay")) {
        closeSheet();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSheet();
    });
  }

  function renderAll() {
    if (!tabConfig.some((tab) => tab.id === state.activeTab)) {
      state.activeTab = "jogos";
    }
    renderTabs();
    $$(".app-section").forEach((section) => {
      section.classList.toggle("active", section.id === `section-${state.activeTab}`);
    });
    renderHero();
    renderGames();
    renderPath();
    renderGroup();
    renderCalendar();
    renderPlayers();
    renderVenues();
    renderSources();
    refreshIcons();
  }

  bindEvents();
  renderAll();
  window.setInterval(renderHero, 1000);
}());
