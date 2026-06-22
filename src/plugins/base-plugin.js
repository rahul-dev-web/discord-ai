/**
 * BASE PLUGIN
 * All plugins should extend this class
 */

const Logger = require('../utils/logger');

class BasePlugin {
  constructor(client) {
    this.client = client;
    this.name = 'BasePlugin';
    this.version = '1.0.0';
    this.description = 'Base plugin class';
    this.enabled = true;
  }

  /**
   * Initialize plugin (called on load)
   */
  async init() {
    Logger.info(`Initializing plugin: ${this.name}`);
  }

  /**
   * Handle incoming messages
   */
  async onMessage(message) {
    // Override in subclass
  }

  /**
   * Handle voice state updates
   */
  async onVoiceStateUpdate(oldState, newState) {
    // Override in subclass
  }

  /**
   * Handle interactions
   */
  async onInteraction(interaction) {
    // Override in subclass
  }

  /**
   * Cleanup on unload
   */
  async cleanup() {
    Logger.info(`Cleaning up plugin: ${this.name}`);
  }

  /**
   * Get plugin info
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      enabled: this.enabled,
    };
  }

  /**
   * Enable plugin
   */
  enable() {
    this.enabled = true;
    Logger.info(`Enabled: ${this.name}`);
  }

  /**
   * Disable plugin
   */
  disable() {
    this.enabled = false;
    Logger.info(`Disabled: ${this.name}`);
  }

  /**
   * Safe wrapper for async operations
   */
  async safeExecute(fn, errorMessage) {
    try {
      return await fn();
    } catch (error) {
      Logger.error(`${this.name} error: ${errorMessage}`, error);
      return null;
    }
  }
}

module.exports = BasePlugin;
