export interface Movement {
  readonly x: number;
  readonly y: number;
}

// WASD primary, arrow keys as a silent fallback -- both map to the same
// four directions, so there's nothing to explain either way.
const KEY_MAP: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export class KeyboardInput {
  private readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (event) => {
      if (event.code in KEY_MAP) this.pressed.add(event.code);
    });
    window.addEventListener("keyup", (event) => {
      this.pressed.delete(event.code);
    });
    // Keys can get "stuck" down if focus leaves the page mid-press.
    window.addEventListener("blur", () => this.pressed.clear());
  }

  read(): Movement {
    let x = 0;
    let y = 0;
    for (const code of this.pressed) {
      const [dx, dy] = KEY_MAP[code];
      x += dx;
      y += dy;
    }
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }
}
