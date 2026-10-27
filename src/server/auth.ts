import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function constantTimeEqual(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
export function adminAuthorized(req: IncomingMessage, token: string): boolean {
  const value = req.headers.authorization;
  if (!value) return false;
  const match = /^Bearer ([^\s]+)$/i.exec(value);
  return Boolean(match && constantTimeEqual(match[1], token));
}
export function tvAuthorized(req: IncomingMessage, token: string): boolean {
  return constantTimeEqual(typeof req.headers['x-fmv-token'] === 'string' ? req.headers['x-fmv-token'] : undefined, token);
}
export function unauthorized(res: ServerResponse): void {
  res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unauthorized' }));
}
export function canonicalHost(value: string | undefined): string {
  if (!value) return '';
  if (value.startsWith('[')) return value.slice(1, value.indexOf(']')).toLowerCase();
  return value.replace(/:\d+$/, '').toLowerCase();
}
export const parseHost = canonicalHost;
export const isAllowedHost = hostAllowed;
export function hostAllowed(value: string | undefined, allowed: Iterable<string>): boolean {
  const host = canonicalHost(value); return [...allowed].some(x => canonicalHost(x) === host);
}
