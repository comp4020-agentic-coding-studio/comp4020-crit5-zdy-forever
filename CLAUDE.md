# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## Background processes (pnpm/node)

- At the start of every conversation, check for stray background processes
  left running from earlier sessions before starting new ones:
  `ps -eo pid,etime,command | grep -E 'pnpm|vite|node' | grep -v grep`.
- Only one `pnpm dev` should be running for this repo at a time. Check the
  dev port isn't already bound (`lsof -i :5173`) before starting another.
- Kill any `pnpm`/`vite`/`node` background process for this repo that's been
  idle for more than 15 minutes (no recent log output, no one actively using
  it) instead of leaving it running indefinitely.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so the deployed head is the only place a broken one shows up.

## Two CSS transitions added on the same tick can silently race

Two classes toggled together in the same frame can interact in ways that
aren't obvious from each transition's own duration: a faster transition
(e.g. a 0.25s grow) can finish before a slower one on the same element
(e.g. a 0.35s fade-in) even completes, so the fast one plays out while the
element is still mostly in its start state --- it reads as having *appeared*
already changed, not as *transitioning*. A `transition-delay` on the faster
property, so it only starts once the slower one is mostly done, is one fix.
When two state changes can land in the same tick, checking that each
transition *individually* fires isn't enough --- check what the combination
looks like against the clock (`getComputedStyle` sampled every frame, not
just before/after).

## The checks

`pnpm check` runs them, and `pnpm check:evidence` is the extra gate before you
ship. CI runs the same plus links, secrets and the deploy.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook: what you add to it is the harness, and the
harness is assessed. This file and the sensors you wire into `check` carry
across the course --- both come with you into next week's repo. The prototype
doesn't: source, and the tests answering this week's published spec, stay
behind. `spec/README.md` draws the line.
