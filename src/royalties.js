import { evaluateFiveCardHand, evaluateThreeCardTop } from "./evaluator.js";

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
  return ROYALTY_TABLE.middle[middleEvaluation.rankName] || 0;
}

function computeBottomRoyalties(bottomEvaluation) {
  return ROYALTY_TABLE.bottom[bottomEvaluation.rankName] || 0;
}

export function computeRoyaltiesForBoard(board) {
  const topEval = evaluateThreeCardTop(board.top);
  const middleEval = evaluateFiveCardHand(board.middle);
  const bottomEval = evaluateFiveCardHand(board.bottom);

  const topRoyalty = computeTopRoyalties(topEval);
  const middleRoyalty = computeMiddleRoyalties(middleEval);
  const bottomRoyalty = computeBottomRoyalties(bottomEval);

  return {
    top: { evaluation: topEval, royalty: topRoyalty },
    middle: { evaluation: middleEval, royalty: middleRoyalty },
    bottom: { evaluation: bottomEval, royalty: bottomRoyalty },
    total: topRoyalty + middleRoyalty + bottomRoyalty,
  };
}

export function computeRoyalties(state) {
  return computeRoyaltiesForBoard(state.board);
}
