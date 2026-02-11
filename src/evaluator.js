import { RANK_VALUE } from "./state.js";

const CATEGORY_NAMES_5 = {
  8: "Straight Flush",
  7: "Four of a Kind",
  6: "Full House",
  5: "Flush",
  4: "Straight",
  3: "Three of a Kind",
  2: "Two Pair",
  1: "One Pair",
  0: "High Card",
};

const CATEGORY_NAMES_TOP = {
  3: "Three of a Kind",
  1: "One Pair",
  0: "High Card",
};

function parseCard(card) {
  return { rank: card.rank, suit: card.suit, value: RANK_VALUE[card.rank] };
}

function compareTiebreakers(aTiebreakers, bTiebreakers) {
  const maxLength = Math.max(aTiebreakers.length, bTiebreakers.length);
  for (let i = 0; i < maxLength; i += 1) {
    const a = aTiebreakers[i] || 0;
    const b = bTiebreakers[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function formatRank(category, categoryName, tiebreakers) {
  return {
    category,
    categoryName,
    tiebreakers,
    rankClass: category,
    rankName: categoryName,
    tiebreak: tiebreakers,
  };
}

export function evaluate5(cards) {
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
    return formatRank(8, CATEGORY_NAMES_5[8], [straightHigh]);
  }

  if (valueCounts[0][1] === 4) {
    const quadValue = valueCounts[0][0];
    const kicker = valueCounts[1][0];
    return formatRank(7, CATEGORY_NAMES_5[7], [quadValue, kicker]);
  }

  if (valueCounts[0][1] === 3 && valueCounts[1][1] === 2) {
    return formatRank(6, CATEGORY_NAMES_5[6], [valueCounts[0][0], valueCounts[1][0]]);
  }

  if (isFlush) {
    return formatRank(5, CATEGORY_NAMES_5[5], valuesDesc);
  }

  if (isStraight) {
    return formatRank(4, CATEGORY_NAMES_5[4], [straightHigh]);
  }

  if (valueCounts[0][1] === 3) {
    const trips = valueCounts[0][0];
    const kickers = valueCounts.slice(1).map(([value]) => value).sort((a, b) => b - a);
    return formatRank(3, CATEGORY_NAMES_5[3], [trips, ...kickers]);
  }

  if (valueCounts[0][1] === 2 && valueCounts[1][1] === 2) {
    const pairValues = valueCounts
      .filter(([, count]) => count === 2)
      .map(([value]) => value)
      .sort((a, b) => b - a);
    const kicker = valueCounts.find(([, count]) => count === 1)[0];
    return formatRank(2, CATEGORY_NAMES_5[2], [...pairValues, kicker]);
  }

  if (valueCounts[0][1] === 2) {
    const pair = valueCounts[0][0];
    const kickers = valueCounts.slice(1).map(([value]) => value).sort((a, b) => b - a);
    return formatRank(1, CATEGORY_NAMES_5[1], [pair, ...kickers]);
  }

  return formatRank(0, CATEGORY_NAMES_5[0], valuesDesc);
}

export function evaluateTop3(cards) {
  const parsed = cards.map(parseCard);
  const counts = new Map();

  parsed.forEach((card) => {
    counts.set(card.value, (counts.get(card.value) || 0) + 1);
  });

  const valueCounts = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const highToLow = parsed.map((card) => card.value).sort((a, b) => b - a);

  if (valueCounts[0][1] === 3) {
    return formatRank(3, CATEGORY_NAMES_TOP[3], [valueCounts[0][0]]);
  }

  if (valueCounts[0][1] === 2) {
    const pair = valueCounts[0][0];
    const kicker = valueCounts.find(([, count]) => count === 1)[0];
    return formatRank(1, CATEGORY_NAMES_TOP[1], [pair, kicker]);
  }

  return formatRank(0, CATEGORY_NAMES_TOP[0], highToLow);
}

export function compareRanks(rankA, rankB) {
  if (rankA.category > rankB.category) return 1;
  if (rankA.category < rankB.category) return -1;
  return compareTiebreakers(rankA.tiebreakers, rankB.tiebreakers);
}

export function evaluateFiveCardHand(cards) {
  return evaluate5(cards);
}

export function evaluateThreeCardTop(cards) {
  return evaluateTop3(cards);
}

export function compareHands(a, b) {
  return compareRanks(a, b);
}

export function getFantasylandQualification(board, isFouledBoard) {
  if (isFouledBoard) {
    return { eligible: false, cards: null };
  }

  const topEval = evaluateTop3(board.top);

  if (topEval.rankName === "Three of a Kind") {
    return { eligible: true, cards: 16 };
  }

  if (topEval.rankName !== "One Pair") {
    return { eligible: false, cards: null };
  }

  const pairValue = topEval.tiebreak[0];
  if (pairValue === RANK_VALUE.Q) {
    return { eligible: true, cards: 13 };
  }

  if (pairValue === RANK_VALUE.K) {
    return { eligible: true, cards: 14 };
  }

  if (pairValue === RANK_VALUE.A) {
    return { eligible: true, cards: 15 };
  }

  return { eligible: false, cards: null };
}
