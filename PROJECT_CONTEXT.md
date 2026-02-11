# Project Context: Pineapple OFC Web App

## Stack
- Vanilla JS (ES Modules)
- Static hosting: Netlify (prod + PR previews) + GitHub Pages (optional)

## Repo workflow
- main = production
- Feature work happens in branches/PRs
- Test via Netlify Deploy Preview before merging

## Game flow
- Street 1: deal 5, place, Done locks street
- Streets 2–5: deal 3, place 2, discard 1, Done locks street
- Locked cards cannot be moved

## Scoring
- Common OFC royalties table
- Foul rule: Bottom >= Middle >= Top; if foul, royalties = 0

## Code architecture (modules)
- /src/state.js: canonical state shape + resets
- /src/game.js: rules + state transitions
- /src/evaluator.js: hand evaluation + comparisons
- /src/royalties.js: royalties table + computation
- /src/ui.js: rendering + drag/drop + event wiring
- /src/scoring.js: placeholder / or scoring logic if present
- app.js: bootstrap + glue
