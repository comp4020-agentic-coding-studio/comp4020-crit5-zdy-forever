import { JOYSTICK_DEAD_ZONE } from "../game/Constants.ts";

export interface Movement {
  readonly x: number;
  readonly y: number;
}

// A fixed-origin virtual joystick driven by Pointer Events: outer pad plus a
// draggable knob, small dead zone near centre, magnitude clamped to 1,
// analog ramp in between, smooth return-to-centre on release. Tracks exactly
// one active pointer -- setPointerCapture keeps delivering move events for
// that pointer even once the finger leaves the pad, and any other touch that
// lands on the pad while one is already active is ignored outright.
export class TouchJoystick {
  private readonly root: HTMLElement;
  private readonly knob: HTMLElement;
  private activePointerId: number | null = null;
  private movement: Movement = { x: 0, y: 0 };
  private originX = 0;
  private originY = 0;
  private radius = 1;

  constructor(root: HTMLElement, knob: HTMLElement) {
    this.root = root;
    this.knob = knob;

    root.addEventListener("pointerdown", this.onPointerDown);
    root.addEventListener("pointermove", this.onPointerMove);
    root.addEventListener("pointerup", this.onPointerEnd);
    root.addEventListener("pointercancel", this.onPointerEnd);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.reset();
  }

  read(): Movement {
    return this.movement;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.root.setPointerCapture(event.pointerId);

    const rect = this.root.getBoundingClientRect();
    this.originX = rect.left + rect.width / 2;
    this.originY = rect.top + rect.height / 2;
    this.radius = rect.width / 2;
    this.updateFromPointer(event.clientX, event.clientY);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    this.updateFromPointer(event.clientX, event.clientY);
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    this.reset();
  };

  private updateFromPointer(clientX: number, clientY: number): void {
    const dx = (clientX - this.originX) / this.radius;
    const dy = (clientY - this.originY) / this.radius;
    const rawMagnitude = Math.hypot(dx, dy);

    // The knob's visual offset is just the physically clamped displacement.
    const knobScale = rawMagnitude > 1 ? 1 / rawMagnitude : 1;
    this.knob.style.transform = `translate(calc(-50% + ${dx * knobScale * this.radius}px), calc(-50% + ${dy * knobScale * this.radius}px))`;

    if (rawMagnitude < JOYSTICK_DEAD_ZONE) {
      this.movement = { x: 0, y: 0 };
      return;
    }

    // The movement value ramps from 0 at the dead-zone edge to 1 at the pad
    // radius, rather than jumping straight to the dead-zone's own magnitude
    // -- that's what makes a slight displacement a slow walk.
    const clampedMagnitude = Math.min(rawMagnitude, 1);
    const analog = (clampedMagnitude - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE);
    const moveScale = analog / rawMagnitude;
    // Screen Y grows downward; game "forward" (y) should read as up-on-screen.
    this.movement = { x: dx * moveScale, y: -dy * moveScale };
  }

  private reset(): void {
    this.movement = { x: 0, y: 0 };
    this.knob.style.transform = "translate(-50%, -50%)";
  }
}
