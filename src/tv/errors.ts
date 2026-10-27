export class TvError extends Error {
  readonly uri: string;
  constructor(message: string, uri: string) { super(message); this.uri = uri; this.name = new.target.name; }
}
export class TvUnreachableError extends TvError {}
export class TvAuthError extends TvError {}
export class TvPairingError extends TvError {
  readonly result: string;
  constructor(result: string, uri: string) { super(result, uri); this.result = result; }
}
export class TvHashvalError extends TvError {}
export class TvCommandError extends TvError {
  readonly result: string;
  readonly detail: string;
  constructor(result: string, detail: string, uri: string) { super(`${result}: ${detail}`, uri); this.result = result; this.detail = detail; }
}
export class TvProtocolError extends TvError {}
