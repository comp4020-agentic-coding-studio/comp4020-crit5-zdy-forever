// Shows the static #end-screen element with a result word and wires its
// restart button back into the game -- the one piece of UI that both the
// loss and win paths share.
export class EndScreenUI {
  private readonly root: HTMLElement;
  private readonly message: HTMLElement;
  private visible = false;

  constructor(root: HTMLElement, message: HTMLElement, restartButton: HTMLButtonElement, onRestart: () => void) {
    this.root = root;
    this.message = message;
    restartButton.addEventListener("click", () => {
      this.hide();
      onRestart();
    });
  }

  show(text: string): void {
    if (this.visible) return;
    this.message.textContent = text;
    this.root.hidden = false;
    this.visible = true;
  }

  hide(): void {
    this.root.hidden = true;
    this.visible = false;
  }
}
