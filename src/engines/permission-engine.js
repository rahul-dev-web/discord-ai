/**
 * PERMISSION ENGINE
 * Checks permissions, roles, and trust levels
 */

const { PermissionFlagsBits } = require('discord.js');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class PermissionEngine {
  constructor(client, database) {
    this.client = client;
    this.db = database;
  }

  /**
   * Check if user has Discord permission
   */
  hasDiscordPermission(member, permission) {
    if (!member) return false;
    return member.permissions.has(permission);
  }

  /**
   * Check if user is server owner
   */
  isOwner(guild, userId) {
    return guild.ownerId === userId;
  }

  /**
   * Check if user is admin
   */
  isAdmin(member) {
    return (
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild)
    );
  }

  /**
   * Check if user has role
   */
  hasRole(member, roleId) {
    return member.roles.cache.has(roleId);
  }

  /**
   * Get user's role hierarchy level
   */
  getRoleLevel(member) {
    if (member.guild.ownerId === member.id) return 100; // Owner
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return 90; // Admin
    
    // Find highest role position
    const highestRole = member.roles.highest;
    return highestRole.position || 0;
  }

  /**
   * Check capability
   */
  async hasCapability(member, capability) {
    try {
      // Get role capabilities from Firebase
      const capabilities = await firebase.get(
        `servers/${member.guild.id}/capabilities/${member.id}`
      );

      if (!capabilities) return false;
      return capabilities[capability] === true;
    } catch (error) {
      Logger.error('Failed to check capability:', error);
      return false;
    }
  }

  /**
   * Grant capability to member
   */
  async grantCapability(guildId, memberId, capability, value = true) {
    try {
      const path = `servers/${guildId}/capabilities/${memberId}`;
      await firebase.update(path, { [capability]: value });
      Logger.info(`Granted ${capability} to ${memberId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to grant capability:', error);
      return false;
    }
  }

  /**
   * Check if action is allowed
   */
  async canPerformAction(member, action, riskLevel = 'low') {
    try {
      const ownerOnly = ['bot_config', 'shutdown', 'reset'];
      const adminOnly = ['manage_roles', 'manage_channels', 'manage_members'];

      // Owner-only actions
      if (ownerOnly.includes(action)) {
        return this.isOwner(member.guild, member.id);
      }

      // Admin-only actions
      if (adminOnly.includes(action)) {
        return this.isAdmin(member);
      }

      // Check capabilities
      return await this.hasCapability(member, action);
    } catch (error) {
      Logger.error('Failed to check action permission:', error);
      return false;
    }
  }

  /**
   * Get action risk level
   * LOW: Read-only, non-destructive
   * MEDIUM: Modifications, may need preview
   * HIGH: Server changes, needs confirmation
   * CRITICAL: Irreversible, needs password
   */
  getActionRiskLevel(action) {
    const riskMap = {
      // Critical
      'delete_server': 'critical',
      'delete_category': 'critical',
      'remove_member': 'critical',
      'reset_roles': 'critical',

      // High
      'create_category': 'high',
      'manage_roles': 'high',
      'manage_channels': 'high',
      'change_settings': 'high',

      // Medium
      'send_announcement': 'medium',
      'create_event': 'medium',
      'update_topic': 'medium',

      // Low
      'read_logs': 'low',
      'view_stats': 'low',
      'list_members': 'low',
    };

    return riskMap[action] || 'medium';
  }

  /**
   * Create trust score for member
   */
  async createTrustScore(member) {
    const score = {
      userId: member.id,
      guildId: member.guild.id,
      
      // Factors
      accountAge: this.getAccountAge(member.user),
      serverJoinAge: this.getServerJoinAge(member),
      roleCount: member.roles.cache.size,
      isVerified: member.user.verified || false,
      isBoosting: member.isCommunicationDisabled() === false,
      
      // Calculated score (0-100)
      totalScore: 0,
      level: 'none', // none, low, medium, high, trusted
      
      calculatedAt: new Date().toISOString(),
    };

    // Calculate score
    let total = 0;
    if (score.accountAge > 30) total += 20;
    if (score.serverJoinAge > 7) total += 20;
    if (score.roleCount > 3) total += 15;
    if (score.isVerified) total += 15;
    if (score.isBoosting) total += 10;

    score.totalScore = total;

    // Determine level
    if (total < 20) score.level = 'none';
    else if (total < 40) score.level = 'low';
    else if (total < 70) score.level = 'medium';
    else if (total < 90) score.level = 'high';
    else score.level = 'trusted';

    return score;
  }

  /**
   * Get account age in days
   */
  getAccountAge(user) {
    const createdAt = user.createdAt;
    const now = new Date();
    return Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get server join age in days
   */
  getServerJoinAge(member) {
    const joinedAt = member.joinedAt;
    const now = new Date();
    return Math.floor((now - joinedAt) / (1000 * 60 * 60 * 24));
  }

  /**
   * Save trust score
   */
  async saveTrustScore(score) {
    try {
      const path = `servers/${score.guildId}/trust_scores/${score.userId}`;
      await firebase.set(path, score);
      return true;
    } catch (error) {
      Logger.error('Failed to save trust score:', error);
      return false;
    }
  }
}

module.exports = PermissionEngine;
