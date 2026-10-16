import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["authorization"]',
      'req.headers.cookie',
      'req.body.access_token',
      'access_token',
      'token',
      'authorization',
      'secret',
      'password'
    ],
    censor: '[REDACTED]'
  },
  transport:
    !isProduction && process.env.NODE_ENV !== 'test'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});

export type Logger = typeof logger;
