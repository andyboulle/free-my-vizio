type Fields = Record<string, unknown>;
const secrets = new Set<string>(); const ring: string[] = [];
const sensitive = /auth|token|secret|password|authorization|cookie|key/i;
function redact(value: unknown): unknown {
  if (typeof value === 'string') { let out = value; for (const s of secrets) if (s) out = out.split(s).join('[REDACTED]'); return out; }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sensitive.test(k) ? '[REDACTED]' : redact(v)]));
  return value;
}
function write(level: string, event: string, fields: Fields): void { const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(redact(fields) as Fields) }); ring.push(line); if (ring.length > 500) ring.shift(); process.stdout.write(line + '\n'); }
export const log = { info: (e: string, f: Fields = {}) => write('info', e, f), warn: (e: string, f: Fields = {}) => write('warn', e, f), error: (e: string, f: Fields = {}) => write('error', e, f), debug: (e: string, f: Fields = {}) => write('debug', e, f), registerSecret: (v: string) => { if (v) secrets.add(v); }, getRing: () => [...ring] };
