/**
 * SMART DISCOVERY ENGINE - Phase 11
 * Auto-detects channel purposes and creates AI profiles
 * Continuously learns server structure
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');
const { ChannelType } = require('discord.js');

class SmartDiscoveryEngine {
  constructor(client, database) {
    this.client = client;
    this.db = database;
    this.discoveredChannels = new Map();
    this.channelProfiles = new Map();
  }

  /**
   * Scan server and discover all channels
   */
  async discoverServer(guildId) {
    try {
      Logger.info(`🔍 Smart discovery starting for server ${guildId}`);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return null;

      const discoveries = {
        guildId,
        timestamp: new Date().toISOString(),
        channels: {
          owner_chat: [],
          staff_chat: [],
          helpdesk: [],
          tournament: [],
          announcement: [],
          general: [],
          voice_owner: [],
          voice_staff: [],
          voice_general: [],
          unknown: [],
        },
        profiles: {},
        relationships: {},
      };

      // Scan all channels
      for (const [, channel] of guild.channels.cache) {
        if (channel.type === ChannelType.DM) continue;

        const profile = await this.analyzeChannel(guildId, channel);
        if (profile) {
          discoveries.channels[profile.purpose].push({
            id: channel.id,
            name: channel.name,
            profile: profile,
          });
          discoveries.profiles[channel.id] = profile;
        }
      }

      // Find relationships
      discoveries.relationships = this.discoverChannelRelationships(discoveries.profiles);

      // Save discoveries
      await firebase.set(`servers/${guildId}/discoveries/latest`, discoveries);

      Logger.success(`✅ Discovery complete: ${Object.keys(discoveries.profiles).length} channels profiled`);

      return discoveries;
    } catch (error) {
      Logger.error('Server discovery failed:', error);
      return null;
    }
  }

  /**
   * Analyze a single channel
   */
  async analyzeChannel(guildId, channel) {
    try {
      const name = channel.name.toLowerCase();
      const topic = (channel.topic || '').toLowerCase();
      const position = channel.position;
      const isVoice =
    typeof channel.isVoiceBased === "function"
        ? channel.isVoiceBased()
        : false;
      const isCategoryChannel = channel.type === ChannelType.GuildCategory;

      // Determine purpose
      let purpose = 'unknown';
      let confidence = 0;

      // Owner/Admin chat detection
      if (
        (name.includes('owner') || name.includes('admin-only') || name.includes('leadership')) &&
        !isVoice
      ) {
        purpose = 'owner_chat';
        confidence = 0.95;
      }
      // Owner VC detection
      else if (
        (name.includes('owner') || name.includes('admin-only')) &&
        isVoice
      ) {
        purpose = 'voice_owner';
        confidence = 0.95;
      }
      // Staff chat
      else if (
        (name.includes('staff') || name.includes('mods')) &&
        !isVoice
      ) {
        purpose = 'staff_chat';
        confidence = 0.9;
      }
      // Staff VC
      else if (
        (name.includes('staff') || name.includes('mods')) &&
        isVoice
      ) {
        purpose = 'voice_staff';
        confidence = 0.9;
      }
      // Helpdesk
      else if (
        name.includes('helpdesk') ||
        name.includes('support') ||
        name.includes('help') ||
        name.includes('tickets') ||
        topic.includes('support')
      ) {
        purpose = 'helpdesk';
        confidence = 0.95;
      }
      // Tournament
      else if (
        name.includes('tournament') ||
        name.includes('scrim') ||
        name.includes('compete') ||
        topic.includes('tournament')
      ) {
        purpose = 'tournament';
        confidence = 0.9;
      }
      // Announcement
      else if (
        name.includes('announcement') ||
        name.includes('news') ||
        name.includes('updates')
      ) {
        purpose = 'announcement';
        confidence = 0.85;
      }
      // General voice
      else if (isVoice && (name.includes('general') || name.includes('voice'))) {
        purpose = 'voice_general';
        confidence = 0.8;
      }
      // General chat
      else if (name.includes('general') || name.includes('chat')) {
        purpose = 'general';
        confidence = 0.8;
      }
      let channelType = "text";

if (channel.type === ChannelType.GuildVoice)
    channelType = "voice";

else if (channel.type === ChannelType.GuildCategory)
    channelType = "category";

else if (channel.type === ChannelType.GuildStageVoice)
    channelType = "stage";

else if (channel.type === ChannelType.GuildForum)
    channelType = "forum";
      // Create profile
      const profile = {
        channelId: channel.id,
        channelName: channel.name,
        purpose: purpose,
        confidence: confidence,
        type: channelType,
        parentId: channel.parentId,
        position: position,
        memberCount: isVoice ? channel.members?.size || 0 : 0,
        discoveredAt: new Date().toISOString(),
        autoCapabilities: this.getCapabilitiesForPurpose(purpose),
        metadata: {
          topic: topic,
          isCategory: isCategoryChannel,
          permissionOverrides: channel.permissionOverwrites?.cache?.size || 0,
        },
      };

      // Save profile
      await firebase.set(
        `servers/${guildId}/channel_profiles/${channel.id}`,
        profile
      );

      this.channelProfiles.set(channel.id, profile);

      Logger.debug(`Analyzed ${channel.name}: ${purpose} (${(confidence * 100).toFixed(0)}%)`);

      return profile;
    } catch (error) {
      Logger.error(`Channel analysis failed for ${channel.name}:`, error);
      return null;
    }
  }

  /**
   * Discover relationships between channels
   */
  discoverChannelRelationships(profiles) {
    try {
      const relationships = {};

      // Find linked channels (same parent = related)
      const byParent = {};
      for (const [channelId, profile] of Object.entries(profiles)) {
        if (profile.parentId) {
          if (!byParent[profile.parentId]) {
            byParent[profile.parentId] = [];
          }
          byParent[profile.parentId].push(channelId);
        }
      }

      // Create relationships
      for (const [parentId, channels] of Object.entries(byParent)) {
        relationships[parentId] = {
          type: 'category',
          linkedChannels: channels,
          count: channels.length,
        };
      }

      return relationships;
    } catch (error) {
      Logger.error('Relationship discovery failed:', error);
      return {};
    }
  }

  /**
   * Get capabilities for channel purpose
   */
  getCapabilitiesForPurpose(purpose) {
    const capabilityMap = {
      owner_chat: [
        'manage_bot',
        'manage_plugins',
        'restart_bot',
        'manage_roles',
        'manage_channels',
        'view_logs',
        'change_settings',
      ],
      voice_owner: [
        'manage_bot',
        'manage_voice',
        'restart_bot',
      ],
      staff_chat: [
        'manage_members',
        'manage_messages',
        'view_logs',
        'manage_ticket',
      ],
      voice_staff: [
        'manage_members',
        'manage_voice',
      ],
      helpdesk: [
        'create_ticket',
        'manage_ticket',
        'view_analytics',
        'send_messages',
      ],
      tournament: [
        'create_tournament',
        'manage_tournament',
        'send_messages',
      ],
      announcement: [
        'send_messages',
        'embed_links',
      ],
      general: [
        'send_messages',
        'view_members',
      ],
      voice_general: [
        'send_messages',
      ],
      unknown: [
        'send_messages',
      ],
    };

    return capabilityMap[purpose] || capabilityMap.unknown;
  }

  /**
   * Auto-create/update AI profiles for channels
   */
  async autoCreateChannelProfiles(guildId) {
    try {
      Logger.info(`🤖 Auto-creating channel profiles for ${guildId}`);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return false;

      let created = 0;
      let updated = 0;

      for (const [, channel] of guild.channels.cache) {
        if (channel.type === ChannelType.DM) continue;

        const profile = await this.analyzeChannel(guildId, channel);
        if (profile) {
          const existing = this.channelProfiles.get(channel.id);
          if (existing) {
            updated++;
          } else {
            created++;
          }
        }
      }

      Logger.success(`✅ Profiles: ${created} created, ${updated} updated`);
      return true;
    } catch (error) {
      Logger.error('Auto-profile creation failed:', error);
      return false;
    }
  }

  /**
   * Assign responsible team to channel
   */
  async assignResponsibleTeam(guildId, channelId, teamMemberIds) {
    try {
      const profile = await firebase.get(
        `servers/${guildId}/channel_profiles/${channelId}`
      );

      if (profile) {
        profile.responsibleTeam = teamMemberIds;
        profile.teamAssignedAt = new Date().toISOString();

        await firebase.update(`servers/${guildId}/channel_profiles/${channelId}`, profile);
        Logger.info(`Team assigned to channel ${channelId}`);
        return true;
      }

      return false;
    } catch (error) {
      Logger.error('Team assignment failed:', error);
      return false;
    }
  }

  /**
   * Get channel profile
   */
  async getChannelProfile(guildId, channelId) {
    try {
      if (this.channelProfiles.has(channelId)) {
        return this.channelProfiles.get(channelId);
      }

      const profile = await firebase.get(
        `servers/${guildId}/channel_profiles/${channelId}`
      );

      if (profile) {
        this.channelProfiles.set(channelId, profile);
      }

      return profile;
    } catch (error) {
      Logger.error('Failed to get channel profile:', error);
      return null;
    }
  }

  /**
   * Get all profiles by purpose
   */
  async getProfilesByPurpose(guildId, purpose) {
    try {
      const profiles = await firebase.get(`servers/${guildId}/channel_profiles`);
      if (!profiles) return [];

      return Object.values(profiles).filter((p) => p.purpose === purpose);
    } catch (error) {
      Logger.error('Failed to get profiles by purpose:', error);
      return [];
    }
  }

  /**
   * Auto-assign capabilities to members based on channel they're in
   */
  async autoAssignCapabilitiesForChannel(guildId, channelId, memberId) {
    try {
      const profile = await this.getChannelProfile(guildId, channelId);
      if (!profile) return false;

      // Check if member is in responsible team
      if (profile.responsibleTeam?.includes(memberId)) {
        // Grant all channel capabilities
        for (const capability of profile.autoCapabilities) {
          await this.client.engines.capability.grantCapability(
            guildId,
            memberId,
            capability
          );
        }

        Logger.info(`Capabilities auto-assigned to ${memberId} for ${profile.purpose}`);
        return true;
      }

      return false;
    } catch (error) {
      Logger.error('Auto-capability assignment failed:', error);
      return false;
    }
  }

  /**
   * Generate server structure report
   */
  async generateStructureReport(guildId) {
    try {
      Logger.info(`📊 Generating structure report for ${guildId}`);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return null;

      const profiles = await firebase.get(`servers/${guildId}/channel_profiles`);
      if (!profiles) return null;

      const report = {
        guildId: guildId,
        guildName: guild.name,
        generatedAt: new Date().toISOString(),
        summary: {
          totalChannels: Object.keys(profiles).length,
          byPurpose: {},
          byType: { text: 0, voice: 0 },
        },
        channels: {},
      };

      // Categorize
      for (const [channelId, profile] of Object.entries(profiles)) {
        // By purpose
        if (!report.summary.byPurpose[profile.purpose]) {
          report.summary.byPurpose[profile.purpose] = 0;
        }
        report.summary.byPurpose[profile.purpose]++;

        // By type
        report.summary.byType[profile.type]++;

        // Store details
        report.channels[channelId] = {
          name: profile.channelName,
          purpose: profile.purpose,
          type: profile.type,
          confidence: (profile.confidence * 100).toFixed(0) + '%',
          capabilities: profile.autoCapabilities?.length || 0,
        };
      }

      Logger.success('📊 Structure report generated');
      return report;
    } catch (error) {
      Logger.error('Report generation failed:', error);
      return null;
    }
  }

  /**
   * Monitor for new channels and auto-profile them
   */
  async monitorNewChannels(guild) {
    try {
      for (const [, channel] of guild.channels.cache) {
        if (channel.isDMBased()) continue;

        const existing = this.channelProfiles.has(channel.id);
        if (!existing) {
          Logger.info(`🆕 New channel detected: ${channel.name}`);
          const profile = await this.analyzeChannel(guild.id, channel);
          if (profile) {
            Logger.success(`✅ Profile created for ${channel.name}`);
          }
        }
      }
    } catch (error) {
      Logger.error('Channel monitoring failed:', error);
    }
  }
}

module.exports = SmartDiscoveryEngine;
