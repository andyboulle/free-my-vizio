import fs from 'node:fs';
import path from 'node:path';
import type { ServerResponse } from 'node:http';

export function safeStaticPath(root: string, requestPath: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(requestPath); } catch { return null; }
  if (/%(?:2e|2f|5c)/i.test(decoded) || decoded.includes('\\')) return null;
  const relative = decoded.replace(/^\/+/, '');
  if (relative.split('/').some(part => part === '..')) return null;
  const base = path.resolve(root), result = path.resolve(base, relative);
  return result === base || result.startsWith(base + path.sep) ? result : null;
}
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpeg': 'image/jpeg', '.json': 'application/json' };
export function serveStatic(res: ServerResponse, root: string, requestPath: string): boolean {
  const file = safeStaticPath(root, requestPath === '/' ? '/index.html' : requestPath); if (!file) return false;
  let stat: fs.Stats; try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const html = path.extname(file) === '.html';
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff', ...(html ? { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'" } : {}) });
  res.end(fs.readFileSync(file)); return true;
}
