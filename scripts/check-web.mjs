import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { spawn } from 'node:child_process';

async function findJavaScriptFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJavaScriptFiles(path));
    } else if (extname(entry.name) === '.js') {
      files.push(path);
    }
  }
  return files;
}

const files = await findJavaScriptFiles('web');
let failed = false;

for (const file of files) {
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['--check', file], { stdio: 'inherit' });
    child.once('close', (code) => resolve(code ?? 1));
    child.once('error', () => resolve(1));
  });
  if (result !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;
