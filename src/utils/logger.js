/**
 * LOGGER
 * Centralized logging with different levels and colors
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 2,
  WARN: 3,
  ERROR: 4,
};

const COLORS = {
  DEBUG: '\x1b[36m',    // Cyan
  INFO: '\x1b[34m',     // Blue
  SUCCESS: '\x1b[32m',  // Green
  WARN: '\x1b[33m',     // Yellow
  ERROR: '\x1b[31m',    // Red
  RESET: '\x1b[0m',
};

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.logsDir = path.join(__dirname, '../../logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Format timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Write to log file
   */
  writeToFile(level, message, data) {
    const logFile = path.join(
      this.logsDir,
      `${new Date().toISOString().split('T')[0]}.log`
    );

    const logEntry = `[${this.getTimestamp()}] [${level}] ${message}${
      data ? ' ' + JSON.stringify(data) : ''
    }\n`;

    fs.appendFileSync(logFile, logEntry);
  }

  /**
   * Main logging function
   */
  log(level, message, data = null) {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.logLevel]) {
      return;
    }

    const timestamp = this.getTimestamp();
    const color = COLORS[level];
    const reset = COLORS.RESET;

    // Console output
    const consoleMessage = `${color}[${timestamp}] [${level}]${reset} ${message}`;
    console.log(consoleMessage, data ? data : '');

    // File output
    this.writeToFile(level, message, data);
  }

  debug(message, data) {
    this.log('DEBUG', message, data);
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  success(message, data) {
    this.log('SUCCESS', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }
}

module.exports = new Logger();
