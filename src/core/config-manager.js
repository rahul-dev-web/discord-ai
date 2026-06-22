/**
 * CONFIG MANAGER
 * Manages server configuration in Firebase
 */

const Logger = require('../utils/logger');
const firebase = require('./firebase-config');

class ConfigManager {
  constructor(database) {
    this.db = database;
    this.configs = new Map();
  }

  /**
   * Load all server configs
   */
  async loadConfigs() {
    try {
      const configs = await firebase.get('configs');
      if (configs) {
        Object.entries(configs).forEach(([guildId, config]) => {
          this.configs.set(guildId, config);
        });
      }
      Logger.info(`Loaded ${this.configs.size} server configurations`);
    } catch (error) {
      Logger.error('Failed to load configs:', error);
    }
  }

  /**
   * Get config for a server
   */
  async getServerConfig(guildId) {
    if (this.configs.has(guildId)) {
      return this.configs.get(guildId);
    }

    const config = await firebase.get(`configs/${guildId}`);
    if (config) {
      this.configs.set(guildId, config);
    }
    return config || this.getDefaultConfig();
  }

  /**
   * Create default config for a server
   */
  getDefaultConfig() {
    return {
      prefix: '!',
      language: 'en',
      timezone: 'Asia/Kolkata',
      aiModel: 'groq',
      features: {
        support: true,
        tournament: true,
        moderation: true,
        analytics: true,
        voice: true,
      },
      plugins: [],
      roles: {
        owner: null,
        admin: [],
        staff: [],
        moderator: [],
      },
      channels: {
        logs: null,
        support: null,
        announcements: null,
        tournamentCategory: null,
      },
      initialized: false,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Update server config
   */
  async updateServerConfig(guildId, updates) {
    try {
      const config = await this.getServerConfig(guildId);
      const updated = { ...config, ...updates };
      
      await firebase.update(`configs/${guildId}`, updated);
      this.configs.set(guildId, updated);
      
      Logger.info(`Updated config for server ${guildId}`);
      return updated;
    } catch (error) {
      Logger.error(`Failed to update config for ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Initialize a server (first-time setup)
   */
  async initializeServer(guildId, ownerData) {
    try {
      const config = this.getDefaultConfig();
      config.initialized = true;
      config.roles.owner = ownerData.ownerId;
      
      await firebase.set(`configs/${guildId}`, config);
      this.configs.set(guildId, config);
      
      Logger.success(`Initialized server ${guildId}`);
      return config;
    } catch (error) {
      Logger.error(`Failed to initialize server ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Add role to config
   */
  async addRole(guildId, roleType, roleId) {
    try {
      const config = await this.getServerConfig(guildId);
      if (roleType === 'owner') {
        config.roles.owner = roleId;
      } else if (Array.isArray(config.roles[roleType])) {
        if (!config.roles[roleType].includes(roleId)) {
          config.roles[roleType].push(roleId);
        }
      }
      
      await this.updateServerConfig(guildId, config);
      return true;
    } catch (error) {
      Logger.error(`Failed to add role:`, error);
      return false;
    }
  }

  /**
   * Enable/disable feature
   */
  async toggleFeature(guildId, featureName, enabled) {
    try {
      const config = await this.getServerConfig(guildId);
      config.features[featureName] = enabled;
      
      await this.updateServerConfig(guildId, config);
      return true;
    } catch (error) {
      Logger.error(`Failed to toggle feature:`, error);
      return false;
    }
  }
}

module.exports = ConfigManager;
