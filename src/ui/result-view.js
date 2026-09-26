/**
 * Result rendering: scalars and tables.
 */

/**
 * @param {HTMLElement} root
 * @param {HTMLElement} meta
 * @param {any} value
 * @param {string | null} error
 */
export function renderResult(root, meta, value, error) {
  root.innerHTML = '';
  if (error) {
    meta.textContent = '';
    const div = document.createElement('div');
    div.className = 'result-scalar err';
    div.textContent = error;
    root.appendChild(div);
    return;
  }
  if (!value) {
    meta.textContent = '';
    return;
  }
  if (value.kind === 'scalar') {
    meta.textContent = `scalar · ${value.type}`;
    const div = document.createElement('div');
    div.className = 'result-scalar';
    if (value.type === 'blank' || value.value === null) div.textContent = 'BLANK';
    else if (typeof value.value === 'number') {
      div.textContent = formatNum(value.value);
    } else div.textContent = String(value.value);
    root.appendChild(div);
    return;
  }

  meta.textContent = `table · ${value.rows.length} row(s) · ${value.columns.length} col(s)`;
  const table = document.createElement('table');
  table.className = 'grid';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const c of value.columns) {
    const th = document.createElement('th');
    th.textContent = shortCol(c);
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  const max = Math.min(value.rows.length, 50);
  for (let i = 0; i < max; i += 1) {
    const tr = document.createElement('tr');
    for (const c of value.columns) {
      const td = document.createElement('td');
      const v = value.rows[i][c];
      const isNum = typeof v === 'number';
      if (isNum) td.className = 'num';
      td.textContent = v === null || v === undefined ? '' : formatCell(v);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  root.appendChild(table);
  if (value.rows.length > max) {
    const more = document.createElement('div');
    more.className = 'result-meta';
    more.textContent = `… ${value.rows.length - max} more rows`;
    root.appendChild(more);
  }
}

/**
 * @param {string} c
 */
function shortCol(c) {
  const i = c.indexOf('[');
  return i >= 0 ? c.slice(i + 1, -1) : c;
}

/**
 * @param {number} n
 */
function formatNum(n) {
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return n.toLocaleString('en-US', { maximumFractionDigits: 10 });
}

/**
 * @param {unknown} v
 */
function formatCell(v) {
  if (typeof v === 'number') return formatNum(v);
  return String(v);
}
