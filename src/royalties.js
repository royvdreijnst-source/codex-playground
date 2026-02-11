import { evaluate5, evaluateTop3 } from "./evaluator.js";

export const ROYALTY_TABLE = {
  middle: {
    "Three of a Kind": 2,
    Straight: 4,
    Flush: 8,
    "Full House": 12,
    "Four of a Kind": 20,
    "Straight Flush": 30,
  },
  bottom: {
    Straight: 2,
    Flush: 4,
    "Full House": 6,
    "Four of a Kind": 10,
    "Straight Flush": 15,
  },
};

export function computeTopRoyalties(topRank) {
  if (topRank.categoryName === "Three of a Kind") {
    return topRank.tiebreakers[0] + 8;
  }

  if (topRank.categoryName === "One Pair" && topRank.tiebreakers[0] >= 6) {
    return topRank.tiebreakers[0] - 5;
  }

  return 0;
}

export function computeMiddleRoyalties(middleRank) {
  return ROYALTY_TABLE.middle[middleRank.categoryName] || 0;
}

export function computeBottomRoyalties(bottomRank) {
  return ROYALTY_TABLE.bottom[bottomRank.categoryName] || 0;
}

export function computeBoardRoyalties(board) {
  const topRank = evaluateTop3(board.top);
  const middleRank = evaluate5(board.middle);
  const bottomRank = evaluate5(board.bottom);

  const top = computeTopRoyalties(topRank);
  const middle = computeMiddleRoyalties(middleRank);
  const bottom = computeBottomRoyalties(bottomRank);

  return {
    top,
    middle,
    bottom,
    total: top + middle + bottom,
    ranks: {
      top: topRank,
      middle: middleRank,
      bottom: bottomRank,
    },
  };
}

export function computeRoyaltiesForBoard(board) {
  const royalties = computeBoardRoyalties(board);
  return {
    top: { evaluation: royalties.ranks.top, royalty: royalties.top },
    middle: { evaluation: royalties.ranks.middle, royalty: royalties.middle },
    bottom: { evaluation: royalties.ranks.bottom, royalty: royalties.bottom },
    total: royalties.total,
  };
}

export function computeRoyalties(state) {
  return computeRoyaltiesForBoard(state.board);
}
