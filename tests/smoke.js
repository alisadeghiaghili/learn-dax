/**
 * Headless smoke test: fetch page + modules, import engine/UI-independent bits,
 * and run one eval through the same path the UI uses.
 */
import http from 'node:http';

const base = 'http://127.0.0.1:5173';

/**
 * @param {string} path
 * @returns {Promise<{ status: number, text: string }>}
 */
function get(path) {
  return new Promise((resolve, reject) => {
    http.get(base + path, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        text += c;
      });
      res.on('end', () => resolve({ status: res.statusCode || 0, text }));
    }).on('error', reject);
  });
}

const assets = [
  '/',
  '/src/styles/app.css',
  '/src/ui/app.js',
  '/src/ui/terminal.js',
  '/src/ui/model-graph.js',
  '/src/ui/result-view.js',
  '/src/ui/levels-ui.js',
  '/src/engine/index.js',
  '/src/engine/evaluator.js',
  '/src/engine/parser.js',
  '/src/engine/lexer.js',
  '/src/engine/functions.js',
  '/src/engine/context.js',
  '/src/data/model.js',
  '/src/levels/definitions.js',
];

let failed = 0;
for (const path of assets) {
  const res = await get(path);
  const ok = res.status === 200 && res.text.length > 0;
  if (!ok) {
    failed += 1;
    console.error('FAIL', path, res.status);
  } else {
    console.log('ok', path, res.text.length);
  }
}

const { runDax } = await import('../src/engine/index.js');
const v = runDax('SUM(Sales[Amount])');
if (v.value !== 18310) {
  failed += 1;
  console.error('FAIL eval', v);
} else {
  console.log('ok eval SUM(Sales[Amount]) =', v.value);
}

const page = await get('/');
for (const needle of ['learnDax', 'term-input', 'model-graph', 'src/ui/app.js']) {
  if (!page.text.includes(needle)) {
    failed += 1;
    console.error('FAIL page missing', needle);
  }
}

if (failed) {
  console.error('smoke failed:', failed);
  process.exit(1);
}
console.log('smoke ok');
