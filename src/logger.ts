import winston from 'winston';
import type { Metrics } from './types';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

export function logRequest(requestId: string, question: string): void {
  logger.info('Request received', {
    requestId,
    question: question.substring(0, 100),
    timestamp: new Date().toISOString(),
  });
}

export function logMetrics(requestId: string, metrics: Metrics): void {
  logger.info('Request completed', {
    requestId,
    ...metrics,
    timestamp: new Date().toISOString(),
  });
}

export function logGuardrailBlock(requestId: string, reason: string, policy: string): void {
  logger.warn('Request blocked by guardrail', {
    requestId,
    reason,
    policy,
    timestamp: new Date().toISOString(),
  });
}
