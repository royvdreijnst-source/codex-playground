import { compareHands, evaluateFiveCardHand, evaluateThreeCardTop } from "./evaluator.js";
import { computeRoyalties } from "./royalties.js";
import { RANKS, ROWS, STREET_REQUIREMENTS, SUITS } from "./state.js";

function setStatus(state, message, type = "info") {
  state.message = message;
  state.statusType = type;
}

export function createDeck() {
  const deck = [];
  let cardId = 1;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}-${cardId++}`, rank, suit, code: `${rank}${suit}` });
    }
  }
  return deck;
}

export function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealCards(state, count) {
  return state.deck.splice(0, count);
}

export function canDragCard(state, cardId) {
  return !state.handFinished && state.currentStreetCardIds.has(cardId);
}

function findCardInRow(state, rowKey, cardId) {
  const row = state.board[rowKey];
  return row.findIndex((card) => card.id === cardId);
}

export function startStreet(state, streetNumber) {
  const requirement = STREET_REQUIREMENTS[streetNumber];
  const dealt = dealCards(state, requirement.deal);

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

export function startHand(state) {
  state.deck = createDeck();
  shuffleDeck(state.deck);
  setStatus(state, "New hand started. Street 1: Place all 5 cards.", "info");
  startStreet(state, 1);
}

export function applyDropToRow(state, cardId, rowKey) {
  const row = state.board[rowKey];
  if (!row) {
    return;
  }

  if (row.length >= ROWS[rowKey].max) {
    setStatus(state, `${ROWS[rowKey].label} row is full.`, "error");
    return;
  }

  const handIndex = state.handCards.findIndex((card) => card.id === cardId);
  if (handIndex < 0) {
    return;
  }

  const [card] = state.handCards.splice(handIndex, 1);
  row.push(card);
}

export function applyMoveRowCard(state, cardId, destinationRowKey) {
  const destination = state.board[destinationRowKey];
  if (!destination) {
    return;
  }

  let sourceRowKey = null;
  let sourceIndex = -1;

  for (const key of Object.keys(state.board)) {
    const idx = findCardInRow(state, key, cardId);
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
    setStatus(state, `${ROWS[destinationRowKey].label} row is full.`, "error");
    return;
  }

  const [card] = state.board[sourceRowKey].splice(sourceIndex, 1);
  destination.push(card);
}

export function applyMoveRowCardBackToHand(state, cardId) {
  for (const key of Object.keys(state.board)) {
    const index = findCardInRow(state, key, cardId);
    if (index >= 0) {
      const [card] = state.board[key].splice(index, 1);
      state.handCards.push(card);
      return;
    }
  }
}

export function applyDiscard(state, cardId) {
  if (!state.currentStreetCardIds.has(cardId)) {
    return;
  }

  const fromHandIndex = state.handCards.findIndex((card) => card.id === cardId);
  if (fromHandIndex >= 0) {
    const [card] = state.handCards.splice(fromHandIndex, 1);
    state.discardedByStreet[state.currentStreet].push(card.code);
    state.currentStreetCardIds.delete(card.id);
    return;
  }

  for (const key of Object.keys(state.board)) {
    const rowIndex = findCardInRow(state, key, cardId);
    if (rowIndex >= 0) {
      const [card] = state.board[key].splice(rowIndex, 1);
      state.discardedByStreet[state.currentStreet].push(card.code);
      state.currentStreetCardIds.delete(card.id);
      return;
    }
  }
}

export function getStreetProgress(state) {
  const placedNow =
    state.board.top.length + state.board.middle.length + state.board.bottom.length -
    state.streetStartBoardCounts.top -
    state.streetStartBoardCounts.middle -
    state.streetStartBoardCounts.bottom;
  const discardedNow = (state.discardedByStreet[state.currentStreet] || []).length;
  return { placedNow, discardedNow };
}

export function canAdvanceStreet(state) {
  const requirement = STREET_REQUIREMENTS[state.currentStreet];
  const { placedNow, discardedNow } = getStreetProgress(state);

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

export function lockStreet(state) {
  for (const cardId of state.currentStreetCardIds) {
    state.lockedStreetCards.add(cardId);
  }
  state.currentStreetCardIds = new Set();
}

export function isBoardComplete(state) {
  return (
    state.board.top.length === ROWS.top.max &&
    state.board.middle.length === ROWS.middle.max &&
    state.board.bottom.length === ROWS.bottom.max
  );
}

export function isFouled(state) {
  const topEval = evaluateThreeCardTop(state.board.top);
  const middleEval = evaluateFiveCardHand(state.board.middle);
  const bottomEval = evaluateFiveCardHand(state.board.bottom);

  return compareHands(bottomEval, middleEval) < 0 || compareHands(middleEval, topEval) < 0;
}

export function evaluateFinalResult(state) {
  const base = computeRoyalties(state);
  if (isFouled(state)) {
    return {
      fouled: true,
      top: { evaluation: base.top.evaluation, royalty: 0 },
      middle: { evaluation: base.middle.evaluation, royalty: 0 },
      bottom: { evaluation: base.bottom.evaluation, royalty: 0 },
      total: 0,
    };
  }

  return {
    fouled: false,
    ...base,
  };
}

export function advanceStreet(state) {
  const nextStreet = state.currentStreet + 1;
  startStreet(state, nextStreet);
  setStatus(state, `Advanced to Street ${nextStreet}. Requirement: ${STREET_REQUIREMENTS[nextStreet].text}.`, "success");
}

export function doneStreet(state) {
  if (state.handFinished) {
    return;
  }

  const validation = canAdvanceStreet(state);
  if (!validation.ok) {
    setStatus(state, validation.message, "error");
    return;
  }

  lockStreet(state);

  if (state.currentStreet === 5) {
    if (!isBoardComplete(state)) {
      setStatus(state, "Hand cannot end: board is not complete (13 cards).", "error");
      return;
    }

    state.handFinished = true;
    state.handCards = [];
    state.result = evaluateFinalResult(state);
    setStatus(state, "Hand complete.", "success");
    return;
  }

  advanceStreet(state);
}

export function setDiscardMode(state, enabled) {
  state.discardMode = enabled;
}
