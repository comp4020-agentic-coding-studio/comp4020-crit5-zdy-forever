// Thin wrapper around the static #dialogue element: shows/hides it and sets
// its text, but only writes to the DOM when the text actually changes.
export class DialogueUI {
  private readonly root: HTMLElement;
  private currentText: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  sync(text: string | null): void {
    if (text === this.currentText) return;
    this.currentText = text;

    if (text === null) {
      this.root.hidden = true;
      this.root.textContent = "";
    } else {
      this.root.textContent = text;
      this.root.hidden = false;
    }
  }
}
