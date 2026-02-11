import {
  compareHands,
  evaluateFiveCardHand,
  evaluateThreeCardTop,
  getFantasylandQualification,
} from "./evaluator.js";
import { computeRoyalties } from "./royalties.js";
import { chooseMove } from "./bot.js";
import { RANKS, ROWS, STREET_REQUIREMENTS, SUITS } from "./state.js";

function setStatus(state, message, type = "info") {
  state.message = message;
  state.statusType = type;
}

function getPlacedCardCount(state) {
  return state.board.top.length + state.board.middle.length + state.board.bottom.length;
}

function prepareHandState(state) {
  state.board = { top: [], middle: [], bottom: [] };
  state.opponentBoard = { top: [], middle: [], bottom: [] };
  state.currentStreet = 1;
  state.handCards = [];
  state.opponentHandCards = [];
  state.currentStreetCardIds = new Set();
  state.streetStartBoardCounts = { top: 0, middle: 0, bottom: 0 };
  state.dealtByStreet = {};
  state.discardedByStreet = {};
  state.opponentDealtByStreet = {};
  state.opponentDiscardedByStreet = {};
  state.lockedStreetCards = new Set();
  state.handFinished = false;
  state.result = null;
  state.burnedCards = [];
  state.opponentBurnedCards = [];
  state.opponentLog = "";
  state.isFantasyland = false;
  state.fantasylandCardCount = 13;
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
}

function startFantasylandHand(state, cardCount, target = "human") {
  state.isFantasyland = true;
  state.fantasylandCardCount = cardCount;
  state.currentStreet = 1;

  const dealt = dealCards(state, cardCount);

  if (target === "opponent") {
    state.opponentHandCards = dealt;
    state.opponentDealtByStreet = { fantasyland: dealt.map((card) => card.code) };
    state.opponentDiscardedByStreet = {};
    return;
  }

  state.handCards = dealt;
  state.currentStreetCardIds = new Set(dealt.map((card) => card.id));
  state.streetStartBoardCounts = { top: 0, middle: 0, bottom: 0 };
  state.dealtByStreet = { fantasyland: dealt.map((card) => card.code) };
  state.discardedByStreet = {};

  setStatus(state, `Fantasyland! Arrange all cards freely (${cardCount} dealt).`, "success");
}

function startOpponentStreet(state, streetNumber) {
  const requirement = STREET_REQUIREMENTS[streetNumber];
  const dealt = dealCards(state, requirement.deal);
  state.opponentHandCards = dealt;
  state.opponentDealtByStreet[streetNumber] = dealt.map((card) => card.code);
  state.opponentDiscardedByStreet[streetNumber] = [];
}

function applyOpponentMove(state, move) {
  const handById = new Map(state.opponentHandCards.map((card) => [card.id, card]));

  for (const placement of move.placements) {
    const card = handById.get(placement.cardId);
    if (!card) {
      continue;
    }
    if (state.opponentBoard[placement.rowKey].length >= ROWS[placement.rowKey].max) {
      continue;
    }
    state.opponentBoard[placement.rowKey].push(card);
    handById.delete(placement.cardId);
  }

  for (const burnId of move.burnCardIds) {
    const burnCard = handById.get(burnId);
    if (!burnCard) {
      continue;
    }
    if (state.isFantasyland) {
      state.opponentBurnedCards.push(burnCard.code);
    } else {
      state.opponentDiscardedByStreet[state.currentStreet].push(burnCard.code);
    }
    handById.delete(burnId);
  }

  state.opponentHandCards = [...handById.values()];
}

function autoPlayOpponentStreet(state) {
  if (!state.playVsComputer || state.handFinished) {
    return;
  }

  if (state.isFantasyland) {
    const move = chooseMove(state, "opponent");
    applyOpponentMove(state, move);
    state.opponentLog = "Opponent played Fantasyland.";
    return;
  }

  startOpponentStreet(state, state.currentStreet);
  const move = chooseMove(state, "opponent");
  applyOpponentMove(state, move);
  state.opponentLog = `Opponent played Street ${state.currentStreet}.`;
}

export function runBotRegressionChecks() {
  const sim = {
    deck: createDeck(),
    board: { top: [], middle: [], bottom: [] },
    opponentBoard: { top: [], middle: [], bottom: [] },
    currentStreet: 1,
    handCards: [],
    opponentHandCards: [],
    currentStreetCardIds: new Set(),
    streetStartBoardCounts: { top: 0, middle: 0, bottom: 0 },
    dealtByStreet: {},
    discardedByStreet: {},
    opponentDealtByStreet: {},
    opponentDiscardedByStreet: {},
    lockedStreetCards: new Set(),
    isFantasyland: false,
    fantasylandCardCount: 13,
    fantasylandEligibleNextHand: false,
    fantasylandBlockedNextHand: false,
    burnedCards: [],
    opponentBurnedCards: [],
    message: "",
    statusType: "info",
    handFinished: false,
    result: null,
    playVsComputer: true,
    opponentLog: "",
  };
  shuffleDeck(sim.deck);

  for (let street = 1; street <= 5; street += 1) {
    sim.currentStreet = street;
    startOpponentStreet(sim, street);
    const move = chooseMove(sim, "opponent");
    applyOpponentMove(sim, move);
    console.assert(sim.opponentHandCards.length === 0, `Bot left unresolved cards on street ${street}`);
  }

  console.assert(sim.opponentBoard.top.length <= ROWS.top.max, "Bot overflowed top row");
  console.assert(sim.opponentBoard.middle.length <= ROWS.middle.max, "Bot overflowed middle row");
  console.assert(sim.opponentBoard.bottom.length <= ROWS.bottom.max, "Bot overflowed bottom row");
  const completed =
    sim.opponentBoard.top.length === ROWS.top.max &&
    sim.opponentBoard.middle.length === ROWS.middle.max &&
    sim.opponentBoard.bottom.length === ROWS.bottom.max;
  console.assert(completed, "Bot did not complete board across 5 streets");
}

export function startHand(state) {
  const shouldStartBlockedHand = state.fantasylandBlockedNextHand;
  const hasFantasylandTicket = state.fantasylandEligibleNextHand;
  const ticketCardCount = state.fantasylandCardCount;

  prepareHandState(state);
  state.deck = createDeck();
  shuffleDeck(state.deck);

  if (shouldStartBlockedHand) {
    state.fantasylandBlockedNextHand = false;
    state.fantasylandEligibleNextHand = false;
    state.fantasylandCardCount = 13;
    startStreet(state, 1);
    setStatus(state, "Fantasyland cannot happen two hands in a row. Street 1: Place all 5 cards.", "info");
    return;
  }

  if (hasFantasylandTicket) {
    state.fantasylandEligibleNextHand = false;
    startFantasylandHand(state, ticketCardCount);
    if (state.playVsComputer) {
      startFantasylandHand(state, 13, "opponent");
      const move = chooseMove(state, "opponent");
      applyOpponentMove(state, move);
      state.opponentLog = "Opponent played Fantasyland.";
    }
    return;
  }

  startStreet(state, 1);
  setStatus(state, "New hand started. Street 1: Place all 5 cards.", "info");
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

function resolveAutoDiscard(state) {
  const requirement = STREET_REQUIREMENTS[state.currentStreet];
  if (requirement.discard === 0) {
    return;
  }

  if (state.handCards.length !== requirement.discard) {
    return;
  }

  const [card] = state.handCards.splice(0, 1);
  state.discardedByStreet[state.currentStreet].push(card.code);
  state.currentStreetCardIds.delete(card.id);
}

export function getStreetProgress(state) {
  if (state.isFantasyland) {
    return {
      placedNow: getPlacedCardCount(state),
      discardedNow: state.burnedCards.length,
    };
  }

  const placedNow =
    getPlacedCardCount(state) -
    state.streetStartBoardCounts.top -
    state.streetStartBoardCounts.middle -
    state.streetStartBoardCounts.bottom;
  const discardedNow = (state.discardedByStreet[state.currentStreet] || []).length;
  return { placedNow, discardedNow };
}

export function canAdvanceStreet(state) {
  if (state.isFantasyland) {
    if (!isBoardComplete(state)) {
      return {
        ok: false,
        message: "Fantasyland requires a complete board (13 placed cards).",
      };
    }

    return { ok: true, message: "" };
  }

  const requirement = STREET_REQUIREMENTS[state.currentStreet];
  const { placedNow } = getStreetProgress(state);

  if (placedNow !== requirement.place) {
    return {
      ok: false,
      message: `Street ${state.currentStreet} needs: ${requirement.text}. Current: placed ${placedNow}.`,
    };
  }

  if (state.handCards.length !== requirement.discard) {
    return {
      ok: false,
      message: `Street ${state.currentStreet} still has ${state.handCards.length} card(s) in hand; expected ${requirement.discard} before auto-discard.`,
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

function finalizeFantasylandOutcome(state, fouled) {
  const qualification = getFantasylandQualification(state.board, fouled);

  if (state.isFantasyland) {
    state.fantasylandBlockedNextHand = true;
    state.fantasylandEligibleNextHand = false;
    if (qualification.eligible) {
      setStatus(state, "Hand complete. Fantasyland cannot happen two hands in a row.", "info");
      return;
    }
    setStatus(state, "Hand complete.", "success");
    return;
  }

  if (qualification.eligible) {
    state.fantasylandEligibleNextHand = true;
    state.fantasylandCardCount = qualification.cards;
    setStatus(state, `Hand complete. Qualified for Fantasyland next hand (${qualification.cards} cards).`, "success");
    return;
  }

  state.fantasylandEligibleNextHand = false;
  state.fantasylandCardCount = 13;
  setStatus(state, "Hand complete.", "success");
}

function finishHand(state) {
  state.handFinished = true;
  state.result = evaluateFinalResult(state);
  const fouled = state.result.fouled;
  finalizeFantasylandOutcome(state, fouled);
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

  if (state.isFantasyland) {
    state.burnedCards = state.handCards.map((card) => card.code);
    state.handCards = [];
    state.currentStreetCardIds = new Set();
    finishHand(state);
    return;
  }

  resolveAutoDiscard(state);
  lockStreet(state);
  autoPlayOpponentStreet(state);

  if (state.currentStreet === 5) {
    if (!isBoardComplete(state)) {
      setStatus(state, "Hand cannot end: board is not complete (13 cards).", "error");
      return;
    }

    state.handCards = [];
    finishHand(state);
    return;
  }

  advanceStreet(state);
}

function createCard(rank, suit, idx) {
  return { id: `${rank}${suit}-${idx}`, rank, suit, code: `${rank}${suit}` };
}

function createStateFromRows(top, middle, bottom) {
  return { board: { top, middle, bottom } };
}

export function runFantasylandRegressionChecks() {
  const sampleMiddle = [
    createCard("9", "♠", 1),
    createCard("9", "♥", 2),
    createCard("9", "♦", 3),
    createCard("3", "♠", 4),
    createCard("3", "♥", 5),
  ];
  const sampleBottom = [
    createCard("2", "♣", 6),
    createCard("5", "♣", 7),
    createCard("7", "♣", 8),
    createCard("9", "♣", 9),
    createCard("J", "♣", 10),
  ];

  const qqTop = [createCard("Q", "♠", 11), createCard("Q", "♥", 12), createCard("2", "♦", 13)];
  const kkTop = [createCard("K", "♠", 14), createCard("K", "♥", 15), createCard("2", "♦", 16)];
  const aaTop = [createCard("A", "♠", 17), createCard("A", "♥", 18), createCard("2", "♦", 19)];
  const tripsTop = [createCard("7", "♠", 20), createCard("7", "♥", 21), createCard("7", "♦", 22)];

  const qqResult = getFantasylandQualification(createStateFromRows(qqTop, sampleMiddle, sampleBottom).board, false);
  console.assert(qqResult.eligible && qqResult.cards === 13, "Expected QQ top to grant 13-card Fantasyland");

  const kkResult = getFantasylandQualification(createStateFromRows(kkTop, sampleMiddle, sampleBottom).board, false);
  console.assert(kkResult.eligible && kkResult.cards === 14, "Expected KK top to grant 14-card Fantasyland");

  const aaResult = getFantasylandQualification(createStateFromRows(aaTop, sampleMiddle, sampleBottom).board, false);
  console.assert(aaResult.eligible && aaResult.cards === 15, "Expected AA top to grant 15-card Fantasyland");

  const tripsResult = getFantasylandQualification(createStateFromRows(tripsTop, sampleMiddle, sampleBottom).board, false);
  console.assert(tripsResult.eligible && tripsResult.cards === 16, "Expected trips top to grant 16-card Fantasyland");

  const simState = {
    deck: [],
    board: { top: [], middle: [], bottom: [] },
    currentStreet: 1,
    handCards: [],
    currentStreetCardIds: new Set(),
    streetStartBoardCounts: { top: 0, middle: 0, bottom: 0 },
    dealtByStreet: {},
    discardedByStreet: {},
    lockedStreetCards: new Set(),
    isFantasyland: false,
    fantasylandCardCount: 16,
    fantasylandEligibleNextHand: true,
    fantasylandBlockedNextHand: true,
    burnedCards: [],
    message: "",
    statusType: "info",
    handFinished: false,
    result: null,
  };
  startHand(simState);
  console.assert(!simState.isFantasyland, "Expected no consecutive Fantasyland hand");
}
