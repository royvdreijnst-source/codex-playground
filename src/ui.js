import {
  applyDropToRow,
  applyMoveRowCard,
  applyMoveRowCardBackToHand,
  canDragCard,
  doneStreet,
  getStreetProgress,
  isBoardComplete,
  resetFantasylandPlacement,
  startHand,
} from "./game.js";
import { RANK_VALUE, ROWS, STREET_REQUIREMENTS } from "./state.js";

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
  const SCORE_ROWS = ["top", "middle", "bottom"];
  const SCORE_ROW_LABELS = {
    top: "Top",
    middle: "Middle",
    bottom: "Bottom",
  };
  const RANK_LABELS = {
    14: "Ace",
    13: "King",
    12: "Queen",
    11: "Jack",
    10: "Ten",
    9: "Nine",
    8: "Eight",
    7: "Seven",
    6: "Six",
    5: "Five",
    4: "Four",
    3: "Three",
    2: "Two",
  };
  const RANK_PLURALS = {
    14: "Aces",
    13: "Kings",
    12: "Queens",
    11: "Jacks",
    10: "Tens",
    9: "Nines",
    8: "Eights",
    7: "Sevens",
    6: "Sixes",
    5: "Fives",
    4: "Fours",
    3: "Threes",
    2: "Twos",
  };
  let scoreboardAnimationFrame = null;
  let lastAnimatedTotal = 0;

  function getSuitSortValue(card) {
    const suitOrder = { "♠": 0, "♥": 1, "♦": 2, "♣": 3 };
    return suitOrder[card.suit] ?? 4;
  }

  function sortFantasylandCards(mode) {
    state.fantasylandSortMode = mode;
    state.handCards.sort((a, b) => {
      if (mode === "suit") {
        const suitDelta = getSuitSortValue(a) - getSuitSortValue(b);
        if (suitDelta !== 0) {
          return suitDelta;
        }
        return RANK_VALUE[b.rank] - RANK_VALUE[a.rank];
      }

      return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
    });
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

    if (!state.handFinished || !state.result?.scoring) {
      return {
        handType: "Complete",
        score: "—",
      };
    }

    const rowRank = state.result.scoring.breakdown?.evaluations?.boardA?.[rowKey];
    return {
      handType: rowRank?.categoryName || "Complete",
      score: "—",
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
        <span class="card-main">${card.rank}${card.suit}</span>
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

  function shouldHideOpponentCards() {
    return state.isFantasyland && !state.handFinished;
  }

  function getDisplayOpponentBoard() {
    if (state.handFinished && state.result?.informationSymmetric && state.result.boardsAtShowdown?.opponent) {
      return state.result.boardsAtShowdown.opponent;
    }

    return state.opponentBoard;
  }

  function renderOpponentRow(rowKey) {
    const hidden = shouldHideOpponentCards();
    const displayBoard = getDisplayOpponentBoard();
    const cards = displayBoard[rowKey]
      .map((card) => {
        if (hidden) {
          return `<div class="card playing-card opponent-card opponent-card-hidden"><span class="card-main">🂠</span></div>`;
        }

        return `
          <div class="card playing-card ${getCardColorClass(card)} opponent-card" title="${card.code}">
            <span class="card-main">${card.rank}${card.suit}</span>
          </div>
        `;
      })
      .join("");

    return `
      <section class="row-panel opponent-row-panel">
        <header class="row-header">
          <h3>${ROWS[rowKey].label}</h3>
          <div class="row-meta">
            <span>${displayBoard[rowKey].length}/${ROWS[rowKey].max}</span>
          </div>
        </header>
        <div class="row-cards opponent-row-cards">${cards}</div>
      </section>
    `;
  }

  function formatSigned(value) {
    if (value > 0) return `+${value}`;
    return `${value}`;
  }

  function rankName(value, plural = false) {
    return plural ? (RANK_PLURALS[value] || `${value}s`) : (RANK_LABELS[value] || `${value}`);
  }

  function formatEvaluationLabel(evaluation) {
    if (!evaluation) {
      return "—";
    }

    const [first, second] = evaluation.tiebreakers || [];
    switch (evaluation.categoryName) {
      case "One Pair":
        return `Pair of ${rankName(first, true)}`;
      case "Two Pair":
        return `Two Pair (${rankName(first, true)} & ${rankName(second, true)})`;
      case "Three of a Kind":
        return `Three of a Kind (${rankName(first, true)})`;
      case "Four of a Kind":
        return `Four of a Kind (${rankName(first, true)})`;
      case "Full House":
        return `Full House (${rankName(first, true)} full of ${rankName(second, true)})`;
      case "High Card":
        return `High Card (${rankName(first)})`;
      case "Straight":
      case "Flush":
      case "Straight Flush":
        return `${evaluation.categoryName} (${rankName(first)} high)`;
      default:
        return evaluation.categoryName;
    }
  }

  function getOutcomeMeta(result) {
    if (result > 0) return { icon: "🟢", className: "row-win" };
    if (result < 0) return { icon: "🔴", className: "row-loss" };
    return { icon: "⚪", className: "row-tie" };
  }

  function getOpponentCellClass(rowResult) {
    if (rowResult < 0) return "row-win";
    if (rowResult > 0) return "row-muted";
    return "row-tie";
  }

  function animateScoreboardTotal() {
    const totalEl = document.getElementById("animated-total-score");
    if (!totalEl) {
      return;
    }

    const target = Number(totalEl.dataset.target || 0);
    const start = lastAnimatedTotal;
    if (start === target) {
      totalEl.textContent = formatSigned(target);
      return;
    }

    if (scoreboardAnimationFrame) {
      cancelAnimationFrame(scoreboardAnimationFrame);
    }

    const duration = 550;
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      const current = Math.round(start + (target - start) * eased);
      totalEl.textContent = formatSigned(current);

      if (progress < 1) {
        scoreboardAnimationFrame = requestAnimationFrame(tick);
      } else {
        lastAnimatedTotal = target;
        totalEl.textContent = formatSigned(target);
      }
    };

    scoreboardAnimationFrame = requestAnimationFrame(tick);
  }

  function renderScoreboard(scoreResult) {
    const handTotal = scoreResult?.pointsA ?? 0;
    const handSigned = handTotal > 0 ? `+${handTotal}` : `${handTotal}`;
    const totalClass = handTotal > 0 ? "score-positive" : handTotal < 0 ? "score-negative" : "score-neutral";

    if (!state.result || !scoreResult) {
      return `
        <section class="panel score-panel">
          <header class="panel-heading">
            <h2>Total Score: <span class="score-neutral">0</span></h2>
            <span class="panel-caption">Round breakdown</span>
          </header>
          <p class="score-summary">Finish a hand to see row-by-row analysis.</p>
        </section>
      `;
    }

    let summaryText = "Rows compared normally.";
    if (state.result.bothFouled) {
      summaryText = "Both players fouled – 0-0";
    } else if (state.result.singleFoul) {
      summaryText = state.result.fouled
        ? "You fouled"
        : "Opponent Fouled";
    } else if (state.result.scoop) {
      summaryText = "Scoop! +3 bonus applied once.";
    }

    const rowBreakdown = SCORE_ROWS.map((rowKey, rowIndex) => {
      const rowResult = scoreResult.lineWinsA[rowKey] || 0;
      const playerRoyalty = scoreResult.breakdown.royaltiesA[rowKey] || 0;
      const opponentRoyalty = scoreResult.breakdown.royaltiesB[rowKey] || 0;
      const net = rowResult + playerRoyalty - opponentRoyalty;
      const playerOutcome = getOutcomeMeta(rowResult);
      const opponentOutcome = getOutcomeMeta(-rowResult);
      const playerEval = scoreResult.breakdown.evaluations.boardA[rowKey];
      const opponentEval = scoreResult.breakdown.evaluations.boardB[rowKey];

      return `
        <tr class="score-row score-row-${rowIndex % 2 === 0 ? "alt" : "base"}">
          <td class="${playerOutcome.className}">
            <span class="score-row-name">${SCORE_ROW_LABELS[rowKey]}</span>
            <span class="score-icon">${playerOutcome.icon}</span>
            <span>${formatEvaluationLabel(playerEval)}</span>
          </td>
          <td title="Royalties by row from scoreHand().">${playerRoyalty}</td>
          <td class="score-net-cell">${formatSigned(rowResult)} + ${playerRoyalty} - ${opponentRoyalty} = <strong>${formatSigned(net)}</strong></td>
          <td title="Royalties by row from scoreHand().">${opponentRoyalty}</td>
          <td class="${getOpponentCellClass(rowResult)}">
            <span class="score-row-name">${SCORE_ROW_LABELS[rowKey]}</span>
            <span class="score-icon">${opponentOutcome.icon}</span>
            <span>${formatEvaluationLabel(opponentEval)}</span>
          </td>
        </tr>
      `;
    }).join("");

    const scoopBonus = scoreResult.breakdown.linePointsA
      - (scoreResult.lineWinsA.top + scoreResult.lineWinsA.middle + scoreResult.lineWinsA.bottom);

    return `
      <section class="panel score-panel">
        <header class="panel-heading">
          <h2>Total Score: <span id="animated-total-score" class="${totalClass}" data-target="${handTotal}">${handSigned}</span></h2>
          <span class="panel-caption">Round breakdown</span>
        </header>
        <p class="score-opponent-muted">Opponent total: ${formatSigned(scoreResult.pointsB)}</p>
        <p class="score-status ${state.result.bothFouled ? "status-neutral" : state.result.fouled ? "status-negative" : state.result.opponent?.fouled ? "status-positive" : "status-neutral"}">${summaryText}</p>
        <table class="score-breakdown-table" aria-label="Round score breakdown">
          <thead>
            <tr>
              <th>Player Hand</th>
              <th title="Royalties from scoreHand().">Player Royalties</th>
              <th>Net Row Score</th>
              <th title="Royalties from scoreHand().">Opponent Royalties</th>
              <th>Opponent Hand</th>
            </tr>
          </thead>
          <tbody>
            ${rowBreakdown}
            <tr class="score-total-row">
              <td></td>
              <td title="Sum of player top/middle/bottom royalties.">${scoreResult.royaltiesA}</td>
              <td class="score-total-main ${totalClass}">${handSigned}</td>
              <td title="Sum of opponent top/middle/bottom royalties.">${scoreResult.royaltiesB}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <details class="score-calc-details">
          <summary>View Calculation Details</summary>
          <ul>
            <li>Line points: ${formatSigned(scoreResult.lineWinsA.top + scoreResult.lineWinsA.middle + scoreResult.lineWinsA.bottom)}</li>
            <li>Scoop Bonus: ${formatSigned(scoopBonus)}</li>
            <li>Royalties delta: ${formatSigned(scoreResult.royaltiesA - scoreResult.royaltiesB)}</li>
            <li>Total Player Score: ${formatSigned(scoreResult.pointsA)}</li>
          </ul>
        </details>
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
    const resetFantasylandButton = document.getElementById("reset-fantasyland");
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

    if (resetFantasylandButton) {
      resetFantasylandButton.addEventListener("click", () => {
        dispatch(() => {
          resetFantasylandPlacement(state);
        });
      });
    }

    document.querySelectorAll("[data-sort-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        dispatch(() => {
          sortFantasylandCards(button.dataset.sortMode || "value");
        });
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
            ${state.isFantasyland ? `<button id="reset-fantasyland" type="button" ${state.handFinished ? "disabled" : ""}>Reset FL placement</button>` : ""}
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
          ${state.isFantasyland ? `
            <div class="sort-controls">
              <span>Sort:</span>
              <button class="sort-btn ${state.fantasylandSortMode === "value" ? "active" : ""}" data-sort-mode="value" type="button">Value (2→A)</button>
              <button class="sort-btn ${state.fantasylandSortMode === "suit" ? "active" : ""}" data-sort-mode="suit" type="button">Suit (♠ ♥ ♦ ♣)</button>
            </div>
          ` : ""}
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

          ${renderScoreboard(state.result?.scoring)}

          <section class="panel board-panel opponent-board-panel">
            <header class="panel-heading">
              <h2>Opponent Board</h2>
              <span class="panel-caption">Cards are hidden during Fantasyland until showdown</span>
            </header>
            ${renderOpponentRow("top")}
            ${renderOpponentRow("middle")}
            ${renderOpponentRow("bottom")}
          </section>
        </section>


        <section class="panel history-panel">
          <header class="panel-heading">
            <h2>${state.isFantasyland || state.dealtByStreet.fantasyland ? "Deal History" : "Street History"}</h2>
            <span class="panel-caption">${state.isFantasyland || state.dealtByStreet.fantasyland ? "Fantasyland deal and burns" : "Dealt cards and auto-discards"}</span>
          </header>
          ${renderStreetHistory()}
        </section>

        <section class="panel rules-panel">
          <h2>Rules (current)</h2>
          <p>Foul rule: Bottom row must be at least as strong as Middle, and Middle must be at least as strong as Top. If one player fouls, the fouled player loses all three lines, gets no royalties, and both-foul is always 0-0.</p>
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
    animateScoreboardTotal();
  }

  return { render };
}
