import { KeyboardInput, type Movement } from "./KeyboardInput.ts";
import { TouchJoystick } from "./TouchJoystick.ts";

export type { Movement };

// The only thing Game/Player know about input: one {x, y} vector, wherever
// it came from. Keyboard and the touch joystick are summed and re-clamped so
// a touch device with a keyboard attached still behaves sanely.
export class InputManager {
  private readonly keyboard = new KeyboardInput();
  private readonly joystick: TouchJoystick;

  constructor(joystickRoot: HTMLElement, joystickKnob: HTMLElement) {
    this.joystick = new TouchJoystick(joystickRoot, joystickKnob);

    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const applyVisibility = (matches: boolean): void => {
      if (matches) this.joystick.show();
      else this.joystick.hide();
    };
    applyVisibility(coarsePointer.matches);
    coarsePointer.addEventListener("change", (event) => applyVisibility(event.matches));
  }

  read(): Movement {
    const keyboard = this.keyboard.read();
    const joystick = this.joystick.read();
    let x = keyboard.x + joystick.x;
    let y = keyboard.y + joystick.y;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }
}
