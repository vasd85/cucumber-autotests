import createDebug from 'debug';

const ROOT_NAMESPACE = 'tradegenius';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Per-module logger. Wraps the `debug` package so namespaces can be toggled
 * via `DEBUG=tradegenius:*` (or more specific filters). `no-console` is an
 * ESLint error everywhere in the project — this module is the single
 * permitted console fallback for levels that the `debug` package does not
 * surface loudly enough on its own (warn / error).
 */
export class Logger {
  private readonly moduleName: string;
  private readonly debugFns: Record<LogLevel, createDebug.Debugger>;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
    this.debugFns = {
      debug: createDebug(`${ROOT_NAMESPACE}:${moduleName}:debug`),
      info: createDebug(`${ROOT_NAMESPACE}:${moduleName}:info`),
      warn: createDebug(`${ROOT_NAMESPACE}:${moduleName}:warn`),
      error: createDebug(`${ROOT_NAMESPACE}:${moduleName}:error`),
    };
  }

  debug(message: string, ...args: unknown[]): void {
    this.debugFns.debug(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.debugFns.info(message, ...args);
  }

  /**
   * Warn level always surfaces. `debug` stays silent unless the namespace is
   * enabled, so a console fallback guarantees warnings are visible during CI
   * without forcing DEBUG to be configured.
   */
  warn(message: string, ...args: unknown[]): void {
    this.debugFns.warn(message, ...args);
    // eslint-disable-next-line no-console
    console.warn(`[${this.moduleName}] ${message}`, ...args);
  }

  /**
   * Error level always surfaces for the same reason as `warn`.
   */
  error(message: string, ...args: unknown[]): void {
    this.debugFns.error(message, ...args);
    // eslint-disable-next-line no-console
    console.error(`[${this.moduleName}] ${message}`, ...args);
  }
}
