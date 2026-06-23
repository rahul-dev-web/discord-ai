/**
 * COMMAND DISCOVERY ENGINE - Phase 13
 * Unlimited, dynamic command discovery based on capabilities
 * 
 * Instead of hardcoded commands, this engine:
 * 1. Detects user's role in the server
 * 2. Gets their available capabilities
 * 3. Pulls available tools from Dynamic Tool Registry
 * 4. Generates live documentation
 * 
 * This way when new plugins are installed, commands are automatically available!
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class CommandDiscoveryEngine {
  constructor(client, database) {
    this.client = client;
    this.db = database;
    this.commandCache = new Map(); // userId -> cached capabilities
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
    this.roleHierarchy = {
      owner: 100,
      lead: 90,
      admin: 80,
      senior_staff: 70,
      staff: 60,
      moderator: 50,
      member: 10,
      guest: 0,
    };
  }

  /**
   * MAIN ENTRY: Get all capabilities for a user
   */
  async getUserCapabilities(guildId, userId) {
    try {
      // Check cache first
      const cached = this.getCachedCapabilities(userId);
      if (cached) {
        Logger.debug(`📦 Cache hit for user capabilities: ${userId}`);
        return cached;
      }

      // 1. Get user's role in server
      const userRole = await this.detectUserRole(guildId, userId);
      Logger.debug(`👤 User role detected: ${userRole}`);

      // 2. Get base capabilities for this role
      const roleCapabilities = await this.getCapabilitiesForRole(guildId, userRole);
      Logger.debug(`🎯 Role capabilities: ${roleCapabilities.length} found`);

      // 3. Get channel-specific capabilities
      const currentChannel = this.client.channels.cache.find(
        ch => ch.messages?.cache?.some(msg => msg.author.id === userId)
      );
      const channelCapabilities = currentChannel
        ? await this.getChannelCapabilities(guildId, currentChannel.id)
        : [];
      Logger.debug(`📍 Channel capabilities: ${channelCapabilities.length} found`);

      // 4. Merge and deduplicate
      const allCapabilities = Array.from(
        new Set([...roleCapabilities, ...channelCapabilities])
      );

      // 5. Cache the result
      this.cacheCapabilities(userId, {
        role: userRole,
        capabilities: allCapabilities,
        timestamp: Date.now(),
      });

      return {
        role: userRole,
        capabilities: allCapabilities,
        count: allCapabilities.length,
      };
    } catch (error) {
      Logger.error('Failed to get user capabilities:', error);
      return {
        role: 'member',
        capabilities: ['send_messages', 'view_members'],
        count: 2,
        error: true,
      };
    }
  }

  /**
   * Detect user's role in the server
   */
  async detectUserRole(guildId, userId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return 'member';

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return 'guest';

      // Check if owner
      if (member.id === guild.ownerId) return 'owner';

      // Check roles
      const highestRole = member.roles.highest;
      if (!highestRole) return 'member';

      const roleName = highestRole.name.toLowerCase();

      // Detect role by name
      if (roleName.includes('owner')) return 'owner';
      if (roleName.includes('lead')) return 'lead';
      if (roleName.includes('admin')) return 'admin';
      if (roleName.includes('senior')) return 'senior_staff';
      if (roleName.includes('staff') || roleName.includes('mod')) return 'staff';
      if (roleName.includes('moderator')) return 'moderator';

      // Check permissions as fallback
      if (member.permissions.has('Administrator')) return 'admin';
      if (member.permissions.has('ModerateMembers')) return 'moderator';

      return 'member';
    } catch (error) {
      Logger.error('Role detection failed:', error);
      return 'member';
    }
  }

  /**
   * Get capabilities for a specific role
   */
  async getCapabilitiesForRole(guildId, role) {
    try {
      // Try to get from database first
      const dbCapabilities = await firebase.get(
        `servers/${guildId}/command_discovery/roles/${role}/capabilities`
      );

      if (dbCapabilities && Array.isArray(dbCapabilities)) {
        return dbCapabilities;
      }

      // Fallback to role-based capabilities
      const capabilityMap = {
        owner: [
          'manage_bot',
          'manage_plugins',
          'restart_bot',
          'manage_roles',
          'manage_channels',
          'view_logs',
          'change_settings',
          'create_tournament',
          'manage_tournament',
          'manage_members',
          'manage_messages',
          'create_ticket',
          'manage_ticket',
          'view_analytics',
          'send_messages',
          'manage_voice',
          'view_server_stats',
        ],
        lead: [
          'manage_plugins',
          'manage_tournament',
          'manage_members',
          'manage_messages',
          'view_logs',
          'create_tournament',
          'manage_ticket',
          'view_analytics',
          'send_messages',
          'manage_voice',
        ],
        admin: [
          'manage_tournament',
          'manage_members',
          'manage_messages',
          'view_logs',
          'create_tournament',
          'manage_ticket',
          'view_analytics',
          'send_messages',
          'manage_voice',
          'change_settings',
        ],
        senior_staff: [
          'manage_tournament',
          'manage_members',
          'create_tournament',
          'manage_ticket',
          'view_analytics',
          'send_messages',
          'manage_voice',
        ],
        staff: [
          'manage_tournament',
          'manage_ticket',
          'send_messages',
          'manage_voice',
          'view_analytics',
        ],
        moderator: [
          'manage_messages',
          'manage_members',
          'send_messages',
          'manage_voice',
        ],
        member: [
          'send_messages',
          'view_members',
          'create_ticket',
          'view_analytics',
        ],
        guest: ['send_messages', 'view_members'],
      };

      return capabilityMap[role] || capabilityMap.guest;
    } catch (error) {
      Logger.error('Failed to get role capabilities:', error);
      return ['send_messages'];
    }
  }

  /**
   * Get channel-specific capabilities
   */
  async getChannelCapabilities(guildId, channelId) {
    try {
      // Get channel profile from Smart Discovery Engine
      const profile = await firebase.get(
        `servers/${guildId}/channel_profiles/${channelId}`
      );

      if (profile && profile.autoCapabilities) {
        return profile.autoCapabilities;
      }

      return [];
    } catch (error) {
      Logger.error('Failed to get channel capabilities:', error);
      return [];
    }
  }

  /**
   * Get available tools from Dynamic Tool Registry
   */
  async getAvailableTools(guildId) {
    try {
      const tools = await firebase.get(`servers/${guildId}/tool_registry/tools`);

      if (!tools) {
        Logger.warn('No tools found in registry');
        return {};
      }

      return tools;
    } catch (error) {
      Logger.error('Failed to get tools:', error);
      return {};
    }
  }

  /**
   * Get tools for a specific capability
   */
  async getToolsForCapability(guildId, capability) {
    try {
      const tools = await this.getAvailableTools(guildId);

      const matchingTools = Object.entries(tools)
        .filter(([, tool]) => tool.capability === capability)
        .map(([toolId, toolData]) => ({
          id: toolId,
          ...toolData,
        }));

      return matchingTools;
    } catch (error) {
      Logger.error('Failed to get tools for capability:', error);
      return [];
    }
  }

  /**
   * Generate live documentation for user
   */
  async generateDocumentation(guildId, userId) {
    try {
      const capabilities = await this.getUserCapabilities(guildId, userId);
      const tools = await this.getAvailableTools(guildId);

      const documentation = {
        role: capabilities.role,
        generatedAt: new Date().toISOString(),
        capabilities: [],
        totalCapabilities: capabilities.capabilities.length,
        totalTools: Object.keys(tools).length,
      };

      // For each capability, get related tools
      for (const capability of capabilities.capabilities) {
        const toolsForCap = await this.getToolsForCapability(guildId, capability);

        documentation.capabilities.push({
          name: capability,
          description: this.getCapabilityDescription(capability),
          tools: toolsForCap.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
          })),
        });
      }

      return documentation;
    } catch (error) {
      Logger.error('Failed to generate documentation:', error);
      return null;
    }
  }

  /**
   * Build a user-friendly command list
   */
  async buildCommandList(guildId, userId) {
    try {
      const capabilities = await this.getUserCapabilities(guildId, userId);
      const tools = await this.getAvailableTools(guildId);

      const commandList = {
        role: capabilities.role,
        message: `You have ${capabilities.capabilities.length} capabilities available:`,
        capabilities: [],
      };

      // Group tools by capability
      for (const capability of capabilities.capabilities) {
        const relatedTools = Object.entries(tools)
          .filter(([, tool]) => tool.capability === capability)
          .map(([toolId, toolData]) => ({
            command: toolData.command || toolId,
            description: toolData.description || '',
          }));

        if (relatedTools.length > 0) {
          commandList.capabilities.push({
            name: capability,
            emoji: this.getCapabilityEmoji(capability),
            tools: relatedTools,
          });
        }
      }

      return commandList;
    } catch (error) {
      Logger.error('Failed to build command list:', error);
      return null;
    }
  }

  /**
   * Validate if user can execute a tool/capability
   */
  async validateCapability(guildId, userId, capability) {
    try {
      const userCaps = await this.getUserCapabilities(guildId, userId);

      if (!userCaps.capabilities.includes(capability)) {
        return {
          allowed: false,
          reason: `You don't have the '${capability}' capability`,
          requiredRole: this.getRoleForCapability(capability),
        };
      }

      return {
        allowed: true,
      };
    } catch (error) {
      Logger.error('Capability validation failed:', error);
      return { allowed: false, reason: 'Validation error' };
    }
  }

  /**
   * Register a new tool in the tool registry
   */
  async registerTool(guildId, toolId, toolData) {
    try {
      const tool = {
        id: toolId,
        name: toolData.name,
        description: toolData.description,
        command: toolData.command,
        capability: toolData.capability,
        requiresParameters: toolData.parameters || [],
        registeredAt: new Date().toISOString(),
        plugin: toolData.plugin || 'system',
      };

      await firebase.set(`servers/${guildId}/tool_registry/tools/${toolId}`, tool);
      Logger.info(`✅ Tool registered: ${toolId}`);

      // Invalidate capability cache for all users
      this.commandCache.clear();

      return true;
    } catch (error) {
      Logger.error('Failed to register tool:', error);
      return false;
    }
  }

  /**
   * Unregister a tool when plugin is removed
   */
  async unregisterTool(guildId, toolId) {
    try {
      await firebase.delete(`servers/${guildId}/tool_registry/tools/${toolId}`);
      Logger.info(`❌ Tool unregistered: ${toolId}`);

      // Invalidate cache
      this.commandCache.clear();

      return true;
    } catch (error) {
      Logger.error('Failed to unregister tool:', error);
      return false;
    }
  }

  /**
   * Cache user capabilities
   */
  cacheCapabilities(userId, data) {
    this.commandCache.set(userId, data);
    setTimeout(() => {
      this.commandCache.delete(userId);
    }, this.cacheExpiry);
  }

  /**
   * Get cached capabilities
   */
  getCachedCapabilities(userId) {
    const cached = this.commandCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return {
        role: cached.role,
        capabilities: cached.capabilities,
        count: cached.capabilities.length,
        cached: true,
      };
    }
    return null;
  }

  /**
   * Get human-readable description for capability
   */
  getCapabilityDescription(capability) {
    const descriptions = {
      manage_bot: 'Full control over bot settings and configuration',
      manage_plugins: 'Install, update, and remove plugins',
      restart_bot: 'Restart the bot',
      manage_roles: 'Create and manage server roles',
      manage_channels: 'Create, delete, and configure channels',
      view_logs: 'View bot and moderation logs',
      change_settings: 'Modify server settings',
      create_tournament: 'Create new tournaments',
      manage_tournament: 'Manage existing tournaments',
      manage_members: 'Manage member roles and permissions',
      manage_messages: 'Delete and moderate messages',
      create_ticket: 'Create support tickets',
      manage_ticket: 'Manage support tickets',
      view_analytics: 'View server analytics and statistics',
      send_messages: 'Send and reply to messages',
      manage_voice: 'Manage voice channels and members',
      view_members: 'View member list and information',
      view_server_stats: 'View detailed server statistics',
    };

    return descriptions[capability] || `${capability} capability`;
  }

  /**
   * Get emoji for capability
   */
  getCapabilityEmoji(capability) {
    const emojis = {
      manage_bot: '🤖',
      manage_plugins: '🔌',
      restart_bot: '🔄',
      manage_roles: '👥',
      manage_channels: '📢',
      view_logs: '📋',
      change_settings: '⚙️',
      create_tournament: '🏆',
      manage_tournament: '🎮',
      manage_members: '👨‍💼',
      manage_messages: '✏️',
      create_ticket: '🎫',
      manage_ticket: '🎟️',
      view_analytics: '📊',
      send_messages: '💬',
      manage_voice: '🎤',
      view_members: '👀',
      view_server_stats: '📈',
    };

    return emojis[capability] || '⚡';
  }

  /**
   * Get required role for a capability
   */
  getRoleForCapability(capability) {
    const ownerCaps = [
      'manage_bot',
      'manage_plugins',
      'restart_bot',
      'change_settings',
    ];
    if (ownerCaps.includes(capability)) return 'owner';

    const adminCaps = ['manage_roles', 'manage_channels', 'view_logs'];
    if (adminCaps.includes(capability)) return 'admin';

    return 'member';
  }

  /**
   * Get all available commands for documentation
   */
  async getAllAvailableCommands(guildId) {
    try {
      const tools = await this.getAvailableTools(guildId);
      return Object.entries(tools).map(([toolId, toolData]) => ({
        id: toolId,
        command: toolData.command,
        description: toolData.description,
        capability: toolData.capability,
      }));
    } catch (error) {
      Logger.error('Failed to get all commands:', error);
      return [];
    }
  }

  /**
   * Generate capability report for debugging
   */
  async generateCapabilityReport(guildId) {
    try {
      const tools = await this.getAvailableTools(guildId);
      const report = {
        guildId,
        generatedAt: new Date().toISOString(),
        totalTools: Object.keys(tools).length,
        byCapability: {},
        byPlugin: {},
      };

      for (const [toolId, toolData] of Object.entries(tools)) {
        // By capability
        if (!report.byCapability[toolData.capability]) {
          report.byCapability[toolData.capability] = [];
        }
        report.byCapability[toolData.capability].push(toolId);

        // By plugin
        const plugin = toolData.plugin || 'system';
        if (!report.byPlugin[plugin]) {
          report.byPlugin[plugin] = [];
        }
        report.byPlugin[plugin].push(toolId);
      }

      return report;
    } catch (error) {
      Logger.error('Report generation failed:', error);
      return null;
    }
  }
}

module.exports = CommandDiscoveryEngine;
