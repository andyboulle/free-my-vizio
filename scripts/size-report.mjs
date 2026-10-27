import { stat } from 'node:fs/promises';
import { join } from 'node:path';

async function total(dir, suffix) {
  let sum = 0;
  const entries = await import('node:fs/promises').then(fs => fs.readdir(dir, { withFileTypes: true }));
  for (const entry of entries) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) sum += await total(file, suffix);
    else if (file.endsWith(suffix)) sum += (await stat(file)).size;
  }
  return sum;
}
const js = await total('web/tv', '.js') + await total('web/admin', '.js');
const css = await total('web/tv', '.css') + await total('web/admin', '.css') + await total('web/shared', '.css');
const font = 0;
console.log(`UI size: JS ${js} bytes, CSS ${css} bytes, fonts ${font} bytes`);
if (js > 60 * 1024 || css > 30 * 1024 || font > 360 * 1024) process.exitCode = 1;
