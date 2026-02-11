const app = document.getElementById("app");

let hand = [];
let topRow = [];
let midRow = [];
let bottomRow = [];

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
    .row.drop-active {
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

function setupDragAndDrop() {
  const draggableCards = document.querySelectorAll("[data-hand-index]");
  const dropZones = document.querySelectorAll("[data-row]");

  draggableCards.forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      const handIndex = card.dataset.handIndex;
      event.dataTransfer.setData("text/plain", handIndex);
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

      const handIndex = Number(event.dataTransfer.getData("text/plain"));
      const rowKey = zone.dataset.row;

      if (Number.isInteger(handIndex)) {
        moveCardToRow(handIndex, rowKey);
      }
    });
  });
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
    <button id="deal">Deal 5 cards</button>

    <h2>Hand</h2>
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

  setupDragAndDrop();
}

draw();
