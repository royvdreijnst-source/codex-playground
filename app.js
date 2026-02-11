const app = document.getElementById("app");

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_VALUE = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 2]));

const ROWS = {
  top: { label: "Top", max: 3 },
  middle: { label: "Middle", max: 5 },
  bottom: { label: "Bottom", max: 5 },
};

const STREET_REQUIREMENTS = {
  1: { deal: 5, place: 5, discard: 0, text: "Place 5" },
  2: { deal: 3, place: 2, discard: 1, text: "Place 2, Discard 1" },
  3: { deal: 3, place: 2, discard: 1, text: "Place 2, Discard 1" },
  4: { deal: 3, place: 2, discard: 1, text: "Place 2, Discard 1" },
  5: { deal: 3, place: 2, discard: 1, text: "Place 2, Discard 1" },
};

const state = {
  deck: [],
  board: { top: [], middle: [], bottom: [] },
  currentStreet: 1,
  handCards: [],
  currentStreetCardIds: new Set(),
  streetStartBoardCounts: { top: 0, middle: 0, bottom: 0 },
  dealtByStreet: {},
  discardedByStreet: {},
  lockedStreetCards: new Set(),
  discardMode: false,
  message: "",
  statusType: "info",
  handFinished: false,
  result: null,
};

function createDeck() {
  const deck = [];
  let cardId = 1;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}-${cardId++}`, rank, suit, code: `${rank}${suit}` });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealCards(count) {
  const dealt = state.deck.splice(0, count);
  return dealt;
}

function resetHand() {
  state.deck = createDeck();
  shuffleDeck(state.deck);
  state.board = { top: [], middle: [], bottom: [] };
  state.currentStreet = 1;
  state.handCards = [];
  state.currentStreetCardIds = new Set();
  state.streetStartBoardCounts = { top: 0, middle: 0, bottom: 0 };
  state.dealtByStreet = {};
  state.discardedByStreet = {};
  state.lockedStreetCards = new Set();
  state.discardMode = false;
  state.message = "New hand started. Street 1: Place all 5 cards.";
  state.statusType = "info";
  state.handFinished = false;
  state.result = null;
  startStreet(1);
}

function startStreet(streetNumber) {
  const requirement = STREET_REQUIREMENTS[streetNumber];
  const dealt = dealCards(requirement.deal);

  state.currentStreet = streetNumber;
  state.handCards = dealt;
  state.currentStreetCardIds = new Set(dealt.map((card) => card.id));
  state.streetStartBoardCounts = {
    top: state.board.top.length,
    middle: state.board.middle.length,
    bottom: state.board.bottom.length,
  };
  state.dealtByStreet[streetNumber] = dealt.map((card) => card.code);
  state.discardedByStreet[streetNumber] = [];
  state.discardMode = false;
}

function getCardColorClass(card) {
  return card.suit === "♥" || card.suit === "♦" ? "red" : "black";
}

function canDragCard(cardId) {
  return !state.handFinished && state.currentStreetCardIds.has(cardId);
}

function findCardInRow(rowKey, cardId) {
  const row = state.board[rowKey];
  return row.findIndex((card) => card.id === cardId);
}

function moveHandCardToRow(cardId, rowKey) {
  const row = state.board[rowKey];
  if (!row) {
    return;
  }

  if (row.length >= ROWS[rowKey].max) {
    setStatus(`${ROWS[rowKey].label} row is full.`, "error");
    draw();
    return;
  }

  const handIndex = state.handCards.findIndex((card) => card.id === cardId);
  if (handIndex < 0) {
    return;
  }

  const [card] = state.handCards.splice(handIndex, 1);
  row.push(card);
  draw();
}

function moveRowCard(cardId, destinationRowKey) {
  const destination = state.board[destinationRowKey];
  if (!destination) {
    return;
  }

  let sourceRowKey = null;
  let sourceIndex = -1;

  for (const key of Object.keys(state.board)) {
    const idx = findCardInRow(key, cardId);
    if (idx >= 0) {
      sourceRowKey = key;
      sourceIndex = idx;
      break;
    }
  }

  if (!sourceRowKey) {
    return;
  }

  if (sourceRowKey !== destinationRowKey && destination.length >= ROWS[destinationRowKey].max) {
    setStatus(`${ROWS[destinationRowKey].label} row is full.`, "error");
    draw();
    return;
  }

  const [card] = state.board[sourceRowKey].splice(sourceIndex, 1);
  destination.push(card);
  draw();
}

function moveRowCardBackToHand(cardId) {
  for (const key of Object.keys(state.board)) {
    const index = findCardInRow(key, cardId);
    if (index >= 0) {
      const [card] = state.board[key].splice(index, 1);
      state.handCards.push(card);
      draw();
      return;
    }
  }
}

function discardCurrentStreetCard(cardId) {
  if (!state.currentStreetCardIds.has(cardId)) {
    return;
  }

  const fromHandIndex = state.handCards.findIndex((card) => card.id === cardId);
  if (fromHandIndex >= 0) {
    const [card] = state.handCards.splice(fromHandIndex, 1);
    state.discardedByStreet[state.currentStreet].push(card.code);
    state.currentStreetCardIds.delete(card.id);
    draw();
    return;
  }

  for (const key of Object.keys(state.board)) {
    const rowIndex = findCardInRow(key, cardId);
    if (rowIndex >= 0) {
      const [card] = state.board[key].splice(rowIndex, 1);
      state.discardedByStreet[state.currentStreet].push(card.code);
      state.currentStreetCardIds.delete(card.id);
      draw();
      return;
    }
  }
}

function setStatus(message, type = "info") {
  state.message = message;
  state.statusType = type;
}

function getStreetProgress() {
  const placedNow =
    state.board.top.length + state.board.middle.length + state.board.bottom.length -
    state.streetStartBoardCounts.top -
    state.streetStartBoardCounts.middle -
    state.streetStartBoardCounts.bottom;
  const discardedNow = state.discardedByStreet[state.currentStreet].length;
  return { placedNow, discardedNow };
}

function validateStreetCompletion() {
  const requirement = STREET_REQUIREMENTS[state.currentStreet];
  const { placedNow, discardedNow } = getStreetProgress();

  if (placedNow !== requirement.place || discardedNow !== requirement.discard) {
    return {
      ok: false,
      message: `Street ${state.currentStreet} needs: ${requirement.text}. Current: placed ${placedNow}, discarded ${discardedNow}.`,
    };
  }

  if (state.currentStreet < 5 && state.handCards.length !== 0) {
    return {
      ok: false,
      message: `Street ${state.currentStreet} still has undeclared cards in hand.`,
    };
  }

  return { ok: true, message: "" };
}

function lockCurrentStreetCards() {
  for (const cardId of state.currentStreetCardIds) {
    state.lockedStreetCards.add(cardId);
  }
  state.currentStreetCardIds = new Set();
}

function onDoneStreet() {
  if (state.handFinished) {
    return;
  }

  const validation = validateStreetCompletion();
  if (!validation.ok) {
    setStatus(validation.message, "error");
    draw();
    return;
  }

  lockCurrentStreetCards();

  if (state.currentStreet === 5) {
    if (!isBoardComplete()) {
      setStatus("Hand cannot end: board is not complete (13 cards).", "error");
      draw();
      return;
    }

    state.handFinished = true;
    state.handCards = [];
    state.result = evaluateFinalResult();
    setStatus("Hand complete.", "success");
    draw();
    return;
  }

  const nextStreet = state.currentStreet + 1;
  startStreet(nextStreet);
  setStatus(`Advanced to Street ${nextStreet}. Requirement: ${STREET_REQUIREMENTS[nextStreet].text}.`, "success");
  draw();
}

function isBoardComplete() {
  return (
    state.board.top.length === ROWS.top.max &&
    state.board.middle.length === ROWS.middle.max &&
    state.board.bottom.length === ROWS.bottom.max
  );
}

function parseCard(card) {
  return { rank: card.rank, suit: card.suit, value: RANK_VALUE[card.rank] };
}

function compareValueArraysDescending(aValues, bValues) {
  const maxLength = Math.max(aValues.length, bValues.length);
  for (let i = 0; i < maxLength; i += 1) {
    const a = aValues[i] || 0;
    const b = bValues[i] || 0;
    if (a !== b) {
      return a - b;
    }
  }
  return 0;
}

function evaluateFiveCardHand(cards) {
  const parsed = cards.map(parseCard);
  const counts = new Map();
  const suits = new Map();

  parsed.forEach((card) => {
    counts.set(card.value, (counts.get(card.value) || 0) + 1);
    suits.set(card.suit, (suits.get(card.suit) || 0) + 1);
  });

  const valuesDesc = [...counts.keys()].sort((a, b) => b - a);
  const valueCounts = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isFlush = suits.size === 1;
  const sortedUniqueAsc = [...counts.keys()].sort((a, b) => a - b);
  let isStraight = false;
  let straightHigh = 0;

  if (sortedUniqueAsc.length === 5) {
    const isWheel = sortedUniqueAsc.join(",") === "2,3,4,5,14";
    if (isWheel) {
      isStraight = true;
      straightHigh = 5;
    } else if (sortedUniqueAsc[4] - sortedUniqueAsc[0] === 4) {
      isStraight = true;
      straightHigh = sortedUniqueAsc[4];
    }
  }

  if (isStraight && isFlush) {
    return { rankClass: 8, rankName: "Straight Flush", tiebreak: [straightHigh] };
  }

  if (valueCounts[0][1] === 4) {
    const quadValue = valueCounts[0][0];
    const kicker = valueCounts[1][0];
    return { rankClass: 7, rankName: "Four of a Kind", tiebreak: [quadValue, kicker] };
  }

  if (valueCounts[0][1] === 3 && valueCounts[1][1] === 2) {
    return { rankClass: 6, rankName: "Full House", tiebreak: [valueCounts[0][0], valueCounts[1][0]] };
  }

  if (isFlush) {
    return { rankClass: 5, rankName: "Flush", tiebreak: valuesDesc };
  }

  if (isStraight) {
    return { rankClass: 4, rankName: "Straight", tiebreak: [straightHigh] };
  }

  if (valueCounts[0][1] === 3) {
    const trips = valueCounts[0][0];
    const kickers = valueCounts.slice(1).map(([value]) => value).sort((a, b) => b - a);
    return { rankClass: 3, rankName: "Three of a Kind", tiebreak: [trips, ...kickers] };
  }

  if (valueCounts[0][1] === 2 && valueCounts[1][1] === 2) {
    const pairValues = valueCounts
      .filter(([, count]) => count === 2)
      .map(([value]) => value)
      .sort((a, b) => b - a);
    const kicker = valueCounts.find(([, count]) => count === 1)[0];
    return { rankClass: 2, rankName: "Two Pair", tiebreak: [...pairValues, kicker] };
  }

  if (valueCounts[0][1] === 2) {
    const pair = valueCounts[0][0];
    const kickers = valueCounts.slice(1).map(([value]) => value).sort((a, b) => b - a);
    return { rankClass: 1, rankName: "One Pair", tiebreak: [pair, ...kickers] };
  }

  return { rankClass: 0, rankName: "High Card", tiebreak: valuesDesc };
}

function evaluateThreeCardTop(cards) {
  const parsed = cards.map(parseCard);
  const counts = new Map();

  parsed.forEach((card) => {
    counts.set(card.value, (counts.get(card.value) || 0) + 1);
  });

  const valueCounts = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const highToLow = parsed.map((c) => c.value).sort((a, b) => b - a);

  if (valueCounts[0][1] === 3) {
    return { rankClass: 3, rankName: "Three of a Kind", tiebreak: [valueCounts[0][0]] };
  }

  if (valueCounts[0][1] === 2) {
    const pair = valueCounts[0][0];
    const kicker = valueCounts.find(([, count]) => count === 1)[0];
    return { rankClass: 1, rankName: "One Pair", tiebreak: [pair, kicker] };
  }

  return { rankClass: 0, rankName: "High Card", tiebreak: highToLow };
}

function compareHands(a, b) {
  if (a.rankClass !== b.rankClass) {
    return a.rankClass - b.rankClass;
  }
  return compareValueArraysDescending(a.tiebreak, b.tiebreak);
}

function computeTopRoyalties(topEvaluation) {
  if (topEvaluation.rankName === "Three of a Kind") {
    return topEvaluation.tiebreak[0] + 8;
  }

  if (topEvaluation.rankName === "One Pair" && topEvaluation.tiebreak[0] >= 6) {
    return topEvaluation.tiebreak[0] - 5;
  }

  return 0;
}

function computeMiddleRoyalties(middleEvaluation) {
  switch (middleEvaluation.rankName) {
    case "Three of a Kind":
      return 2;
    case "Straight":
      return 4;
    case "Flush":
      return 8;
    case "Full House":
      return 12;
    case "Four of a Kind":
      return 20;
    case "Straight Flush":
      return 30;
    default:
      return 0;
  }
}

function computeBottomRoyalties(bottomEvaluation) {
  switch (bottomEvaluation.rankName) {
    case "Straight":
      return 2;
    case "Flush":
      return 4;
    case "Full House":
      return 6;
    case "Four of a Kind":
      return 10;
    case "Straight Flush":
      return 15;
    default:
      return 0;
  }
}

function evaluateFinalResult() {
  const topEval = evaluateThreeCardTop(state.board.top);
  const middleEval = evaluateFiveCardHand(state.board.middle);
  const bottomEval = evaluateFiveCardHand(state.board.bottom);

  const bottomVsMiddle = compareHands(bottomEval, middleEval);
  const middleVsTop = compareHands(middleEval, topEval);
  const fouled = bottomVsMiddle < 0 || middleVsTop < 0;

  if (fouled) {
    return {
      fouled: true,
      top: { evaluation: topEval, royalty: 0 },
      middle: { evaluation: middleEval, royalty: 0 },
      bottom: { evaluation: bottomEval, royalty: 0 },
      total: 0,
    };
  }

  const topRoyalty = computeTopRoyalties(topEval);
  const middleRoyalty = computeMiddleRoyalties(middleEval);
  const bottomRoyalty = computeBottomRoyalties(bottomEval);

  return {
    fouled: false,
    top: { evaluation: topEval, royalty: topRoyalty },
    middle: { evaluation: middleEval, royalty: middleRoyalty },
    bottom: { evaluation: bottomEval, royalty: bottomRoyalty },
    total: topRoyalty + middleRoyalty + bottomRoyalty,
  };
}

function renderCard(card, source, rowKey = "") {
  const draggable = canDragCard(card.id);
  return `
    <button
      class="card ${getCardColorClass(card)} ${draggable ? "draggable" : "locked-card"}"
      data-card-id="${card.id}"
      data-drag-source="${source}"
      data-row="${rowKey}"
      draggable="${draggable}"
      type="button"
      title="${card.code}"
    >${card.code}</button>
  `;
}

function renderRow(rowKey) {
  const cards = state.board[rowKey]
    .map((card) => renderCard(card, "row", rowKey))
    .join("");

  return `
    <section class="row" data-row="${rowKey}">
      <header>
        <h3>${ROWS[rowKey].label} (${state.board[rowKey].length}/${ROWS[rowKey].max})</h3>
      </header>
      <div class="row-cards">${cards}</div>
    </section>
  `;
}

function renderResult() {
  if (!state.result) {
    return "";
  }

  return `
    <section class="result-panel">
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
  const lines = [];
  for (let street = 1; street <= 5; street += 1) {
    if (!state.dealtByStreet[street]) {
      continue;
    }
    const dealt = state.dealtByStreet[street].join(" ");
    const discarded = state.discardedByStreet[street] && state.discardedByStreet[street].length
      ? state.discardedByStreet[street].join(" ")
      : "-";
    lines.push(`<li>Street ${street}: Dealt [${dealt}] | Discarded [${discarded}]</li>`);
  }
  return `<ul>${lines.join("")}</ul>`;
}

function draw() {
  const requirement = STREET_REQUIREMENTS[state.currentStreet];
  const progress = getStreetProgress();

  app.innerHTML = `
    <main class="layout">
      <section class="panel controls-panel">
        <div class="control-row">
          <button id="new-hand" type="button">New Hand</button>
          <button id="done-street" type="button" ${state.handFinished ? "disabled" : ""}>Done</button>
          <label class="toggle-wrap">
            <input id="discard-mode" type="checkbox" ${state.discardMode ? "checked" : ""} ${state.handFinished ? "disabled" : ""}/>
            Discard mode (click card)
          </label>
        </div>
        <p class="street-title">Street ${state.currentStreet} / 5</p>
        <p class="street-requirement">Requirement: ${requirement.text}</p>
        <p class="street-progress">Placed this street: ${progress.placedNow}/${requirement.place} | Discarded: ${progress.discardedNow}/${requirement.discard}</p>
        <p class="status ${state.statusType}">${state.message}</p>
      </section>

      <section class="panel hand-panel">
        <h2>Current Street Cards</h2>
        <div class="hand-zone" data-drop-zone="hand">
          ${state.handCards.map((card) => renderCard(card, "hand")).join("")}
        </div>
        <div class="discard-zone" data-drop-zone="discard">
          <strong>Discard Area</strong>
          <p>Drop one current-street card here (streets 2-5).</p>
        </div>
      </section>

      <section class="panel board-panel">
        <h2>Board</h2>
        ${renderRow("top")}
        ${renderRow("middle")}
        ${renderRow("bottom")}
      </section>

      ${renderResult()}

      <section class="panel history-panel">
        <h2>Street History</h2>
        ${renderStreetHistory()}
      </section>

      <section class="panel rules-panel">
        <h2>Rules (current)</h2>
        <p>Foul rule: bottom row must be >= middle row >= top row by hand strength. Fouled hands score 0 royalties.</p>
        <h3>Royalties</h3>
        <p><strong>Top (3 cards)</strong>: Pair 66=1, 77=2, 88=3, 99=4, TT=5, JJ=6, QQ=7, KK=8, AA=9. Trips: 222=10 ... AAA=22.</p>
        <p><strong>Middle (5 cards)</strong>: Trips=2, Straight=4, Flush=8, Full House=12, Quads=20, Straight Flush=30.</p>
        <p><strong>Bottom (5 cards)</strong>: Straight=2, Flush=4, Full House=6, Quads=10, Straight Flush=15.</p>
      </section>
    </main>
  `;

  bindEvents();
  setupDragAndDrop();
}

function bindEvents() {
  document.getElementById("new-hand").addEventListener("click", resetHand);
  document.getElementById("done-street").addEventListener("click", onDoneStreet);
  document.getElementById("discard-mode").addEventListener("change", (event) => {
    state.discardMode = event.target.checked;
  });

  document.querySelectorAll(".card").forEach((cardButton) => {
    cardButton.addEventListener("click", () => {
      const cardId = cardButton.dataset.cardId;
      if (state.discardMode && canDragCard(cardId) && !state.handFinished) {
        discardCurrentStreetCard(cardId);
      }
    });
  });
}

function parseDragPayload(event) {
  const raw = event.dataTransfer.getData("text/plain");
  try {
    return JSON.parse(raw || "{}");
  } catch (error) {
    return {};
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

      if (!payload.cardId || !canDragCard(payload.cardId)) {
        return;
      }

      const destinationRow = rowZone.dataset.row;
      if (payload.source === "hand") {
        moveHandCardToRow(payload.cardId, destinationRow);
      } else if (payload.source === "row") {
        moveRowCard(payload.cardId, destinationRow);
      }
    });
  });

  const handZone = document.querySelector("[data-drop-zone='hand']");
  setupDropZoneVisuals(handZone);
  handZone.addEventListener("drop", (event) => {
    event.preventDefault();
    handZone.classList.remove("drop-active");
    const payload = parseDragPayload(event);

    if (!payload.cardId || payload.source !== "row" || !canDragCard(payload.cardId)) {
      return;
    }

    moveRowCardBackToHand(payload.cardId);
  });

  const discardZone = document.querySelector("[data-drop-zone='discard']");
  setupDropZoneVisuals(discardZone);
  discardZone.addEventListener("drop", (event) => {
    event.preventDefault();
    discardZone.classList.remove("drop-active");
    const payload = parseDragPayload(event);

    if (!payload.cardId || !canDragCard(payload.cardId)) {
      return;
    }

    discardCurrentStreetCard(payload.cardId);
  });
}

resetHand();
draw();
