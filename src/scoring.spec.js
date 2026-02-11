import assert from "node:assert/strict";
import { scoreHand, prettyPrintBoard, prettyPrintScore } from "./scoring.js";

function card(code) {
  const suit = code.slice(-1);
  const rank = code.slice(0, -1);
  return { code, rank, suit };
}

function cards(codes) {
  return codes.map(card);
}

function board(top, middle, bottom) {
  return { top: cards(top), middle: cards(middle), bottom: cards(bottom) };
}

const B = {
  topHC1: ["A♠", "9♥", "4♣"],
  topHC2: ["K♠", "9♦", "3♣"],
  topPair6: ["6♠", "6♥", "2♣"],
  topPairQ: ["Q♠", "Q♥", "3♣"],
  topTrips2: ["2♠", "2♥", "2♦"],

  middlePair: ["K♠", "K♥", "8♣", "5♦", "2♠"],
  middleTwoPair: ["A♠", "A♥", "7♣", "7♦", "3♠"],
  middleTrips: ["9♠", "9♥", "9♦", "4♣", "2♦"],
  middleStraight: ["5♠", "6♥", "7♣", "8♦", "9♠"],
  middleHCweak: ["K♣", "10♦", "8♠", "5♥", "3♦"],

  bottomTwoPair: ["Q♠", "Q♥", "J♣", "J♦", "2♥"],
  bottomStraight: ["6♠", "7♥", "8♣", "9♦", "10♠"],
  bottomFlush: ["A♥", "J♥", "8♥", "5♥", "2♥"],
  bottomFullHouse: ["4♠", "4♥", "4♦", "K♣", "K♦"],
  bottomSF: ["9♣", "10♣", "J♣", "Q♣", "K♣"],
  bottomHCweak: ["Q♣", "10♠", "8♦", "6♥", "2♣"],
};

const tests = [
  {
    name: "tie all lines",
    a: board(B.topHC1, B.middlePair, B.bottomTwoPair),
    b: board(B.topHC1, B.middlePair, B.bottomTwoPair),
    pointsA: 0,
  },
  {
    name: "A wins top only",
    a: board(B.topHC1, B.middlePair, B.bottomTwoPair),
    b: board(B.topHC2, B.middlePair, B.bottomTwoPair),
    pointsA: 1,
  },
  {
    name: "A wins middle only",
    a: board(B.topHC1, B.middleTwoPair, B.bottomFullHouse),
    b: board(B.topHC1, B.middlePair, B.bottomFullHouse),
    pointsA: 1,
  },
  {
    name: "A wins bottom only (plus bottom royalty)",
    a: board(B.topHC1, B.middlePair, B.bottomStraight),
    b: board(B.topHC1, B.middlePair, B.bottomTwoPair),
    pointsA: 3,
  },
  {
    name: "mixed lines net 0",
    a: board(B.topHC1, B.middlePair, B.bottomFullHouse),
    b: board(B.topHC2, B.middleTwoPair, B.bottomFullHouse),
    pointsA: 0,
  },
  {
    name: "A scoop +3 once with royalties",
    a: board(B.topPair6, B.middleTrips, B.bottomSF),
    b: board(B.topHC2, B.middlePair, B.bottomTwoPair),
    pointsA: 24,
  },
  {
    name: "B scoop with royalties",
    a: board(B.topHC2, B.middlePair, B.bottomTwoPair),
    b: board(B.topPair6, B.middleTrips, B.bottomSF),
    pointsA: -24,
  },
  {
    name: "A fouls and loses all lines",
    a: board(B.topPairQ, B.middleHCweak, B.bottomTwoPair),
    b: board(B.topHC2, B.middlePair, B.bottomTwoPair),
    pointsA: -3,
  },
  {
    name: "B fouls and loses all lines",
    a: board(B.topHC2, B.middlePair, B.bottomTwoPair),
    b: board(B.topPairQ, B.middleHCweak, B.bottomTwoPair),
    pointsA: 3,
  },
  {
    name: "both foul yields 0-0",
    a: board(B.topPairQ, B.middleHCweak, B.bottomTwoPair),
    b: board(B.topTrips2, B.middlePair, B.bottomHCweak),
    pointsA: 0,
  },
  {
    name: "top royalty applied (pair six)",
    a: board(B.topPair6, B.middlePair, B.bottomTwoPair),
    b: board(B.topHC2, B.middlePair, B.bottomTwoPair),
    pointsA: 2,
  },
  {
    name: "middle royalty applied (straight)",
    a: board(B.topHC2, B.middleStraight, B.bottomSF),
    b: board(B.topHC2, B.middlePair, B.bottomSF),
    pointsA: 5,
  },
  {
    name: "bottom royalty applied to B (full house)",
    a: board(B.topHC2, B.middlePair, B.bottomTwoPair),
    b: board(B.topHC2, B.middlePair, B.bottomFullHouse),
    pointsA: -7,
  },
  {
    name: "scoop plus royalties",
    a: board(B.topPairQ, B.middleTrips, B.bottomSF),
    b: board(B.topHC2, B.middlePair, B.bottomTwoPair),
    pointsA: 30,
  },
  {
    name: "tied lines with royalty diff",
    a: board(B.topHC1, B.middleTrips, B.bottomSF),
    b: board(B.topHC1, B.middlePair, B.bottomSF),
    pointsA: 3,
  },
];

for (const test of tests) {
  const result = scoreHand(test.a, test.b);
  assert.equal(result.pointsA, test.pointsA, test.name);
  assert.equal(result.pointsA + result.pointsB, 0, `${test.name}: anti-symmetry`);
  if (result.foulA && !result.foulB) {
    assert.ok(result.pointsA < result.pointsB, `${test.name}: foulA should trail`);
  }
  if (result.foulA && result.foulB) {
    assert.equal(result.pointsA, 0, `${test.name}: both foul pointsA`);
    assert.equal(result.pointsB, 0, `${test.name}: both foul pointsB`);
  }
}

let seed = 1337;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suits = ["♠", "♥", "♦", "♣"];
const deck = [];
for (const rank of ranks) {
  for (const suit of suits) {
    deck.push(`${rank}${suit}`);
  }
}

function randomBoard() {
  const shuffled = [...deck].sort(() => rnd() - 0.5);
  return board(shuffled.slice(0, 3), shuffled.slice(3, 8), shuffled.slice(8, 13));
}

for (let i = 0; i < 100; i += 1) {
  const a = randomBoard();
  const b = randomBoard();
  const result = scoreHand(a, b);
  assert.equal(result.pointsA + result.pointsB, 0, `random ${i}: anti-symmetry`);
  if (result.foulA && !result.foulB) {
    assert.ok(result.pointsA < result.pointsB, `random ${i}: foulA should trail`);
  }
  if (result.foulA && result.foulB) {
    assert.equal(result.pointsA, 0, `random ${i}: both foul pointsA`);
    assert.equal(result.pointsB, 0, `random ${i}: both foul pointsB`);
  }
}

const sample = scoreHand(
  board(B.topPairQ, B.middleTrips, B.bottomSF),
  board(B.topHC2, B.middlePair, B.bottomStraight),
);
console.log(prettyPrintBoard(board(B.topPairQ, B.middleTrips, B.bottomSF)));
console.log(prettyPrintScore(sample));
console.log(`Passed ${tests.length} deterministic scoring tests + 100 random invariant checks.`);
