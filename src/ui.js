import {
  applyDropToRow,
  applyMoveRowCard,
  applyMoveRowCardBackToHand,
  canDragCard,
  doneStreet,
  getStreetProgress,
  isBoardComplete,
  startHand,
} from "./game.js";
import { evaluateFiveCardHand, evaluateThreeCardTop } from "./evaluator.js";
import { ROYALTY_TABLE } from "./royalties.js";
import { ROWS, STREET_REQUIREMENTS } from "./state.js";

function getCardColorClass(card) {
  return card.suit === "♥" || card.suit === "♦" ? "red" : "black";
}

function parseDragPayload(event) {
  const raw = event.dataTransfer.getData("text/plain");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function createUI({ app, state, dispatch }) {
  function getTopRoyalty(evaluation) {
    if (evaluation.rankName === "Three of a Kind") {
      return evaluation.tiebreak[0] + 8;
    }

    if (evaluation.rankName === "One Pair" && evaluation.tiebreak[0] >= 6) {
      return evaluation.tiebreak[0] - 5;
    }

    return 0;
  }

  function getRowSummary(rowKey) {
    const cards = state.board[rowKey];
    const isComplete = cards.length === ROWS[rowKey].max;

    if (!isComplete) {
      return {
        handType: "Incomplete",
        score: "—",
      };
    }

    if (rowKey === "top") {
      const evaluation = evaluateThreeCardTop(cards);
      return {
        handType: evaluation.rankName,
        score: getTopRoyalty(evaluation),
      };
    }

    const evaluation = evaluateFiveCardHand(cards);
    return {
      handType: evaluation.rankName,
      score: ROYALTY_TABLE[rowKey][evaluation.rankName] || 0,
    };
  }

  function renderCard(card, source, rowKey = "") {
    const draggable = canDragCard(state, card.id);
    return `
      <button
        class="card playing-card ${getCardColorClass(card)} ${draggable ? "draggable" : "locked-card"}"
        data-card-id="${card.id}"
        data-drag-source="${source}"
        data-row="${rowKey}"
        draggable="${draggable}"
        type="button"
        title="${card.code}"
      >
        <span class="card-corner">${card.rank}<small>${card.suit}</small></span>
        <span class="card-center">${card.suit}</span>
      </button>
    `;
  }

  function renderRow(rowKey) {
    const cards = state.board[rowKey].map((card) => renderCard(card, "row", rowKey)).join("");
    const summary = getRowSummary(rowKey);

    return `
      <section class="row-panel">
        <header class="row-header">
          <h3>${ROWS[rowKey].label}</h3>
          <div class="row-meta">
            <span>${state.board[rowKey].length}/${ROWS[rowKey].max}</span>
            <span class="row-score">Score: ${summary.score}</span>
            <span class="row-hand-type">${summary.handType}</span>
          </div>
        </header>
        <div class="row-cards" data-row="${rowKey}">${cards}</div>
      </section>
    `;
  }

  function renderOpponentRow(rowKey) {
    const cards = state.opponentBoard[rowKey]
      .map((card) => `<div class="card playing-card ${getCardColorClass(card)} opponent-card" title="${card.code}"><span class="card-center">${card.code}</span></div>`)
      .join("");

    return `
      <section class="row-panel opponent-row-panel">
        <header class="row-header">
          <h3>${ROWS[rowKey].label}</h3>
          <div class="row-meta">
            <span>${state.opponentBoard[rowKey].length}/${ROWS[rowKey].max}</span>
          </div>
        </header>
        <div class="row-cards opponent-row-cards">${cards}</div>
      </section>
    `;
  }

  function renderResult() {
    if (!state.result) {
      return "";
    }

    return `
      <section class="panel result-panel">
        <h2>Hand Result</h2>
        <p class="${state.result.fouled ? "error-text" : "success-text"}">
          ${state.result.fouled ? "FOULED - Royalties = 0" : "Valid Hand"}
        </p>
        <ul>
          <li>Top: ${state.result.top.evaluation.rankName} (Royalty ${state.result.top.royalty})</li>
          <li>Middle: ${state.result.middle.evaluation.rankName} (Royalty ${state.result.middle.royalty})</li>
          <li>Bottom: ${state.result.bottom.evaluation.rankName} (Royalty ${state.result.bottom.royalty})</li>
        </ul>
        <p><strong>Total Royalties: ${state.result.total}</strong></p>
      </section>
    `;
  }

  function renderStreetHistory() {
    if (state.isFantasyland || state.dealtByStreet.fantasyland) {
      const dealt = (state.dealtByStreet.fantasyland || []).join(" ");
      const burned = state.burnedCards.length ? state.burnedCards.join(" ") : "-";
      return `<ul><li>Fantasyland: Dealt [${dealt}] | Burned [${burned}]</li></ul>`;
    }

    const lines = [];
    for (let street = 1; street <= 5; street += 1) {
      if (!state.dealtByStreet[street]) {
        continue;
      }
      const dealt = state.dealtByStreet[street].join(" ");
      const discarded = state.discardedByStreet[street] && state.discardedByStreet[street].length
        ? state.discardedByStreet[street].join(" ")
        : "-";
      lines.push(`<li>Street ${street}: Dealt [${dealt}] | Auto-discard [${discarded}]</li>`);
    }
    return `<ul>${lines.join("")}</ul>`;
  }

  function renderFantasylandBanner() {
    const notices = [];
    if (state.isFantasyland) {
      notices.push(`<p class="success-text"><strong>Fantasyland!</strong> Arrange your full pool freely.</p>`);
    }
    if (state.fantasylandEligibleNextHand) {
      notices.push("<p class=\"success-text\">Qualified for Fantasyland next hand.</p>");
    }
    if (state.fantasylandBlockedNextHand && state.handFinished) {
      notices.push("<p class=\"info-text\">Fantasyland cannot happen two hands in a row.</p>");
    }
    return notices.join("");
  }

  function bindEvents() {
    const newHandButton = document.getElementById("new-hand");
    const doneStreetButton = document.getElementById("done-street");
    const vsComputerToggle = document.getElementById("play-vs-computer");
    if (!newHandButton || !doneStreetButton) {
      return;
    }

    newHandButton.addEventListener("click", () => {
      dispatch(() => {
        startHand(state);
      });
    });

    doneStreetButton.addEventListener("click", () => {
      dispatch(() => {
        doneStreet(state);
      });
    });

    if (vsComputerToggle) {
      vsComputerToggle.addEventListener("change", (event) => {
        dispatch(() => {
          state.playVsComputer = Boolean(event.target.checked);
          state.opponentLog = state.playVsComputer ? "Play vs Computer enabled." : "Play vs Computer disabled.";
        });
      });
    }
  }

  function setupDropZoneVisuals(zone) {
    zone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      zone.classList.add("drop-active");
    });

    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      zone.classList.add("drop-active");
    });

    zone.addEventListener("dragleave", (event) => {
      if (!zone.contains(event.relatedTarget)) {
        zone.classList.remove("drop-active");
      }
    });
  }

  function setupDragAndDrop() {
    document.querySelectorAll(".card[draggable='true']").forEach((cardEl) => {
      cardEl.addEventListener("dragstart", (event) => {
        const cardId = cardEl.dataset.cardId;
        const source = cardEl.dataset.dragSource;
        const row = cardEl.dataset.row || null;
        event.dataTransfer.setData("text/plain", JSON.stringify({ cardId, source, row }));
        event.dataTransfer.effectAllowed = "move";
      });
    });

    document.querySelectorAll("[data-row]").forEach((rowZone) => {
      setupDropZoneVisuals(rowZone);
      rowZone.addEventListener("drop", (event) => {
        event.preventDefault();
        rowZone.classList.remove("drop-active");
        const payload = parseDragPayload(event);

        if (!payload.cardId || !canDragCard(state, payload.cardId)) {
          return;
        }

        const destinationRow = rowZone.dataset.row;
        dispatch(() => {
          if (payload.source === "hand") {
            applyDropToRow(state, payload.cardId, destinationRow);
          } else if (payload.source === "row") {
            applyMoveRowCard(state, payload.cardId, destinationRow);
          }
        });
      });
    });

    const handZone = document.querySelector("[data-drop-zone='hand']");
    if (!handZone) {
      return;
    }

    setupDropZoneVisuals(handZone);
    handZone.addEventListener("drop", (event) => {
      event.preventDefault();
      handZone.classList.remove("drop-active");
      const payload = parseDragPayload(event);

      if (!payload.cardId || payload.source !== "row" || !canDragCard(state, payload.cardId)) {
        return;
      }

      dispatch(() => {
        applyMoveRowCardBackToHand(state, payload.cardId);
      });
    });
  }

  function render() {
    const requirement = STREET_REQUIREMENTS[state.currentStreet];
    const progress = getStreetProgress(state);
    const fantasylandDoneDisabled = state.handFinished || !isBoardComplete(state);

    app.innerHTML = `
      <div class="outside-actions">
        <button id="new-hand" type="button">New Hand</button>
      </div>

      <section class="game-layout">
        <section class="panel controls-panel">
          <div class="control-row">
            <button id="done-street" type="button" ${state.isFantasyland ? (fantasylandDoneDisabled ? "disabled" : "") : (state.handFinished ? "disabled" : "")}>Done</button>
            <label class="toggle-inline" for="play-vs-computer">
              <input id="play-vs-computer" type="checkbox" ${state.playVsComputer ? "checked" : ""} />
              Play vs Computer
            </label>
          </div>
          <div class="street-meta">
            ${state.isFantasyland ? `
              <p class="street-title">Fantasyland Mode</p>
              <p class="street-requirement">Deal size: ${state.fantasylandCardCount} · Place exactly 13 on board.</p>
              <p class="street-progress">Board placed: ${progress.placedNow}/13 · Remaining extras: ${state.handCards.length}</p>
              <p class="street-order">First to act this hand: ${state.firstPlayerThisHand === "human" ? "You" : "Opponent"}</p>
            ` : `
              <p class="street-title">Street ${state.currentStreet} / 5</p>
              <p class="street-requirement">Requirement: ${requirement.text}</p>
              <p class="street-progress">Placed this street: ${progress.placedNow}/${requirement.place} · Auto-discarded: ${progress.discardedNow}/${requirement.discard}</p>
              <p class="street-order">First to act this hand: ${state.firstPlayerThisHand === "human" ? "You" : "Opponent"}</p>
            `}
          </div>
          ${renderFantasylandBanner()}
          <p class="status ${state.statusType}">${state.message}</p>
          ${state.opponentLog ? `<p class="opponent-log">${state.opponentLog}</p>` : ""}
        </section>

        <section class="panel hand-panel">
          <header class="panel-heading">
            <h2>${state.isFantasyland ? "Fantasyland Pool" : "Draw Area"}</h2>
            <span class="panel-caption">${state.isFantasyland ? "Unplaced cards (extras auto-burn on Done)" : "Current street cards"}</span>
          </header>
          <div class="hand-zone" data-drop-zone="hand">
            ${state.handCards.map((card) => renderCard(card, "hand")).join("")}
          </div>
        </section>

        <section class="players-row">
          <section class="panel board-panel player-board-panel">
            <header class="panel-heading">
              <h2>Your Board</h2>
              <span class="panel-caption">Top / Middle / Bottom</span>
            </header>
            ${renderRow("top")}
            ${renderRow("middle")}
            ${renderRow("bottom")}
          </section>

          <section class="panel board-panel opponent-board-panel">
            <header class="panel-heading">
              <h2>Opponent Board (revealed cards)</h2>
              <span class="panel-caption">Cards become visible as they are played</span>
            </header>
            ${renderOpponentRow("top")}
            ${renderOpponentRow("middle")}
            ${renderOpponentRow("bottom")}
          </section>
        </section>

        ${renderResult()}

        <section class="panel history-panel">
          <header class="panel-heading">
            <h2>${state.isFantasyland || state.dealtByStreet.fantasyland ? "Deal History" : "Street History"}</h2>
            <span class="panel-caption">${state.isFantasyland || state.dealtByStreet.fantasyland ? "Fantasyland deal and burns" : "Dealt cards and auto-discards"}</span>
          </header>
          ${renderStreetHistory()}
        </section>

        <section class="panel rules-panel">
          <h2>Rules (current)</h2>
          <p>Foul rule: Bottom row must be at least as strong as Middle, and Middle must be at least as strong as Top. Fouled hands score 0 royalties.</p>
          <p><strong>Fantasyland</strong>: Qualify with valid QQ+/trips on top. QQ=13 cards, KK=14, AA=15, trips=16. No consecutive Fantasyland hands.</p>
          <h3>Royalties</h3>
          <p><strong>Top (3 cards)</strong>: Pair 66=1, 77=2, 88=3, 99=4, TT=5, JJ=6, QQ=7, KK=8, AA=9. Trips: 222=10 ... AAA=22.</p>
          <p><strong>Middle (5 cards)</strong>: Trips=2, Straight=4, Flush=8, Full House=12, Quads=20, Straight Flush=30.</p>
          <p><strong>Bottom (5 cards)</strong>: Straight=2, Flush=4, Full House=6, Quads=10, Straight Flush=15.</p>
        </section>
      </section>
    `;

    bindEvents();
    setupDragAndDrop();
  }

  return { render };
}
