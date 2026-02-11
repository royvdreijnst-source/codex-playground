const app = document.getElementById("app");

let hand = [];
let topRow = [];
let midRow = [];
let bottomRow = [];
let isEditMode = true;

const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

let deck = [];

const rowConfig = {
  top: { cards: topRow, label: "Top", max: 3 },
  middle: { cards: midRow, label: "Middle", max: 5 },
  bottom: { cards: bottomRow, label: "Bottom", max: 5 },
};

function ensureDropStyles() {
  if (document.getElementById("dnd-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "dnd-styles";
  style.textContent = `
    .row.drop-active,
    .hand-zone.drop-active {
      outline: 2px dashed #4a90e2;
      background: #f0f7ff;
    }

    .card[draggable="true"] {
      cursor: grab;
    }
  `;

  document.head.appendChild(style);
}

function newDeck() {
  deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(rank + suit);
    }
  }
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealCards(n) {
  if (deck.length < n) {
    newDeck();
    shuffle(deck);
  }
  return deck.splice(0, n);
}

function moveCardToRow(cardIndex, rowKey) {
  const row = rowConfig[rowKey];

  if (!row) {
    return;
  }

  if (row.cards.length >= row.max) {
    alert(`${row.label} row is full.`);
    return;
  }

  const [card] = hand.splice(cardIndex, 1);

  if (!card) {
    return;
  }

  row.cards.push(card);
  draw();
}

function moveRowCard(fromRowKey, cardIndex, toRowKey) {
  const fromRow = rowConfig[fromRowKey];
  const toRow = rowConfig[toRowKey];

  if (!fromRow || !toRow) {
    return;
  }

  if (fromRowKey !== toRowKey && toRow.cards.length >= toRow.max) {
    alert(`${toRow.label} row is full.`);
    return;
  }

  const [card] = fromRow.cards.splice(cardIndex, 1);

  if (!card) {
    return;
  }

  toRow.cards.push(card);
  draw();
}

function moveRowCardToHand(fromRowKey, cardIndex) {
  const fromRow = rowConfig[fromRowKey];

  if (!fromRow) {
    return;
  }

  const [card] = fromRow.cards.splice(cardIndex, 1);

  if (!card) {
    return;
  }

  hand.push(card);
  draw();
}

function setupDragAndDrop() {
  if (!isEditMode) {
    return;
  }

  const draggableCards = document.querySelectorAll("[data-drag-source]");
  const dropZones = document.querySelectorAll("[data-row]");
  const handZone = document.querySelector("[data-drop-zone='hand']");

  draggableCards.forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      const payload = {
        source: card.dataset.dragSource,
        index: Number(card.dataset.cardIndex),
      };

      if (payload.source === "row") {
        payload.row = card.dataset.row;
      }

      event.dataTransfer.setData("text/plain", JSON.stringify(payload));
      event.dataTransfer.effectAllowed = "move";
    });
  });

  dropZones.forEach((zone) => {
    zone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      zone.classList.add("drop-active");
    });

    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      zone.classList.add("drop-active");
    });

    zone.addEventListener("dragleave", (event) => {
      if (!zone.contains(event.relatedTarget)) {
        zone.classList.remove("drop-active");
      }
    });

    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("drop-active");

      const rawData = event.dataTransfer.getData("text/plain");
      const rowKey = zone.dataset.row;
      const payload = JSON.parse(rawData || "{}");

      if (!Number.isInteger(payload.index)) {
        return;
      }

      if (payload.source === "hand") {
        moveCardToRow(payload.index, rowKey);
      } else if (payload.source === "row") {
        moveRowCard(payload.row, payload.index, rowKey);
      }
    });
  });

  if (handZone) {
    handZone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      handZone.classList.add("drop-active");
    });

    handZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      handZone.classList.add("drop-active");
    });

    handZone.addEventListener("dragleave", (event) => {
      if (!handZone.contains(event.relatedTarget)) {
        handZone.classList.remove("drop-active");
      }
    });

    handZone.addEventListener("drop", (event) => {
      event.preventDefault();
      handZone.classList.remove("drop-active");

      const rawData = event.dataTransfer.getData("text/plain");
      const payload = JSON.parse(rawData || "{}");

      if (payload.source === "row" && Number.isInteger(payload.index)) {
        moveRowCardToHand(payload.row, payload.index);
      }
    });
  }
}

function getCardColorClass(card) {
  const suit = card.slice(-1);
  return suit === "♥" || suit === "♦" ? "red" : "black";
}

function renderCard(card, attrs = "") {
  return `<span class="card ${getCardColorClass(card)}" ${attrs}>${card}</span>`;
}

function draw() {
  ensureDropStyles();

  app.innerHTML = `
    <div class="controls">
      <button id="deal">Deal 5 cards</button>
      <button id="toggle-mode">${isEditMode ? "Done" : "Edit"}</button>
      ${isEditMode ? "" : '<span class="mode-badge">Locked</span>'}
    </div>

    <h2>Hand</h2>
    <div class="hand-zone ${isEditMode ? "" : "locked-zone"}" data-drop-zone="hand">${hand
      .map(
        (c, idx) =>
          `<span class="card" draggable="${isEditMode}" data-drag-source="hand" data-card-index="${idx}">${c}</span>`
      )
      .join("")}</div>

    <h2>Rows</h2>
    <div class="row ${isEditMode ? "" : "locked-zone"}" data-row="top"><strong>Top:</strong> ${topRow
      .map(
        (c, idx) =>
          `<span class="card" draggable="${isEditMode}" data-drag-source="row" data-row="top" data-card-index="${idx}">${c}</span>`
      )
      .join("")}</div>
    <div class="row ${isEditMode ? "" : "locked-zone"}" data-row="middle"><strong>Middle:</strong> ${midRow
      .map(
        (c, idx) =>
          `<span class="card" draggable="${isEditMode}" data-drag-source="row" data-row="middle" data-card-index="${idx}">${c}</span>`
      )
      .join("")}</div>
    <div class="row ${isEditMode ? "" : "locked-zone"}" data-row="bottom"><strong>Bottom:</strong> ${bottomRow
      .map(
        (c, idx) =>
          `<span class="card" draggable="${isEditMode}" data-drag-source="row" data-row="bottom" data-card-index="${idx}">${c}</span>`
      )
      .join("")}</div>
    <div>${hand
      .map((c, idx) => renderCard(c, `draggable="true" data-hand-index="${idx}"`))
      .join("")}</div>

    <h2>Rows</h2>
    <div class="row" data-row="top"><strong>Top:</strong> ${topRow.map(c => renderCard(c)).join("")}</div>
    <div class="row" data-row="middle"><strong>Middle:</strong> ${midRow.map(c => renderCard(c)).join("")}</div>
    <div class="row" data-row="bottom"><strong>Bottom:</strong> ${bottomRow.map(c => renderCard(c)).join("")}</div>
  `;

  document.getElementById("deal").onclick = () => {
    hand = dealCards(5);
    draw();
  };

  document.getElementById("toggle-mode").onclick = () => {
    isEditMode = !isEditMode;
    draw();
  };

  setupDragAndDrop();
}

draw();
