export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const RANK_VALUE = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 2]));

export const ROWS = {
  top: { label: "Top", max: 3 },
  middle: { label: "Middle", max: 5 },
  bottom: { label: "Bottom", max: 5 },
};

export const STREET_REQUIREMENTS = {
  1: { deal: 5, place: 5, discard: 0, text: "Place 5" },
  2: { deal: 3, place: 2, discard: 1, text: "Place 2 (1 auto-discard)" },
  3: { deal: 3, place: 2, discard: 1, text: "Place 2 (1 auto-discard)" },
  4: { deal: 3, place: 2, discard: 1, text: "Place 2 (1 auto-discard)" },
  5: { deal: 3, place: 2, discard: 1, text: "Place 2 (1 auto-discard)" },
};

function baseState() {
  return {
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
    fantasylandCardCount: 13,
    fantasylandEligibleNextHand: false,
    fantasylandBlockedNextHand: false,
    burnedCards: [],
    message: "",
    statusType: "info",
    handFinished: false,
    result: null,
  };
}

export function initialState() {
  return baseState();
}

export function resetForNewHand(state) {
  Object.assign(state, baseState());
}

export function resetForNewMatch(state) {
  resetForNewHand(state);
}
