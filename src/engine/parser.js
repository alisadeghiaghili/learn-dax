/**
 * DAX expression parser → AST.
 *
 * Grammar (subset):
 *   expr      := orExpr
 *   orExpr    := andExpr (('||' | 'OR') andExpr)*
 *   andExpr   := notExpr (('&&' | 'AND') notExpr)*
 *   notExpr   := ('NOT' | '!') notExpr | cmpExpr
 *   cmpExpr   := addExpr (('=' | '<>' | '<' | '>' | '<=' | '>=') addExpr)*
 *               | addExpr 'IN' listExpr | addExpr 'NOT' 'IN' listExpr
 *   addExpr   := mulExpr (('+' | '-') mulExpr)*
 *   mulExpr   := powExpr (('*' | '/') powExpr)*
 *   powExpr   := unary ('^' unary)*
 *   unary     := '-' unary | postfix
 *   postfix   := primary
 *   primary   := number | string | date | boolean | blank
 *              | tablecol | identifier | identifier '(' args ')'
 *              | '(' expr ')' | '{' expr (',' expr)* '}'   // table constructor
 *   varDecl   := 'VAR' name '=' expr  ... 'RETURN' expr
 */

import { tokenize, DaxSyntaxError } from './lexer.js';

export { DaxSyntaxError };

/**
 * @typedef {object} Ast
 * @property {string} type
 */

class Parser {
  /** @param {import('./lexer.js').Token[]} tokens */
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }

  peek() {
    return this.tokens[this.i];
  }

  next() {
    const t = this.tokens[this.i];
    this.i += 1;
    return t;
  }

  /**
   * @param {string} type
   * @param {string} [value]
   */
  match(type, value) {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== undefined && t.value.toLowerCase() !== value.toLowerCase()) return false;
    this.i += 1;
    return true;
  }

  /**
   * @param {string} type
   * @param {string} [value]
   */
  expect(type, value) {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value.toLowerCase() !== value.toLowerCase())) {
      const got = t.value || t.type;
      throw new DaxSyntaxError(`Expected ${value || type}, got '${got}'`, t.pos);
    }
    return this.next();
  }

  parseProgram() {
    // VAR ... RETURN ...
    /** @type {{ name: string, expr: Ast }[]} */
    const vars = [];
    while (this.peek().type === 'identifier' && this.peek().value.toLowerCase() === 'var') {
      this.next();
      const name = this.expect('identifier').value;
      this.expect('punct', '=');
      const expr = this.parseExpr();
      vars.push({ name, expr });
    }
    if (vars.length > 0) {
      this.expect('identifier', 'return');
      const body = this.parseExpr();
      return { type: 'VarReturn', vars, body };
    }
    return this.parseExpr();
  }

  parseExpr() {
    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    for (;;) {
      if (this.match('punct', '||')) {
        const right = this.parseAnd();
        left = { type: 'Binary', op: '||', left, right };
      } else if (this.peek().type === 'identifier' && this.peek().value.toLowerCase() === 'or') {
        this.next();
        const right = this.parseAnd();
        left = { type: 'Binary', op: '||', left, right };
      } else {
        return left;
      }
    }
  }

  parseAnd() {
    let left = this.parseNot();
    for (;;) {
      if (this.match('punct', '&&')) {
        const right = this.parseNot();
        left = { type: 'Binary', op: '&&', left, right };
      } else if (this.peek().type === 'identifier' && this.peek().value.toLowerCase() === 'and') {
        this.next();
        const right = this.parseNot();
        left = { type: 'Binary', op: '&&', left, right };
      } else {
        return left;
      }
    }
  }

  parseNot() {
    if (this.match('punct', '!')) {
      return { type: 'Unary', op: '!', expr: this.parseNot() };
    }
    if (this.peek().type === 'identifier' && this.peek().value.toLowerCase() === 'not') {
      this.next();
      return { type: 'Unary', op: '!', expr: this.parseNot() };
    }
    return this.parseCmp();
  }

  parseCmp() {
    let left = this.parseAdd();

    // NOT IN / IN
    if (this.peek().type === 'identifier' && this.peek().value.toLowerCase() === 'in') {
      this.next();
      const list = this.parseInList();
      left = { type: 'Binary', op: 'IN', left, right: list };
      return left;
    }
    if (
      this.peek().type === 'identifier' &&
      this.peek().value.toLowerCase() === 'not' &&
      this.tokens[this.i + 1] &&
      this.tokens[this.i + 1].type === 'identifier' &&
      this.tokens[this.i + 1].value.toLowerCase() === 'in'
    ) {
      this.next();
      this.next();
      const list = this.parseInList();
      return { type: 'Unary', op: '!', expr: { type: 'Binary', op: 'IN', left, right: list } };
    }

    const ops = ['=', '<>', '<', '>', '<=', '>='];
    const t = this.peek();
    if (t.type === 'punct' && ops.includes(t.value)) {
      this.next();
      const right = this.parseAdd();
      return { type: 'Binary', op: t.value, left, right };
    }
    return left;
  }

  parseInList() {
    if (this.match('punct', '{')) {
      /** @type {Ast[]} */
      const items = [];
      if (!this.match('punct', '}')) {
        items.push(this.parseExpr());
        while (this.match('punct', ',')) {
          items.push(this.parseExpr());
        }
        this.expect('punct', '}');
      }
      return { type: 'List', items };
    }
    // IN table expression (VALUES / { } / function)
    return { type: 'List', items: [this.parseAdd()] };
  }

  parseAdd() {
    let left = this.parseMul();
    for (;;) {
      const t = this.peek();
      if (t.type === 'punct' && (t.value === '+' || t.value === '-')) {
        this.next();
        const right = this.parseMul();
        left = { type: 'Binary', op: t.value, left, right };
      } else {
        return left;
      }
    }
  }

  parseMul() {
    let left = this.parsePow();
    for (;;) {
      const t = this.peek();
      if (t.type === 'punct' && (t.value === '*' || t.value === '/')) {
        this.next();
        const right = this.parsePow();
        left = { type: 'Binary', op: t.value, left, right };
      } else {
        return left;
      }
    }
  }

  parsePow() {
    let left = this.parseUnary();
    for (;;) {
      if (this.match('punct', '^')) {
        const right = this.parseUnary();
        left = { type: 'Binary', op: '^', left, right };
      } else {
        return left;
      }
    }
  }

  parseUnary() {
    if (this.match('punct', '-')) {
      return { type: 'Unary', op: '-', expr: this.parseUnary() };
    }
    if (this.match('punct', '+')) {
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const t = this.peek();

    if (t.type === 'number') {
      this.next();
      return { type: 'Number', value: Number(t.value) };
    }
    if (t.type === 'string') {
      this.next();
      return { type: 'String', value: t.value };
    }
    if (t.type === 'date') {
      this.next();
      return { type: 'Date', value: t.value };
    }
    if (t.type === 'tablecol') {
      this.next();
      return { type: 'ColumnRef', name: t.value };
    }
    if (this.match('punct', '(')) {
      const expr = this.parseExpr();
      this.expect('punct', ')');
      return expr;
    }
    if (this.match('punct', '{')) {
      /** @type {Ast[]} */
      const items = [];
      if (!this.match('punct', '}')) {
        items.push(this.parseExpr());
        while (this.match('punct', ',')) {
          items.push(this.parseExpr());
        }
        this.expect('punct', '}');
      }
      return { type: 'TableConstructor', items };
    }
    if (t.type === 'identifier') {
      this.next();
      const name = t.value;
      const lower = name.toLowerCase();
      if (lower === 'true') return { type: 'Boolean', value: true };
      if (lower === 'false') return { type: 'Boolean', value: false };
      if (lower === 'blank') return { type: 'Blank' };

      if (this.match('punct', '(')) {
        /** @type {Ast[]} */
        const args = [];
        if (!this.match('punct', ')')) {
          args.push(this.parseExpr());
          while (this.match('punct', ',')) {
            args.push(this.parseExpr());
          }
          this.expect('punct', ')');
        }
        return { type: 'Call', name, args };
      }

      // bare table name or measure name
      return { type: 'Name', name };
    }

    throw new DaxSyntaxError(`Unexpected '${t.value || t.type}'`, t.pos);
  }
}

/**
 * @param {string} source
 * @returns {Ast}
 */
export function parseDax(source) {
  const tokens = tokenize(source);
  const p = new Parser(tokens);
  const ast = p.parseProgram();
  if (p.peek().type !== 'eof') {
    throw new DaxSyntaxError(`Unexpected trailing '${p.peek().value}'`, p.peek().pos);
  }
  return ast;
}

/**
 * Collect function names referenced in an AST (case-preserving first hit).
 * @param {Ast} ast
 * @returns {string[]}
 */
export function collectFunctions(ast) {
  /** @type {Set<string>} */
  const found = new Set();

  /** @param {Ast | undefined} node */
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Call') {
      found.add(node.name.toLowerCase());
      for (const a of node.args || []) walk(a);
      return;
    }
    if (node.type === 'Binary') {
      walk(node.left);
      walk(node.right);
      return;
    }
    if (node.type === 'Unary') {
      walk(node.expr);
      return;
    }
    if (node.type === 'List' || node.type === 'TableConstructor') {
      for (const item of node.items || []) walk(item);
      return;
    }
    if (node.type === 'VarReturn') {
      for (const v of node.vars || []) walk(v.expr);
      walk(node.body);
      return;
    }
    if (node.args) {
      for (const a of node.args) walk(a);
    }
  }

  walk(ast);
  return [...found];
}
