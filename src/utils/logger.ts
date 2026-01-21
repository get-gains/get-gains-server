import { styleText } from 'node:util';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

type InspectColor = Parameters<typeof styleText>[0];

const LOG_LEVEL_COLORS: Record<LogLevel, InspectColor> = {
  [LogLevel.DEBUG]: ['bold', 'gray'],
  [LogLevel.INFO]: ['bold', 'cyan'],
  [LogLevel.WARN]: ['bold', 'yellow'],
  [LogLevel.ERROR]: ['bold', 'red'],
};

class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = LogLevel.DEBUG) {
    this.minLevel = minLevel;
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level < this.minLevel) return;

    const timestamp = styleText('gray', this.formatTimestamp());
    const levelName = styleText(
      LOG_LEVEL_COLORS[level],
      LOG_LEVEL_NAMES[level].padEnd(5)
    );

    const formattedMessage =
      level === LogLevel.ERROR ? styleText('red', message) : message;

    console.log(`${timestamp} [${levelName}] ${formattedMessage}`, ...args);

    // For errors, also log the stack trace if an Error object is provided
    if (level === LogLevel.ERROR && args.length > 0) {
      args.forEach((arg) => {
        if (arg instanceof Error && arg.stack) {
          console.log(styleText('red', arg.stack));
        }
      });
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }
}

// Parse log level from environment variable
const parseLogLevel = (level: string | undefined): LogLevel => {
  switch (level?.toUpperCase()) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    default:
      return LogLevel.DEBUG;
  }
};

// Export a singleton instance
export const logger = new Logger(parseLogLevel(process.env.LOG_LEVEL));

// Export the class for custom instances
export { Logger };
