/**
 * Logger Module for Zano Quiz Bot
 * Handles standardized logging across the application
 */

/**
 * Log levels
 */
const LOG_LEVELS = {
  ERROR: "ERROR",
  WARN: "WARN",
  INFO: "INFO",
  DEBUG: "DEBUG",
};

/**
 * Simple logger implementation
 * Replace with more sophisticated logging as needed
 */
class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || LOG_LEVELS.INFO;
    this.logToConsole = true;
  }

  /**
   * Format the log message with timestamp and metadata
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {string} Formatted log message
   */
  formatLogMessage(level, message, meta = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;

    if (meta) {
      if (meta instanceof Error) {
        logMessage += `\n  ${meta.stack || meta.message}`;
      } else if (typeof meta === "object") {
        try {
          logMessage += `\n  ${JSON.stringify(meta)}`;
        } catch (e) {
          logMessage += `\n  [Object: circular reference or non-serializable]`;
        }
      } else {
        logMessage += `\n  ${meta}`;
      }
    }

    return logMessage;
  }

  /**
   * Log error messages
   * @param {string} message - Error message
   * @param {Object} meta - Additional error metadata
   */
  error(message, meta = null) {
    const logMessage = this.formatLogMessage(LOG_LEVELS.ERROR, message, meta);

    // Always log errors
    console.error(logMessage);
  }

  /**
   * Log warning messages
   * @param {string} message - Warning message
   * @param {Object} meta - Additional warning metadata
   */
  warn(message, meta = null) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      const logMessage = this.formatLogMessage(LOG_LEVELS.WARN, message, meta);
      console.warn(logMessage);
    }
  }

  /**
   * Log info messages
   * @param {string} message - Info message
   * @param {Object} meta - Additional info metadata
   */
  info(message, meta = null) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      const logMessage = this.formatLogMessage(LOG_LEVELS.INFO, message, meta);
      console.info(logMessage);
    }
  }

  /**
   * Log debug messages
   * @param {string} message - Debug message
   * @param {Object} meta - Additional debug metadata
   */
  debug(message, meta = null) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      const logMessage = this.formatLogMessage(LOG_LEVELS.DEBUG, message, meta);
      console.debug(logMessage);
    }
  }

  /**
   * Determine if message should be logged based on current level
   * @param {string} messageLevel - Level of the message
   * @returns {boolean} Whether the message should be logged
   */
  shouldLog(messageLevel) {
    const levels = Object.values(LOG_LEVELS);
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(messageLevel);

    return messageLevelIndex <= currentLevelIndex && this.logToConsole;
  }
}

// Create and export singleton logger instance
const logger = new Logger();
module.exports = logger;
