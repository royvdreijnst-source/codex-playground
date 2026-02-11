import { RANK_VALUE } from "./state.js";

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

export function evaluateFiveCardHand(cards) {
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

export function evaluateThreeCardTop(cards) {
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

export function compareHands(a, b) {
  if (a.rankClass !== b.rankClass) {
    return a.rankClass - b.rankClass;
  }
  return compareValueArraysDescending(a.tiebreak, b.tiebreak);
}
