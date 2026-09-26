/**
 * SVG star-schema graph with filter-context highlight.
 */

import { tables, relationships } from '../data/model.js';

/**
 * @param {SVGSVGElement} svg
 * @param {{ filters: Record<string, string[]>, activeTables: Set<string> }} state
 */
export function renderModelGraph(svg, state) {
  const NS = 'http://www.w3.org/2000/svg';
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  /** @type {Record<string, { x: number, y: number, w: number, h: number }>} */
  const boxes = {
    Products: { x: 24, y: 24, w: 100, h: 44 },
    Customer: { x: 236, y: 24, w: 100, h: 44 },
    Calendar: { x: 130, y: 160, w: 100, h: 44 },
    Sales: { x: 130, y: 88, w: 100, h: 44 },
  };

  // relationship edges
  for (const rel of relationships) {
    const a = boxes[rel.fromTable];
    const b = boxes[rel.toTable];
    if (!a || !b) continue;
    const cx1 = a.x + a.w / 2;
    const cy1 = a.y + a.h / 2;
    const cx2 = b.x + b.w / 2;
    const cy2 = b.y + b.h / 2;
    const lit = state.activeTables.has(rel.fromTable) && state.activeTables.has(rel.toTable);
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(cx1));
    line.setAttribute('y1', String(cy1));
    line.setAttribute('x2', String(cx2));
    line.setAttribute('y2', String(cy2));
    line.setAttribute('stroke', lit ? '#f2c811' : '#2a3548');
    line.setAttribute('stroke-width', lit ? '2' : '1');
    svg.appendChild(line);
  }

  for (const t of tables) {
    const b = boxes[t.name];
    if (!b) continue;
    const active = state.activeTables.has(t.name);
    const g = document.createElementNS(NS, 'g');

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(b.x));
    rect.setAttribute('y', String(b.y));
    rect.setAttribute('width', String(b.w));
    rect.setAttribute('height', String(b.h));
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', t.role === 'fact' ? '#2b4c7e' : '#1e3a5f');
    rect.setAttribute('stroke', active ? '#f2c811' : '#2a3548');
    rect.setAttribute('stroke-width', active ? '1.5' : '1');
    g.appendChild(rect);

    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', String(b.x + b.w / 2));
    label.setAttribute('y', String(b.y + b.h / 2 - 4));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#e8eef8');
    label.setAttribute('font-size', '12');
    label.setAttribute('font-family', 'Segoe UI, sans-serif');
    label.textContent = t.name;
    g.appendChild(label);

    const role = document.createElementNS(NS, 'text');
    role.setAttribute('x', String(b.x + b.w / 2));
    role.setAttribute('y', String(b.y + b.h / 2 + 12));
    role.setAttribute('text-anchor', 'middle');
    role.setAttribute('fill', active ? '#f2c811' : '#8b9bb4');
    role.setAttribute('font-size', '9');
    role.setAttribute('font-family', 'ui-monospace, monospace');
    role.textContent = active ? 'filtered' : t.role;
    g.appendChild(role);

    svg.appendChild(g);
  }
}
