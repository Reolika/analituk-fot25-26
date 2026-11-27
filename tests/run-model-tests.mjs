// Прогон автотестов модели без браузера: те же скрипты и тот же код проверок,
// что и в test.html. DOM-заглушка нужна только для вывода результата.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = name => readFileSync(join(root, name), 'utf8');

const html = read('test.html');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('В test.html не найден встроенный скрипт с проверками');
  process.exit(1);
}

const output = { text: '' };
const sandbox = {
  console,
  Math,
  JSON,
  Number,
  Object,
  Array,
  Set,
  Map,
  String,
  Boolean,
  Date,
  Intl,
  parseFloat,
  parseInt,
  isFinite,
  isNaN,
  document: {
    getElementById: () => ({ set textContent(value) { output.text = value; } })
  }
};
vm.createContext(sandbox);

for (const file of ['data.js', 'model.js']) {
  vm.runInContext(read(file), sandbox, { filename: file });
}
vm.runInContext(scriptMatch[1], sandbox, { filename: 'test.html inline' });

const text = output.text || '';
const lines = text.split('\n').filter(line => /✔|✗|FAIL|✅|❌/.test(line));
const failed = (text.match(/FAIL|❌/g) || []).length;

console.log(text.trim() || '(нет вывода)');
console.log('\nпровалов: ' + failed);
process.exit(failed ? 1 : 0);
