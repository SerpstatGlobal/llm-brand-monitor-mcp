import { LogLevel } from './types.js';

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export interface Logger {
  error(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
}

export function createLogger(level: LogLevel): Logger {
  const threshold = LEVELS[level];

  function log(lvl: LogLevel, msg: string, args: unknown[]): void {
    if (LEVELS[lvl] > threshold) return;
    const ts = new Date().toISOString();
    const prefix = `[${lvl.toUpperCase()}] ${ts}`;
    if (args.length > 0) {
      console.error(prefix, msg, ...args);
    } else {
      console.error(prefix, msg);
    }
  }

  return {
    error: (msg, ...args) => log('error', msg, args),
    warn: (msg, ...args) => log('warn', msg, args),
    info: (msg, ...args) => log('info', msg, args),
    debug: (msg, ...args) => log('debug', msg, args),
  };
}
