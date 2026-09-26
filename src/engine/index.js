/**
 * Public engine API.
 */

export { tokenize, DaxSyntaxError } from './lexer.js';
export { parseDax, collectFunctions } from './parser.js';
export {
  evaluate,
  createEnv,
  DaxEvalError,
  SUPPORTED_FUNCTIONS,
} from './evaluator.js';
export {
  emptyFilterContext,
  cloneFilterContext,
  setFilter,
  filterTableRows,
} from './context.js';
export {
  scalar,
  blank,
  isBlank,
  toNumber,
  toJsString,
  toJsBool,
  toRaw,
  valueEquals,
} from './functions.js';
export { tables, relationships, getTable, getColumn, colId } from '../data/model.js';

import { parseDax } from './parser.js';
import { evaluate, createEnv } from './evaluator.js';

/**
 * Parse and evaluate a DAX source string.
 * @param {string} source
 * @param {import('./evaluator.js').Env} [env]
 * @returns {import('./functions.js').Value}
 */
export function runDax(source, env = createEnv()) {
  return evaluate(parseDax(source), env);
}
