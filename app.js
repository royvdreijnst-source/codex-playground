const app = document.getElementById("app");

let hand = [];
let topRow = [];
let midRow = [];
let bottomRow = [];

const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

let deck = [];

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


function draw() {
  app.innerHTML = `
    <button id="deal">Deal 5 cards</button>

    <h2>Hand</h2>
    <div>${hand.map(c => `<span class="card">${c}</span>`).join("")}</div>

    <h2>Rows</h2>
    <div class="row"><strong>Top:</strong> ${topRow.map(c => `<span class="card">${c}</span>`).join("")}</div>
    <div class="row"><strong>Middle:</strong> ${midRow.map(c => `<span class="card">${c}</span>`).join("")}</div>
    <div class="row"><strong>Bottom:</strong> ${bottomRow.map(c => `<span class="card">${c}</span>`).join("")}</div>
  `;

  document.getElementById("deal").onclick = () => {
    hand = dealCards(5);
    draw();
  };
}

draw();
