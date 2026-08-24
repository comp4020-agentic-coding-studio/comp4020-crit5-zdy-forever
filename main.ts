import { SPAWN_FORWARD, SPAWN_POINT } from "./src/game/World.ts";
import { SceneManager } from "./src/render/SceneManager.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const startOverlay = document.querySelector<HTMLElement>("#start-overlay");
const startButton = document.querySelector<HTMLButtonElement>("#start-button");

if (!canvas || !startOverlay || !startButton) {
  throw new Error("LAST SIGNAL: expected page structure is missing");
}

const sceneManager = new SceneManager(canvas);

function resize(): void {
  sceneManager.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

const up = SPAWN_POINT.clone().normalize();
sceneManager.syncPlayer(SPAWN_POINT, up);
sceneManager.updateCamera(SPAWN_POINT, up, SPAWN_FORWARD, 1);

function tick(): void {
  sceneManager.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

startButton.addEventListener("click", () => {
  startOverlay.hidden = true;
});
