/**
 * DAX lexer.
 */

/**
 * @typedef {object} Token
 * @property {string} type  number | string | identifier | tablecol | punct | eof
 * @property {string} value
 * @property {number} pos
 */

export class DaxSyntaxError extends Error {
  /**
   * @param {string} message
   * @param {number} [pos]
   */
  constructor(message, pos = 0) {
    super(message);
    this.name = 'DaxSyntaxError';
    this.pos = pos;
  }
}

const PUNCT = [
  '&&', '||', '<=', '>=', '<>', ':=',
  '+', '-', '*', '/', '^', '(', ')', ',', '=', '<', '>', '!', '&', '|', '{', '}', '[', ']', '.',
];

/**
 * @param {string} source
 * @returns {Token[]}
 */
export function tokenize(source) {
  /** @type {Token[]} */
  const tokens = [];
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    // comments
    if (ch === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }

    // string
    if (ch === '"') {
      const start = i;
      i += 1;
      let out = '';
      while (i < n) {
        if (source[i] === '"' && source[i + 1] === '"') {
          out += '"';
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          i += 1;
          break;
        }
        out += source[i];
        i += 1;
      }
      tokens.push({ type: 'string', value: out, pos: start });
      continue;
    }

    // table[Column] — also allow bare identifiers
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      while (i < n && /[A-Za-z0-9_.]/.test(source[i])) i += 1;
      const name = source.slice(start, i);
      // table[Column]
      if (source[i] === '[') {
        i += 1;
        const colStart = i;
        while (i < n && source[i] !== ']') i += 1;
        if (source[i] !== ']') {
          throw new DaxSyntaxError('Unterminated [column] reference', start);
        }
        const column = source.slice(colStart, i);
        i += 1;
        tokens.push({ type: 'tablecol', value: `${name}[${column}]`, pos: start });
        continue;
      }
      tokens.push({ type: 'identifier', value: name, pos: start });
      continue;
    }

    // [Column] alone
    if (ch === '[') {
      const start = i;
      i += 1;
      const colStart = i;
      while (i < n && source[i] !== ']') i += 1;
      if (source[i] !== ']') {
        throw new DaxSyntaxError('Unterminated [column] reference', start);
      }
      const column = source.slice(colStart, i);
      i += 1;
      tokens.push({ type: 'tablecol', value: `[${column}]`, pos: start });
      continue;
    }

    // number
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] || ''))) {
      const start = i;
      while (i < n && /[0-9._]/.test(source[i])) i += 1;
      // scientific notation
      if (source[i] === 'e' || source[i] === 'E') {
        i += 1;
        if (source[i] === '+' || source[i] === '-') i += 1;
        while (i < n && /[0-9]/.test(source[i])) i += 1;
      }
      const raw = source.slice(start, i).replace(/_/g, '');
      const num = Number(raw);
      if (Number.isNaN(num)) {
        throw new DaxSyntaxError(`Invalid number '${raw}'`, start);
      }
      tokens.push({ type: 'number', value: raw, pos: start });
      continue;
    }

    // date literal #yyyy-mm-dd#
    if (ch === '#') {
      const start = i;
      i += 1;
      const end = source.indexOf('#', i);
      if (end < 0) {
        throw new DaxSyntaxError('Unterminated date literal', start);
      }
      tokens.push({ type: 'date', value: source.slice(i, end), pos: start });
      i = end + 1;
      continue;
    }

    // punct
    let matched = false;
    for (const p of PUNCT) {
      if (source.startsWith(p, i)) {
        tokens.push({ type: 'punct', value: p, pos: i });
        i += p.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    throw new DaxSyntaxError(`Unexpected character '${ch}'`, i);
  }

  tokens.push({ type: 'eof', value: '', pos: n });
  return tokens;
}
