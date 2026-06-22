/**
 * MODERATION PLUGIN
 * Handles moderation, warnings, and member management
 */

const BasePlugin = require('./base-plugin');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class ModerationPlugin extends BasePlugin {
  constructor(client) {
    super(client);
    this.name = 'Moderation';
    this.version = '1.0.0';
    this.description = 'Moderation and member management';
  }

  /**
   * Warn member
   */
  async warnMember(guildId, memberId, reason, moderatorId) {
    try {
      const warning = {
        memberId,
        reason,
        moderatorId,
        timestamp: new Date().toISOString(),
      };

      await firebase.push(`servers/${guildId}/warnings/${memberId}`, warning);
      Logger.info(`Warned member ${memberId}: ${reason}`);
      return true;
    } catch (error) {
      Logger.error('Failed to warn member:', error);
      return false;
    }
  }

  /**
   * Get member warnings
   */
  async getMemberWarnings(guildId, memberId) {
    try {
      const warnings = await firebase.get(`servers/${guildId}/warnings/${memberId}`);
      if (!warnings) return [];

      return Object.entries(warnings).map(([id, warning]) => ({
        id,
        ...warning,
      }));
    } catch (error) {
      Logger.error('Failed to get warnings:', error);
      return [];
    }
  }

  /**
   * Clear warnings
   */
  async clearWarnings(guildId, memberId) {
    try {
      await firebase.remove(`servers/${guildId}/warnings/${memberId}`);
      Logger.info(`Cleared warnings for ${memberId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to clear warnings:', error);
      return false;
    }
  }

  /**
   * Mute member
   */
  async muteMember(guild, member, reason, duration) {
    try {
      await member.timeout(duration, reason);

      const muteRecord = {
        memberId: member.id,
        reason,
        duration,
        mutedAt: new Date().toISOString(),
        unmuteAt: new Date(Date.now() + duration).toISOString(),
      };

      await firebase.push(`servers/${guild.id}/mutes`, muteRecord);
      Logger.info(`Muted member ${member.id} for ${duration}ms`);
      return true;
    } catch (error) {
      Logger.error('Failed to mute member:', error);
      return false;
    }
  }

  /**
   * Create moderation log
   */
  async createModLog(guildId, action, targetId, moderatorId, reason) {
    try {
      const logEntry = {
        action, // warn, mute, kick, ban
        targetId,
        moderatorId,
        reason,
        timestamp: new Date().toISOString(),
      };

      await firebase.push(`servers/${guildId}/moderation_logs`, logEntry);
      return true;
    } catch (error) {
      Logger.error('Failed to create mod log:', error);
      return false;
    }
  }

  /**
   * Get moderation logs
   */
  async getModLogs(guildId, limit = 50) {
    try {
      const logs = await firebase.get(`servers/${guildId}/moderation_logs`);
      if (!logs) return [];

      return Object.entries(logs)
        .map(([id, log]) => ({ id, ...log }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      Logger.error('Failed to get mod logs:', error);
      return [];
    }
  }

  /**
   * Check member status
   */
  async getMemberStatus(guild, memberId) {
    try {
      const member = await guild.members.fetch(memberId);
      const warnings = await this.getMemberWarnings(guild.id, memberId);
      const mutes = await firebase.get(`servers/${guild.id}/mutes/${memberId}`);

      return {
        id: member.id,
        username: member.user.username,
        joinedAt: member.joinedAt,
        warningCount: warnings.length,
        isMuted: member.isCommunicationDisabled(),
        roles: member.roles.cache.size,
      };
    } catch (error) {
      Logger.error('Failed to get member status:', error);
      return null;
    }
  }
}

module.exports = ModerationPlugin;
