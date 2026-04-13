import winston from 'winston';

/**
 * Centralized Winston logger.
 * - In development: colorized, human-readable console output
 * - Timestamps on every log line
 * - Log levels: error > warn > info > debug
 */
const { combine, timestamp, colorize, printf, errors } = winston.format;

// Custom log format: [timestamp] LEVEL: message (+ stack trace on errors)
const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return stack
    ? `[${ts}] ${level}: ${message}\n${stack}`
    : `[${ts}] ${level}: ${message}`;
});

const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // capture stack traces
    colorize(),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

export default logger;
