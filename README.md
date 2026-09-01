# COMP4020 static prototype template

A starter template for static-site prototypes in **COMP4020 / COMP8020 Agentic
Coding Studio**. The course provisions a repo from this template for each
deliverable --- you don't create it yourself. The `start` course skill clones it
for you; from there, build your prototype and deploy it to GitHub Pages.

## CI and Pages only turn on when you ship

Your repo starts private, and both CI jobs (`check` and `deploy`) are gated on
it being public. While private, a push to `main` runs nothing in CI ---
`pnpm check` (below) is your feedback loop until then. When you're ready, the
course's `/ship` skill flips the repo public, turns on GitHub Pages, and
dispatches the deploy for you; there's nothing to configure in the Pages
settings yourself. From that point, every push to `main` builds and deploys, and
the deploy step prints your live URL and checks it returns 200.

## What gets marked

The deployed site is the deliverable, assessed live in Chrome at two fixed
viewports --- see the course website's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#marking-environment)
for the details.

## Quick start

```sh
mise install       # supported path: install the template's Node and pnpm
pnpm install
pnpm dev             # local dev server
pnpm check           # most of what CI runs (links, secrets and deploy are CI-only)
pnpm check:evidence  # the process-evidence check CI runs before you ship
pnpm build           # produce dist/ (what gets deployed)

# reproduce CI's links check before you push
pnpm dlx linkinator ./dist --silent --skip "^https?://(?!localhost|127)"
```

`mise` is the course's recommended runtime manager. If you use another manager
or the official installers, that is fine: provide the Node and pnpm versions in
`mise.toml`, then run the same commands. Tutor support reproduces runtime
problems with mise.

## What's here

`DON'T MOVE`: a first-person maze game where a light keeps cutting out, and
moving while it's dark for too long, cumulatively, across the whole run, is
what kills you.

- `index.html`, `styles.css`, `main.ts` --- the page shell and entry point.
- `src/game/` --- game logic: `Game.ts` drives the loop; `Player.ts`,
  `LightController.ts`, `GameRules.ts`, `GameState.ts` own player movement,
  the light cycle, win/lose rules, and phase state; `Maze.ts`/`MazeGraph.ts`
  hold the baked maze layout and its graph; `Constants.ts` centralises every
  tunable number.
- `src/render/SceneManager.ts` --- builds and updates the Three.js scene
  (rooms, walls, camera) from game state.
- `src/input/` --- `KeyboardInput.ts` and `TouchJoystick.ts`, merged by
  `InputManager.ts` into one movement vector.
- `src/audio/AudioManager.ts` --- footsteps and win/loss stingers.
- `src/ui/EndScreen.ts` --- the win/loss overlay and restart button;
  `src/ui/Minimap.ts` --- the fixed, fog-of-war minimap of explored cells.
- `scripts/generate-maze.ts` --- regenerates the baked maze in `Maze.ts`;
  `scripts/check-evidence.ts` is the process-evidence gate `pnpm
  check:evidence` runs.
- `mise.toml` --- the tested Node and pnpm versions for this template.
- `spec/` --- what the checks are for (`README.md`), the shipped invariants
  (`invariants.test.ts`), and this prototype's own spec/rule tests
  (`game.test.ts`, `rules.test.ts`).
- `CLAUDE.md` --- orients whoever works in this repo, you or a coding agent.
  Yours to grow.
- `PROCESS.md` --- the cited-moment process log for this prototype;
  `pnpm check:evidence` verifies its citations resolve.
- `.github/workflows/checks.yml` --- the CI sensors that run on every push once
  your repo is public, and the GitHub Pages deploy.
- `.githooks/pre-commit` --- blocks any commit that contains something shaped
  like an API key, so your COMP4020 key can't end up in a public repo. Installed
  automatically by `pnpm install`.

This template is SSG-agnostic: plain HTML/CSS/TypeScript on Vite, so you can add
Astro, Eleventy, or any static generator later without changing how it deploys.
The course plugin's `stack` skill performs the swap for you — to the course
default (Astro) or bare HTML/CSS — with the Pages base path, lockfile, and CI
link check handled.

See the course site for how the checks map to each week of the course.
