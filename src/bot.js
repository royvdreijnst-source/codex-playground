import { evaluateFiveCardHand, evaluateThreeCardTop } from "./evaluator.js";
import { RANK_VALUE, ROWS, STREET_REQUIREMENTS } from "./state.js";

function getRowStrength(rowKey, cards) {
  if (!cards.length) {
    return 0;
  }

  if (rowKey === "top") {
    const rankCounts = new Map();
    for (const card of cards) {
      rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1);
    }

    const countValues = [...rankCounts.values()].sort((a, b) => b - a);
    const highCardValue = Math.max(...cards.map((card) => RANK_VALUE[card.rank]));

    if (cards.length === 3) {
      const evaluation = evaluateThreeCardTop(cards);
      return evaluation.rank * 100 + evaluation.tiebreak[0];
    }

    if (countValues[0] === 2) {
      return 80 + highCardValue;
    }

    return 20 + cards.reduce((sum, card) => sum + RANK_VALUE[card.rank], 0) / 10;
  }

  if (cards.length === 5) {
    const evaluation = evaluateFiveCardHand(cards);
    return evaluation.rank * 100 + evaluation.tiebreak[0];
  }

  return cards.reduce((sum, card) => sum + RANK_VALUE[card.rank], 0);
}

function getVisibleRankCounts(state, playerId, handCards) {
  const otherBoard = playerId === "opponent" ? state.board : state.opponentBoard;
  const thisBoard = playerId === "opponent" ? state.opponentBoard : state.board;
  const counts = new Map();

  const allVisibleCards = [
    ...thisBoard.top,
    ...thisBoard.middle,
    ...thisBoard.bottom,
    ...otherBoard.top,
    ...otherBoard.middle,
    ...otherBoard.bottom,
  ];

  for (const card of allVisibleCards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }

  for (const card of handCards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) - 1);
  }

  return counts;
}

function scorePlacement(board, rowKey, card, visibleRankCounts) {
  const row = board[rowKey];
  if (row.length >= ROWS[rowKey].max) {
    return Number.NEGATIVE_INFINITY;
  }

  const cardValue = RANK_VALUE[card.rank];
  let score = rowKey === "bottom" ? 30 : rowKey === "middle" ? 20 : 8;

  if (rowKey === "bottom") {
    score += cardValue * 1.25;
  } else if (rowKey === "middle") {
    score += cardValue * 0.8;
  } else {
    score -= cardValue * 1.4;
    if (cardValue >= 11) {
      score -= 8;
    }
  }

  const trialBoard = {
    top: [...board.top],
    middle: [...board.middle],
    bottom: [...board.bottom],
  };
  trialBoard[rowKey].push(card);

  const topStrength = getRowStrength("top", trialBoard.top);
  const middleStrength = getRowStrength("middle", trialBoard.middle);
  const bottomStrength = getRowStrength("bottom", trialBoard.bottom);

  if (topStrength > middleStrength + 8) {
    score -= 45;
  }
  if (middleStrength > bottomStrength + 8) {
    score -= 45;
  }

  const rankAlreadyInRow = row.some((existing) => existing.rank === card.rank);
  const visibleCount = visibleRankCounts.get(card.rank) || 0;
  const remainingUnseen = Math.max(0, 4 - visibleCount - 1);
  if (rankAlreadyInRow) {
    score += rowKey === "top" ? remainingUnseen * 3.5 : remainingUnseen * 2;
  } else if (remainingUnseen === 0) {
    score -= rowKey === "top" ? 9 : 5;
  }

  return score;
}

function pickBurnCards(cards, burnCount) {
  if (burnCount <= 0) {
    return [];
  }

  return [...cards]
    .sort((a, b) => RANK_VALUE[a.rank] - RANK_VALUE[b.rank])
    .slice(0, burnCount)
    .map((card) => card.id);
}

export function chooseMove(state, playerId = "opponent") {
  const board = playerId === "opponent" ? state.opponentBoard : state.board;
  const handCards = playerId === "opponent" ? state.opponentHandCards : state.handCards;
  const street = state.currentStreet;
  const requirement = STREET_REQUIREMENTS[street] || { place: 0 };

  const openSlots =
    (ROWS.top.max - board.top.length) +
    (ROWS.middle.max - board.middle.length) +
    (ROWS.bottom.max - board.bottom.length);

  const placeCount = state.isFantasyland
    ? Math.min(openSlots, handCards.length)
    : Math.min(requirement.place, handCards.length);

  const burnCount = Math.max(0, handCards.length - placeCount);
  const burnCardIds = pickBurnCards(handCards, burnCount);
  const burnSet = new Set(burnCardIds);

  const cardsToPlace = handCards
    .filter((card) => !burnSet.has(card.id))
    .sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  const visibleRankCounts = getVisibleRankCounts(state, playerId, handCards);

  const placements = [];
  const trialBoard = {
    top: [...board.top],
    middle: [...board.middle],
    bottom: [...board.bottom],
  };

  for (const card of cardsToPlace) {
    let bestRow = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const rowKey of ["bottom", "middle", "top"]) {
      const score = scorePlacement(trialBoard, rowKey, card, visibleRankCounts);
      if (score > bestScore) {
        bestScore = score;
        bestRow = rowKey;
      }
    }

    if (!bestRow) {
      continue;
    }

    trialBoard[bestRow].push(card);
    placements.push({ cardId: card.id, rowKey: bestRow });
  }

  return {
    placements,
    burnCardIds,
  };
}
