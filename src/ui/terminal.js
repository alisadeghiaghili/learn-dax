/**
 * Terminal widget with history.
 */

export class Terminal {
  /**
   * @param {HTMLElement} out
   * @param {HTMLInputElement} input
   * @param {(line: string) => void} onCommand
   */
  constructor(out, input, onCommand) {
    this.out = out;
    this.input = input;
    this.onCommand = onCommand;
    /** @type {string[]} */
    this.history = [];
    this.histIdx = -1;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const line = input.value;
        input.value = '';
        this.histIdx = -1;
        if (!line.trim()) return;
        this.history.push(line);
        this.print(`$ ${line}`, 'cmd');
        onCommand(line);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this.history.length) return;
        this.histIdx = this.histIdx < 0 ? this.history.length - 1 : Math.max(0, this.histIdx - 1);
        input.value = this.history[this.histIdx];
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.histIdx < 0) return;
        this.histIdx += 1;
        if (this.histIdx >= this.history.length) {
          this.histIdx = -1;
          input.value = '';
        } else {
          input.value = this.history[this.histIdx];
        }
      }
    });
  }

  /**
   * @param {string} text
   * @param {'out'|'cmd'|'err'|'ok'|'muted'} [kind]
   */
  print(text, kind = 'out') {
    const p = document.createElement('div');
    p.className = `term-line ${kind}`;
    p.textContent = text;
    this.out.appendChild(p);
    this.out.scrollTop = this.out.scrollHeight;
  }

  /**
   * @param {string} text
   */
  printBlock(text) {
    for (const line of String(text).split('\n')) {
      this.print(line, 'muted');
    }
  }

  clear() {
    this.out.innerHTML = '';
  }

  focus() {
    this.input.focus();
  }
}
