/**
 * CAPABILITY ENGINE
 * Instead of fixed commands, the bot has capabilities
 * AI can do anything within these capabilities
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class CapabilityEngine {
  constructor(client, database) {
    this.client = client;
    this.db = database;

    // Define all possible capabilities
    this.allCapabilities = {
      // Channel Management
      'manage_channels': {
        description: 'Create, delete, edit channels',
        riskLevel: 'high',
        requiredRole: 'admin',
      },
      'manage_topics': {
        description: 'Change channel topics and descriptions',
        riskLevel: 'medium',
        requiredRole: 'admin',
      },

      // Role Management
      'manage_roles': {
        description: 'Create, delete, edit roles',
        riskLevel: 'high',
        requiredRole: 'admin',
      },
      'assign_roles': {
        description: 'Assign roles to members',
        riskLevel: 'medium',
        requiredRole: 'admin',
      },

      // Member Management
      'manage_members': {
        description: 'Kick, ban, timeout members',
        riskLevel: 'high',
        requiredRole: 'admin',
      },
      'view_members': {
        description: 'View member list and info',
        riskLevel: 'low',
        requiredRole: 'user',
      },

      // Message Management
      'manage_messages': {
        description: 'Delete, edit, pin messages',
        riskLevel: 'medium',
        requiredRole: 'moderator',
      },
      'send_messages': {
        description: 'Send messages to channels',
        riskLevel: 'low',
        requiredRole: 'user',
      },

      // Tournament Management
      'create_tournament': {
        description: 'Create tournaments',
        riskLevel: 'high',
        requiredRole: 'admin',
      },
      'manage_tournament': {
        description: 'Edit, delete tournaments',
        riskLevel: 'high',
        requiredRole: 'admin',
      },

      // Support System
      'create_ticket': {
        description: 'Create support tickets',
        riskLevel: 'low',
        requiredRole: 'user',
      },
      'manage_ticket': {
        description: 'Close, assign tickets',
        riskLevel: 'medium',
        requiredRole: 'staff',
      },

      // Analytics
      'view_analytics': {
        description: 'View server analytics',
        riskLevel: 'low',
        requiredRole: 'admin',
      },
      'export_data': {
        description: 'Export server data',
        riskLevel: 'medium',
        requiredRole: 'admin',
      },

      // Bot Management
      'manage_bot': {
        description: 'Configure bot settings',
        riskLevel: 'high',
        requiredRole: 'owner',
      },
      'manage_plugins': {
        description: 'Load, unload plugins',
        riskLevel: 'high',
        requiredRole: 'owner',
      },

      // System
      'view_logs': {
        description: 'View bot logs',
        riskLevel: 'low',
        requiredRole: 'admin',
      },
      'restart_bot': {
        description: 'Restart the bot',
        riskLevel: 'critical',
        requiredRole: 'owner',
      },
    };
  }

  /**
   * Get all capabilities
   */
  getAllCapabilities() {
    return this.allCapabilities;
  }

  /**
   * Get capability details
   */
  getCapabilityDetails(capability) {
    return this.allCapabilities[capability] || null;
  }

  /**
   * Get capabilities for a role
   */
  getCapabilitiesForRole(role) {
    const roleCapabilities = {
      owner: Object.keys(this.allCapabilities), // All
      admin: Object.keys(this.allCapabilities).filter(
        cap => this.allCapabilities[cap].requiredRole !== 'owner'
      ),
      staff: Object.keys(this.allCapabilities).filter(
        cap => ['staff', 'user'].includes(this.allCapabilities[cap].requiredRole)
      ),
      moderator: Object.keys(this.allCapabilities).filter(
        cap => ['moderator', 'user'].includes(this.allCapabilities[cap].requiredRole)
      ),
      user: Object.keys(this.allCapabilities).filter(
        cap => this.allCapabilities[cap].requiredRole === 'user'
      ),
    };

    return roleCapabilities[role] || [];
  }

  /**
   * Initialize capabilities for a server
   */
  async initializeServerCapabilities(guildId) {
    try {
      const capabilities = {
        guildId,
        owner: this.getCapabilitiesForRole('owner'),
        admin: this.getCapabilitiesForRole('admin'),
        staff: this.getCapabilitiesForRole('staff'),
        moderator: this.getCapabilitiesForRole('moderator'),
        user: this.getCapabilitiesForRole('user'),
        custom: {}, // Custom capabilities per member
        createdAt: new Date().toISOString(),
      };

      await firebase.set(`servers/${guildId}/capabilities`, capabilities);
      Logger.success(`Initialized capabilities for server ${guildId}`);
      return capabilities;
    } catch (error) {
      Logger.error('Failed to initialize capabilities:', error);
      return null;
    }
  }

  /**
   * Get capabilities for member
   */
  async getMemberCapabilities(guildId, memberId) {
    try {
      // Get member's roles from context
      const context = require('./context-engine');
      const member = this.client.guilds.cache.get(guildId)?.members.cache.get(memberId);
      
      if (!member) return [];

      // Determine role level
      let roleLevel = 'user';
      if (member.guild.ownerId === memberId) roleLevel = 'owner';
      else if (member.permissions.has('Administrator')) roleLevel = 'admin';
      else if (member.roles.cache.some(r => r.name.toLowerCase().includes('staff'))) roleLevel = 'staff';
      else if (member.roles.cache.some(r => r.name.toLowerCase().includes('moderator'))) roleLevel = 'moderator';

      // Get capabilities for role
      const capabilities = this.getCapabilitiesForRole(roleLevel);

      // Add custom capabilities if any
      const custom = await firebase.get(`servers/${guildId}/capabilities/custom/${memberId}`);
      if (custom) {
        capabilities.push(...Object.keys(custom));
      }

      return capabilities;
    } catch (error) {
      Logger.error('Failed to get member capabilities:', error);
      return [];
    }
  }

  /**
   * Check if member has capability
   */
  async hasCapability(guildId, memberId, capability) {
    try {
      const capabilities = await this.getMemberCapabilities(guildId, memberId);
      return capabilities.includes(capability);
    } catch (error) {
      Logger.error('Failed to check capability:', error);
      return false;
    }
  }

  /**
   * Grant custom capability
   */
  async grantCapability(guildId, memberId, capability) {
    try {
      const path = `servers/${guildId}/capabilities/custom/${memberId}`;
      await firebase.update(path, { [capability]: true });
      Logger.info(`Granted ${capability} to ${memberId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to grant capability:', error);
      return false;
    }
  }

  /**
   * Revoke capability
   */
  async revokeCapability(guildId, memberId, capability) {
    try {
      const path = `servers/${guildId}/capabilities/custom/${memberId}`;
      await firebase.update(path, { [capability]: false });
      Logger.info(`Revoked ${capability} from ${memberId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to revoke capability:', error);
      return false;
    }
  }

  /**
   * Generate documentation for capabilities
   */
  getCapabilityDocumentation(capabilityList) {
    let doc = '📚 Available Capabilities:\n\n';

    capabilityList.forEach(cap => {
      const details = this.allCapabilities[cap];
      if (details) {
        doc += `**${cap}** - ${details.description}\n`;
      }
    });

    return doc;
  }
}

module.exports = CapabilityEngine;
