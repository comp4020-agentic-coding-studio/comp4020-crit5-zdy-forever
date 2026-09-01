import { Vector3 } from "three";
import { AudioManager } from "./src/audio/AudioManager.ts";
import { Game } from "./src/game/Game.ts";
import { InputManager } from "./src/input/InputManager.ts";
import { SceneManager } from "./src/render/SceneManager.ts";
import { EndScreenUI } from "./src/ui/EndScreen.ts";
import { MinimapUI } from "./src/ui/Minimap.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const startOverlay = document.querySelector<HTMLElement>("#start-overlay");
const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const vignetteElement = document.querySelector<HTMLElement>("#vignette");
const minimapCanvas = document.querySelector<HTMLCanvasElement>("#minimap");
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
  !minimapCanvas ||
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
const minimapUI = new MinimapUI(minimapCanvas);
const audioManager = new AudioManager();
const endScreenUI = new EndScreenUI(endScreenElement, endMessageElement, restartButton, () => {
  game.reset();
});

function resize(): void {
  sceneManager.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

sceneManager.updateCamera(game.player.position, game.player.forward);

const groundForward = new Vector3();
const groundRight = new Vector3();
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

  const danger = game.danger;
  vignette.style.opacity = String(danger * 0.6);
  sceneManager.setDread(danger);
  audioManager.sync(danger, game.illegalMovementNow);

  minimapUI.update(game.visitedCells, game.player.position, game.player.forward);
  sceneManager.updateLights(game.light.intensity, deltaSeconds);
  sceneManager.updateCamera(game.player.position, game.player.forward);
  sceneManager.render();

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

startButton.addEventListener("click", () => {
  game.begin();
  startOverlay.hidden = true;
  audioManager.start();
});
