import fs from 'fs';
import { getLogFilePath } from './file.js';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

function formatLog(level: LogLevel, module: string, message: string, data?: unknown): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    data,
  };
  return JSON.stringify(entry);
}

export function log(level: LogLevel, module: string, message: string, data?: unknown): void {
  const logLine = formatLog(level, module, message, data);
  console.log(`[${level.toUpperCase()}] [${module}] ${message}`);

  const logFilePath = getLogFilePath('app');
  fs.appendFileSync(logFilePath, logLine + '\n');

  if (level === 'error') {
    const errorLogPath = getLogFilePath('error');
    fs.appendFileSync(errorLogPath, logLine + '\n');
  }
}

export const logger = {
  info: (module: string, message: string, data?: unknown) => log('info', module, message, data),
  warn: (module: string, message: string, data?: unknown) => log('warn', module, message, data),
  error: (module: string, message: string, data?: unknown) => log('error', module, message, data),
  debug: (module: string, message: string, data?: unknown) => log('debug', module, message, data),
};

export function logOperation(module: string, operation: string, userId?: string, details?: unknown): void {
  const auditLog: string = JSON.stringify({
    timestamp: new Date().toISOString(),
    module,
    operation,
    userId,
    details,
  });

  const auditLogPath = getLogFilePath('audit');
  fs.appendFileSync(auditLogPath, auditLog + '\n');
}
