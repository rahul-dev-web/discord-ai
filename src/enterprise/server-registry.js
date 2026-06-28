/**
 * PHASE 19 - SERVER REGISTRY
 * Multi-Server Management System
 * 
 * Manages:
 * - Server registration & configuration
 * - Tier management (Free/Pro/Enterprise)
 * - Per-server data isolation
 * - Server-specific workflows
 * - Guild settings persistence
 */

const Logger = require('../utils/logger');

class ServerRegistry {
  constructor(firebaseDb) {
    this.db = firebaseDb;
    this.servers = new Map();
    this.tiers = {
      'free': {
        maxWorkflows: 3,
        maxPlugins: 5,
        analytics: 'basic',
        support: 'community',
        price: 0,
      },
      'pro': {
        maxWorkflows: 50,
        maxPlugins: 50,
        analytics: 'advanced',
        support: 'email',
        price: 29,
      },
      'enterprise': {
        maxWorkflows: 999,
        maxPlugins: 999,
        analytics: 'full',
        support: '24/7',
        price: 199,
      },
    };
  }

  /**
   * Register new server
   */
  async registerServer(guildId, config = {}) {
    try {
      const serverConfig = {
        guildId,
        name: config.name || `Guild ${guildId}`,
        owner: config.owner,
        tier: config.tier || 'free',
        workflows: [],
        plugins: [],
        customAI: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
          autoDeployCommands: true,
          loggingLevel: 'INFO',
          dashboardEnabled: true,
          workflowsEnabled: true,
          aiEnabled: true,
        },
        statistics: {
          workflowsCompleted: 0,
          workflowsFailed: 0,
          totalExecutionTime: 0,
          lastActive: new Date().toISOString(),
        },
      };

      this.servers.set(guildId, serverConfig);
      await this.db.ref(`servers/${guildId}`).set(serverConfig);
      
      Logger.info(`📍 Server registered: ${serverConfig.name} (${guildId})`);
      return serverConfig;
    } catch (error) {
      Logger.error('Error registering server:', error);
      throw error;
    }
  }

  /**
   * Get server configuration
   */
  async getServer(guildId) {
    try {
      // Try cache first
      if (this.servers.has(guildId)) {
        return this.servers.get(guildId);
      }

      // Fetch from database
      const snapshot = await this.db.ref(`servers/${guildId}`).once('value');
      const server = snapshot.val();

      if (server) {
        this.servers.set(guildId, server);
      }

      return server;
    } catch (error) {
      Logger.error('Error fetching server:', error);
      throw error;
    }
  }

  /**
   * Update server settings
   */
  async updateServerSettings(guildId, settings) {
    try {
      const server = await this.getServer(guildId);
      if (!server) {
        throw new Error('Server not found');
      }

      const updated = {
        ...server,
        settings: { ...server.settings, ...settings },
        updatedAt: new Date().toISOString(),
      };

      this.servers.set(guildId, updated);
      await this.db.ref(`servers/${guildId}`).update(updated);

      Logger.info(`⚙️ Settings updated for ${guildId}`);
      return updated;
    } catch (error) {
      Logger.error('Error updating settings:', error);
      throw error;
    }
  }

  /**
   * Upgrade server tier
   */
  async upgradeServerTier(guildId, newTier) {
    try {
      if (!this.tiers[newTier]) {
        throw new Error('Invalid tier');
      }

      const server = await this.getServer(guildId);
      if (!server) {
        throw new Error('Server not found');
      }

      const updated = {
        ...server,
        tier: newTier,
        updatedAt: new Date().toISOString(),
      };

      this.servers.set(guildId, updated);
      await this.db.ref(`servers/${guildId}`).update(updated);

      Logger.success(`⬆️ ${guildId} upgraded to ${newTier} tier`);
      return updated;
    } catch (error) {
      Logger.error('Error upgrading tier:', error);
      throw error;
    }
  }

  /**
   * Check tier limits
   */
  async checkTierLimit(guildId, resourceType) {
    try {
      const server = await this.getServer(guildId);
      const tier = this.tiers[server.tier];

      if (resourceType === 'workflows') {
        return server.workflows.length < tier.maxWorkflows;
      } else if (resourceType === 'plugins') {
        return server.plugins.length < tier.maxPlugins;
      }

      return true;
    } catch (error) {
      Logger.error('Error checking tier limit:', error);
      return false;
    }
  }

  /**
   * Get server statistics
   */
  async getServerStats(guildId) {
    try {
      const server = await this.getServer(guildId);
      return {
        guildId,
        tier: server.tier,
        workflows: server.workflows.length,
        plugins: server.plugins.length,
        completed: server.statistics.workflowsCompleted,
        failed: server.statistics.workflowsFailed,
        avgTime: server.statistics.totalExecutionTime / Math.max(server.statistics.workflowsCompleted, 1),
        lastActive: server.statistics.lastActive,
        tierLimits: this.tiers[server.tier],
      };
    } catch (error) {
      Logger.error('Error fetching stats:', error);
      throw error;
    }
  }

  /**
   * Get all servers by tier
   */
  async getServersByTier(tier) {
    try {
      const servers = Array.from(this.servers.values())
        .filter(s => s.tier === tier);
      return servers;
    } catch (error) {
      Logger.error('Error fetching servers by tier:', error);
      throw error;
    }
  }

  /**
   * Record workflow execution
   */
  async recordExecution(guildId, success, executionTime) {
    try {
      const server = await this.getServer(guildId);
      if (!server) return;

      const updated = {
        ...server,
        statistics: {
          ...server.statistics,
          workflowsCompleted: success ? server.statistics.workflowsCompleted + 1 : server.statistics.workflowsCompleted,
          workflowsFailed: !success ? server.statistics.workflowsFailed + 1 : server.statistics.workflowsFailed,
          totalExecutionTime: server.statistics.totalExecutionTime + executionTime,
          lastActive: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };

      this.servers.set(guildId, updated);
      await this.db.ref(`servers/${guildId}`).update(updated.statistics);
    } catch (error) {
      Logger.error('Error recording execution:', error);
    }
  }

  /**
   * Get tier information
   */
  getTierInfo(tier) {
    return this.tiers[tier] || null;
  }

  /**
   * List all tiers
   */
  getAllTiers() {
    return this.tiers;
  }
}

module.exports = ServerRegistry;
