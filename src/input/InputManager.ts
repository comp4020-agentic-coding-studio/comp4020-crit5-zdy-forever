import { KeyboardInput, type Movement } from "./KeyboardInput.ts";

export type { Movement };

// The only thing Game/Player know about input: one {x, y} vector, wherever
// it came from. A touch joystick source is added alongside the keyboard in
// a later milestone without changing this interface.
export class InputManager {
  private readonly keyboard = new KeyboardInput();

  read(): Movement {
    return this.keyboard.read();
  }
}
