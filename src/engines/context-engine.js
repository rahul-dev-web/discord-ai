/**
 * CONTEXT ENGINE
 * Maintains a live "digital twin" of the Discord server
 * AI uses this to understand server state without constant API calls
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');
const { ChannelType } = require("discord.js");

class ContextEngine {
  constructor(client, database) {
    this.client = client;
    this.db = database;
    this.serverContexts = new Map(); // In-memory cache
  }

  /**
   * Scan server and build context
   */
  async scanServer(guild) {
    try {
      Logger.info(`🔍 Scanning server: ${guild.name}`);

      const context = {
        guildId: guild.id,
        guildName: guild.name,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
        createdAt: guild.createdAt.toISOString(),
        
        categories: [],
        channels: [],
        roles: [],
        members: [],
        voiceChannels: [],
        activeVoiceChannels: [],
        
        plugins: [],
        workflows: [],
        
        scannedAt: new Date().toISOString(),
      };

      // Scan categories
      for (const [, category] of guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory)) {
        context.categories.push({
          id: category.id,
          name: category.name,
          position: category.position,
          permissions: category.permissionOverwrites.cache.map(p => ({
            id: p.id,
            allow: p.allow.bitfield.toString(),
            deny: p.deny.bitfield.toString(),
          })),
        });
      }

      // Scan channels
      for (const [, channel] of guild.channels.cache) {
        if (channel.isDMBased()) continue;

        const channelData = {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          parent: channel.parentId,
          position: channel.position,
        };

        if (channel.type === ChannelType.GuildCategory) {
          // Already handled in categories
          continue;
        }

        

        if (channel.isVoiceBased()) {
          channelData.userCount = channel.members.size;
          context.voiceChannels.push(channelData);
          
          if (channel.members.size > 0) {
            context.activeVoiceChannels.push(channelData);
          }
        } else {
          channelData.topic = channel.topic || '';
          context.channels.push(channelData);
        }
      }

      // Scan roles
      for (const [, role] of guild.roles.cache) {
        if (role.name === '@everyone') continue;

        context.roles.push({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          permissions: role.permissions.bitfield.toString(),
          managed: role.managed,
          memberCount: role.members.size,
        });
      }

      // Scan members (sample to avoid hitting limits)
      const members = await guild.members.fetch({ limit: 100 });
      for (const [, member] of members) {
        context.members.push({
          id: member.id,
          username: member.user.username,
          roles: member.roles.cache.map(r => r.id),
          joinedAt: member.joinedAt
          ? member.joinedAt.toISOString()
          : null,
          isBot: member.user.bot,
        });
      }

      // Save to Firebase
      await firebase.set(`servers/${guild.id}/context`, context);
      this.serverContexts.set(guild.id, context);

      Logger.success(`✅ Context built for ${guild.name}`);
      return context;
    } catch (error) {
      Logger.error(`Failed to scan server:`, error);
      return null;
    }
  }

  /**
   * Get server context
   */
  async getServerContext(guildId) {
    // Check memory cache first
    if (this.serverContexts.has(guildId)) {
      return this.serverContexts.get(guildId);
    }

    // Load from Firebase
    const context = await firebase.get(`servers/${guildId}/context`);
    if (context) {
      this.serverContexts.set(guildId, context);
    }
    return context;
  }

  /**
   * Update server context (when something changes)
   */
  async updateServerContext(guildId, updates) {
    try {
      const context = await this.getServerContext(guildId);
      if (!context) return null;

      const updated = { ...context, ...updates, scannedAt: new Date().toISOString() };
      await firebase.update(`servers/${guildId}/context`, updated);
      this.serverContexts.set(guildId, updated);

      return updated;
    } catch (error) {
      Logger.error('Failed to update context:', error);
      return null;
    }
  }

  /**
   * Get channel info
   */
  async getChannelInfo(guildId, channelId) {
    const context = await this.getServerContext(guildId);
    if (!context) return null;

    return context.channels.find(c => c.id === channelId);
  }

  /**
   * Get role info
   */
  async getRoleInfo(guildId, roleId) {
    const context = await this.getServerContext(guildId);
    if (!context) return null;

    return context.roles.find(r => r.id === roleId);
  }

  /**
   * Get member info
   */
  async getMemberInfo(guildId, memberId) {
    const context = await this.getServerContext(guildId);
    if (!context) return null;

    return context.members.find(m => m.id === memberId);
  }

  /**
   * Check if channel exists
   */
  async channelExists(guildId, channelId) {
    const channel = await this.getChannelInfo(guildId, channelId);
    return !!channel;
  }

  /**
   * Get all active voice channels
   */
  async getActiveVoiceChannels(guildId) {
    const context = await this.getServerContext(guildId);
    return context?.activeVoiceChannels || [];
  }

  /**
   * Clear cache for a server
   */
  clearCache(guildId) {
    this.serverContexts.delete(guildId);
    Logger.info(`Cleared context cache for server ${guildId}`);
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.serverContexts.clear();
    Logger.info('Cleared all context caches');
  }
}

module.exports = ContextEngine;
