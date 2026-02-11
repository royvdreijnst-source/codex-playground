import { runFantasylandRegressionChecks, startHand } from "./src/game.js";
import { initialState, resetForNewMatch } from "./src/state.js";
import { createUI } from "./src/ui.js";

const app = document.getElementById("app");

if (!app) {
  throw new Error("App mount element #app was not found.");
}

const state = initialState();

function resetState() {
  resetForNewMatch(state);
}

let ui = null;

function dispatch(update) {
  update();
  ui.render();
}

ui = createUI({ app, state, dispatch, resetState });
runFantasylandRegressionChecks();

dispatch(() => {
  resetState();
  startHand(state);
});
