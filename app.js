const app = document.getElementById("app");

let hand = [];
let topRow = [];
let midRow = [];
let bottomRow = [];

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
    hand = ["A♠", "K♦", "7♣", "7♥", "2♠"]; // placeholder for now
    draw();
  };
}

draw();
