import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const skip = new Set(['node_modules', '.git', '.pi-workflow', '.multitool']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === '.js') out.push(full);
  }
  return out;
}

const files = walk(root);
let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log('ok   ' + file.slice(root.length + 1));
  } catch (e) {
    failed++;
    const msg = (e.stderr || e.stdout || '').toString().trim();
    console.log('FAIL ' + file.slice(root.length + 1) + '\n' + msg);
  }
}

console.log('\nchecked ' + files.length + ' files, failed ' + failed);
process.exit(failed ? 1 : 0);
