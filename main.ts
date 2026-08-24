import { Vector3 } from "three";
import { AudioManager } from "./src/audio/AudioManager.ts";
import { DREAD_MEDIUM_DISTANCE, DREAD_NEAR_DISTANCE } from "./src/game/Constants.ts";
import { Game } from "./src/game/Game.ts";
import { InputManager } from "./src/input/InputManager.ts";
import { SceneManager } from "./src/render/SceneManager.ts";
import { DialogueUI } from "./src/ui/DialogueUI.ts";
import { EndScreenUI } from "./src/ui/EndScreen.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const startOverlay = document.querySelector<HTMLElement>("#start-overlay");
const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const vignetteElement = document.querySelector<HTMLElement>("#vignette");
const joystickRoot = document.querySelector<HTMLElement>("#joystick");
const joystickKnob = document.querySelector<HTMLElement>(".joystick-knob");
const dialogueElement = document.querySelector<HTMLElement>("#dialogue");
const endScreenElement = document.querySelector<HTMLElement>("#end-screen");
const endMessageElement = document.querySelector<HTMLElement>("#end-message");
const restartButton = document.querySelector<HTMLButtonElement>("#restart-button");

if (
  !canvas ||
  !startOverlay ||
  !startButton ||
  !vignetteElement ||
  !joystickRoot ||
  !joystickKnob ||
  !dialogueElement ||
  !endScreenElement ||
  !endMessageElement ||
  !restartButton
) {
  throw new Error("LAST SIGNAL: expected page structure is missing");
}

// Narrowed local so the animation-frame closure below (a function
// declaration, which TS can't prove is only ever called after this guard)
// still sees it as non-null.
const vignette = vignetteElement;

const game = new Game();
const inputManager = new InputManager(joystickRoot, joystickKnob);
const sceneManager = new SceneManager(canvas);
const audioManager = new AudioManager();
const dialogueUI = new DialogueUI(dialogueElement);
const endScreenUI = new EndScreenUI(endScreenElement, endMessageElement, restartButton, () => {
  game.reset();
  sceneManager.resetCamera();
  sceneManager.resetRocket();
});

function resize(): void {
  sceneManager.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

sceneManager.syncPlayer(game.player.position, game.player.up);
sceneManager.updateCamera(game.player.position, game.player.up, game.player.forward, 1);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const groundForward = new Vector3();
const groundRight = new Vector3();
let lastTime = performance.now();

function tick(now: number): void {
  // Clamped so a backgrounded/throttled tab doesn't produce one huge delta
  // (and a huge, sudden movement or camera jump) when it regains focus.
  const deltaSeconds = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  const up = game.player.up;
  sceneManager.getGroundBasis(up, groundForward, groundRight);
  game.update(inputManager.read(), groundForward, groundRight, deltaSeconds);
  dialogueUI.sync(game.dialogueText);
  if (game.endScreenText) endScreenUI.show(game.endScreenText);

  const dread = 1 - clamp((game.ghostDistance - DREAD_NEAR_DISTANCE) / (DREAD_MEDIUM_DISTANCE - DREAD_NEAR_DISTANCE), 0, 1);
  vignette.style.opacity = String(dread * 0.6);
  sceneManager.setDread(dread);
  audioManager.setGhostDistance(game.ghostDistance);

  sceneManager.syncPlayer(game.player.position, game.player.up);
  sceneManager.syncGhost(game.ghost.position, game.ghost.up);
  sceneManager.updateRocket(game.phase === "won", deltaSeconds);
  sceneManager.updateCamera(game.player.position, game.player.up, game.player.forward, deltaSeconds);
  sceneManager.render();

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

startButton.addEventListener("click", () => {
  game.begin();
  startOverlay.hidden = true;
  audioManager.start();
});
