import { compareRanks, evaluate5, evaluateTop3 } from "./evaluator.js";
import { computeBoardRoyalties } from "./royalties.js";

const REQUIRED_ROW_SIZES = {
  top: 3,
  middle: 5,
  bottom: 5,
};

function assertBoardShape(board, label) {
  for (const [rowKey, size] of Object.entries(REQUIRED_ROW_SIZES)) {
    if (!Array.isArray(board[rowKey]) || board[rowKey].length !== size) {
      throw new Error(`${label}.${rowKey} must contain exactly ${size} cards.`);
    }
  }
}

function rowCodes(cards) {
  return cards.map((card) => card.code || `${card.rank}${card.suit}`);
}

function evaluateBoard(board) {
  return {
    top: evaluateTop3(board.top),
    middle: evaluate5(board.middle),
    bottom: evaluate5(board.bottom),
  };
}

function isFoul(evaluations) {
  return compareRanks(evaluations.bottom, evaluations.middle) < 0 || compareRanks(evaluations.middle, evaluations.top) < 0;
}

function compareLine(rankA, rankB) {
  return compareRanks(rankA, rankB);
}

function rowSummary(name, boardA, boardB, evalA, evalB, lineResult, points) {
  const outcome = lineResult > 0 ? "A wins" : lineResult < 0 ? "B wins" : "Tie";
  return {
    row: name,
    boardA: rowCodes(boardA[name]),
    boardB: rowCodes(boardB[name]),
    rankA: evalA[name],
    rankB: evalB[name],
    lineResult,
    points,
    outcome,
  };
}

export function scoreHand(boardA, boardB) {
  assertBoardShape(boardA, "boardA");
  assertBoardShape(boardB, "boardB");

  const evalA = evaluateBoard(boardA);
  const evalB = evaluateBoard(boardB);

  const foulA = isFoul(evalA);
  const foulB = isFoul(evalB);

  const lineWinsA = { top: 0, middle: 0, bottom: 0 };
  let scoopA = false;
  let royaltiesA = 0;
  let royaltiesB = 0;
  let royaltiesDetailA = { top: 0, middle: 0, bottom: 0 };
  let royaltiesDetailB = { top: 0, middle: 0, bottom: 0 };
  let linePointsA = 0;
  const breakdownRows = [];

  if (foulA && foulB) {
    breakdownRows.push({ note: "Both players fouled: hand scores 0-0 with no scoop and no royalties." });
  } else if (foulA || foulB) {
    const forced = foulA ? -1 : 1;
    lineWinsA.top = forced;
    lineWinsA.middle = forced;
    lineWinsA.bottom = forced;
    linePointsA = forced * 3;
    breakdownRows.push({
      note: foulA
        ? "Player A fouled: A automatically loses top/middle/bottom and gets no royalties."
        : "Player B fouled: A automatically wins top/middle/bottom and B gets no royalties.",
    });
  } else {
    lineWinsA.top = compareLine(evalA.top, evalB.top);
    lineWinsA.middle = compareLine(evalA.middle, evalB.middle);
    lineWinsA.bottom = compareLine(evalA.bottom, evalB.bottom);

    linePointsA = lineWinsA.top + lineWinsA.middle + lineWinsA.bottom;

    const aWinsAll = lineWinsA.top === 1 && lineWinsA.middle === 1 && lineWinsA.bottom === 1;
    const bWinsAll = lineWinsA.top === -1 && lineWinsA.middle === -1 && lineWinsA.bottom === -1;
    if (aWinsAll) {
      scoopA = true;
      linePointsA += 3;
    }
    if (bWinsAll) {
      linePointsA -= 3;
    }

    const boardRoyaltiesA = computeBoardRoyalties(boardA);
    const boardRoyaltiesB = computeBoardRoyalties(boardB);
    royaltiesA = boardRoyaltiesA.total;
    royaltiesB = boardRoyaltiesB.total;
    royaltiesDetailA = { top: boardRoyaltiesA.top, middle: boardRoyaltiesA.middle, bottom: boardRoyaltiesA.bottom };
    royaltiesDetailB = { top: boardRoyaltiesB.top, middle: boardRoyaltiesB.middle, bottom: boardRoyaltiesB.bottom };

    breakdownRows.push(rowSummary("top", boardA, boardB, evalA, evalB, lineWinsA.top, lineWinsA.top));
    breakdownRows.push(rowSummary("middle", boardA, boardB, evalA, evalB, lineWinsA.middle, lineWinsA.middle));
    breakdownRows.push(rowSummary("bottom", boardA, boardB, evalA, evalB, lineWinsA.bottom, lineWinsA.bottom));
    if (aWinsAll || bWinsAll) {
      breakdownRows.push({ note: aWinsAll ? "Player A scoop bonus: +3." : "Player B scoop bonus: -3 to A." });
    }
    breakdownRows.push({
      note: `Royalties applied: A +${royaltiesA}, B +${royaltiesB}, net to A ${royaltiesA - royaltiesB}.`,
    });
  }

  const pointsA = linePointsA + (royaltiesA - royaltiesB);
  const pointsB = pointsA === 0 ? 0 : -pointsA;

  if (pointsA !== -pointsB) {
    throw new Error("Invariant violated: pointsA must equal -pointsB.");
  }

  return {
    foulA,
    foulB,
    lineWinsA,
    scoopA,
    royaltiesA,
    royaltiesB,
    pointsA,
    pointsB,
    breakdown: {
      rows: breakdownRows,
      linePointsA,
      royaltiesDeltaA: royaltiesA - royaltiesB,
      royaltiesA: royaltiesDetailA,
      royaltiesB: royaltiesDetailB,
      evaluations: {
        boardA: evalA,
        boardB: evalB,
      },
    },
  };
}

export function prettyPrintBoard(board) {
  return ["top", "middle", "bottom"]
    .map((row) => `${row.toUpperCase()}: ${rowCodes(board[row]).join(" ")}`)
    .join("\n");
}

export function prettyPrintScore(scoreResult) {
  return [
    `foulA=${scoreResult.foulA} foulB=${scoreResult.foulB}`,
    `lineWinsA=${JSON.stringify(scoreResult.lineWinsA)}`,
    `scoopA=${scoreResult.scoopA}`,
    `royaltiesA=${scoreResult.royaltiesA} royaltiesB=${scoreResult.royaltiesB}`,
    `pointsA=${scoreResult.pointsA} pointsB=${scoreResult.pointsB}`,
  ].join("\n");
}

export function computeHeadToHeadScore(boardA, boardB) {
  return scoreHand(boardA, boardB);
}
