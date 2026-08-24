import { Vector3 } from "three";
import { AudioManager } from "./src/audio/AudioManager.ts";
import { GHOST_INITIAL_DISTANCE, GHOST_LOSS_THRESHOLD } from "./src/game/Constants.ts";
import { Game } from "./src/game/Game.ts";
import { InputManager } from "./src/input/InputManager.ts";
import { SceneManager } from "./src/render/SceneManager.ts";
import { EndScreenUI } from "./src/ui/EndScreen.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const startOverlay = document.querySelector<HTMLElement>("#start-overlay");
const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const vignetteElement = document.querySelector<HTMLElement>("#vignette");
const joystickRoot = document.querySelector<HTMLElement>("#joystick");
const joystickKnob = document.querySelector<HTMLElement>(".joystick-knob");
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
  !endScreenElement ||
  !endMessageElement ||
  !restartButton
) {
  throw new Error("DON'T MOVE: expected page structure is missing");
}

// Narrowed local so the animation-frame closure below (a function
// declaration, which TS can't prove is only ever called after this guard)
// still sees it as non-null.
const vignette = vignetteElement;

const game = new Game();
const inputManager = new InputManager(joystickRoot, joystickKnob);
const sceneManager = new SceneManager(canvas);
const audioManager = new AudioManager();
const endScreenUI = new EndScreenUI(endScreenElement, endMessageElement, restartButton, () => {
  game.reset();
  sceneManager.resetCamera();
});

function resize(): void {
  sceneManager.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

sceneManager.syncPlayer(game.player.position);
sceneManager.updateCamera(game.player.position, game.player.forward, 1);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const groundForward = new Vector3();
const groundRight = new Vector3();
const ghostPosition = new Vector3();
let lastTime = performance.now();
let lossStingerPlayed = false;
let winStingerPlayed = false;

function tick(now: number): void {
  // Clamped so a backgrounded/throttled tab doesn't produce one huge delta
  // (and a huge, sudden movement or camera jump) when it regains focus.
  const deltaSeconds = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  sceneManager.getGroundBasis(groundForward, groundRight);
  game.update(inputManager.read(), groundForward, groundRight, deltaSeconds);

  if (game.endScreenText) endScreenUI.show(game.endScreenText);
  if (game.phase === "playing") {
    lossStingerPlayed = false;
    winStingerPlayed = false;
  } else if (game.phase === "lost" && !lossStingerPlayed) {
    lossStingerPlayed = true;
    audioManager.playLossStinger();
  } else if (game.phase === "won" && !winStingerPlayed) {
    winStingerPlayed = true;
    audioManager.playWinStinger();
  }

  const danger = 1 - clamp((game.ghost.distance - GHOST_LOSS_THRESHOLD) / (GHOST_INITIAL_DISTANCE - GHOST_LOSS_THRESHOLD), 0, 1);
  vignette.style.opacity = String(danger * 0.6);
  sceneManager.setDread(danger);
  audioManager.sync(danger, game.illegalMovementNow);

  sceneManager.syncPlayer(game.player.position);
  game.ghost.positionBehind(game.player.position.z, ghostPosition);
  sceneManager.syncGhost(ghostPosition);
  sceneManager.updateLights(game.light.intensity, deltaSeconds);
  sceneManager.updateCamera(game.player.position, game.player.forward, deltaSeconds);
  sceneManager.render();

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

startButton.addEventListener("click", () => {
  game.begin();
  startOverlay.hidden = true;
  audioManager.start();
});
