/**
 * Modal helpers for level intro and level browser.
 */

/**
 * @param {HTMLElement} root
 * @param {HTMLElement} content
 * @returns {() => void} close
 */
export function openModal(root, content) {
  root.innerHTML = '';
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.appendChild(content);
  backdrop.appendChild(modal);
  root.appendChild(backdrop);

  const close = () => {
    root.innerHTML = '';
  };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  return close;
}

/**
 * @param {object} opts
 * @param {string} opts.series
 * @param {string} opts.name
 * @param {string} opts.intro
 * @param {string} [opts.why]
 * @param {string} opts.hint
 * @param {number} opts.index
 * @param {number} opts.total
 * @param {() => void} opts.onStart
 * @param {() => void} opts.onHint
 */
export function showLevelIntro(opts) {
  const root = document.getElementById('modal-root');
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="series">${escapeHtml(opts.series)} · level ${opts.index}/${opts.total}</div>
    <h2>${escapeHtml(opts.name)}</h2>
    <p>${escapeHtml(opts.intro)}</p>
    ${opts.why ? `<p class="why"><strong>Why it matters.</strong> ${escapeHtml(opts.why)}</p>` : ''}
    <div class="hint">Goal checked on the next eval / measure submit. Hint via <code>hint</code>.</div>
    <div class="modal-actions">
      <button class="btn" data-act="hint">Hint</button>
      <button class="btn primary" data-act="start">Start</button>
    </div>
  `;
  const close = openModal(root, content);
  content.querySelector('[data-act="start"]')?.addEventListener('click', () => {
    close();
    opts.onStart();
  });
  content.querySelector('[data-act="hint"]')?.addEventListener('click', () => {
    opts.onHint();
    close();
  });
}

/**
 * @param {import('../levels/definitions.js').Level[]} levels
 * @param {Record<string, number>} progress
 * @param {(level: any) => void} onPick
 */
export function showLevelBrowser(levels, progress, onPick) {
  const root = document.getElementById('modal-root');
  const content = document.createElement('div');
  content.innerHTML = `<h2>Levels</h2><div class="level-list" id="level-list"></div>
    <div class="modal-actions"><button class="btn" data-act="close">Close</button></div>`;
  const list = content.querySelector('#level-list');
  levels.forEach((lv, i) => {
    const solved = progress[lv.id];
    const row = document.createElement('div');
    row.className = `level-row${solved ? ' solved' : ''}`;
    row.innerHTML = `
      <div class="n">${i + 1}</div>
      <div>
        <div class="name">${escapeHtml(lv.name)}</div>
        <div class="meta">${escapeHtml(lv.series)}${solved ? ` · solved in ${solved}` : ''}</div>
      </div>
      <div class="meta">${solved ? '✓' : ''}</div>
    `;
    row.addEventListener('click', () => {
      close();
      onPick(lv);
    });
    list?.appendChild(row);
  });
  const close = openModal(root, content);
  content.querySelector('[data-act="close"]')?.addEventListener('click', close);
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
