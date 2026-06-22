/**
 * EVENT BUS
 * Allows plugins to communicate without direct dependencies
 * 
 * Example:
 * eventBus.emit('tournament:created', { tournamentId, guildId });
 * eventBus.on('tournament:created', (data) => { ... });
 */

const EventEmitter = require('events');
const Logger = require('../utils/logger');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.maxListeners = 100;
    this.events = new Map();
    Logger.info('Event Bus initialized');
  }

  /**
   * Register event listener
   */
  on(eventName, handler) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    this.events.get(eventName).push(handler);
    return super.on(eventName, handler);
  }

  /**
   * Emit event
   */
  emit(eventName, data) {
    Logger.debug(`📡 Event emitted: ${eventName}`, data);
    return super.emit(eventName, data);
  }

  /**
   * Remove all listeners for an event
   */
  clear(eventName) {
    this.removeAllListeners(eventName);
    this.events.delete(eventName);
  }

  /**
   * Get all registered events
   */
  getRegisteredEvents() {
    return Array.from(this.events.keys());
  }
}

module.exports = EventBus;
