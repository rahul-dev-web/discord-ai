/**
 * ANALYTICS PLUGIN
 * Tracks server activity, member engagement, and metrics
 */

const BasePlugin = require('./base-plugin');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class AnalyticsPlugin extends BasePlugin {
  constructor(client) {
    super(client);
    this.name = 'Analytics';
    this.version = '1.0.0';
    this.description = 'Server analytics and statistics';
  }

  /**
   * Track message activity
   */
  async trackMessage(guildId, channelId, userId) {
    try {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const path = `servers/${guildId}/analytics/messages/${date}`;

      const data = await firebase.get(path);
      const updated = {
        ...(data || {}),
        [channelId]: (data?.[channelId] || 0) + 1,
        total: (data?.total || 0) + 1,
      };

      await firebase.update(path, updated);
    } catch (error) {
      Logger.error('Failed to track message:', error);
    }
  }

  /**
   * Track member join
   */
  async trackMemberJoin(guildId, memberId) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const path = `servers/${guildId}/analytics/joins/${date}`;

      const data = await firebase.get(path);
      await firebase.update(path, {
        ...(data || {}),
        total: (data?.total || 0) + 1,
      });
    } catch (error) {
      Logger.error('Failed to track join:', error);
    }
  }

  /**
   * Track member leave
   */
  async trackMemberLeave(guildId, memberId) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const path = `servers/${guildId}/analytics/leaves/${date}`;

      const data = await firebase.get(path);
      await firebase.update(path, {
        ...(data || {}),
        total: (data?.total || 0) + 1,
      });
    } catch (error) {
      Logger.error('Failed to track leave:', error);
    }
  }

  /**
   * Get daily stats
   */
  async getDailyStats(guildId, date) {
    try {
      const messages = await firebase.get(`servers/${guildId}/analytics/messages/${date}`);
      const joins = await firebase.get(`servers/${guildId}/analytics/joins/${date}`);
      const leaves = await firebase.get(`servers/${guildId}/analytics/leaves/${date}`);

      return {
        date,
        messages: messages?.total || 0,
        joins: joins?.total || 0,
        leaves: leaves?.total || 0,
        netChange: (joins?.total || 0) - (leaves?.total || 0),
      };
    } catch (error) {
      Logger.error('Failed to get daily stats:', error);
      return null;
    }
  }

  /**
   * Get weekly stats
   */
  async getWeeklyStats(guildId) {
    try {
      const stats = {
        weekStats: [],
        totalMessages: 0,
        totalJoins: 0,
        totalLeaves: 0,
      };

      // Get last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dailyStats = await this.getDailyStats(guildId, dateStr);
        if (dailyStats) {
          stats.weekStats.push(dailyStats);
          stats.totalMessages += dailyStats.messages;
          stats.totalJoins += dailyStats.joins;
          stats.totalLeaves += dailyStats.leaves;
        }
      }

      return stats;
    } catch (error) {
      Logger.error('Failed to get weekly stats:', error);
      return null;
    }
  }

  /**
   * Get member activity
   */
  async getMemberActivity(guildId, memberId) {
    try {
      const memberData = await firebase.get(`servers/${guildId}/member_activity/${memberId}`);

      return {
        memberId,
        messageCount: memberData?.messageCount || 0,
        lastActive: memberData?.lastActive || null,
        joinDate: memberData?.joinDate || null,
      };
    } catch (error) {
      Logger.error('Failed to get member activity:', error);
      return null;
    }
  }

  /**
   * Track command usage
   */
  async trackCommandUsage(guildId, commandName, userId) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const path = `servers/${guildId}/analytics/commands/${date}/${commandName}`;

      const data = await firebase.get(path);
      await firebase.update(path, {
        ...(data || {}),
        usage: (data?.usage || 0) + 1,
        lastUsedBy: userId,
        lastUsedAt: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Failed to track command usage:', error);
    }
  }

  /**
   * Get top commands
   */
  async getTopCommands(guildId, date) {
    try {
      const commands = await firebase.get(`servers/${guildId}/analytics/commands/${date}`);
      if (!commands) return [];

      return Object.entries(commands)
        .map(([name, data]) => ({
          name,
          usage: data.usage || 0,
          lastUsedAt: data.lastUsedAt,
        }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 10);
    } catch (error) {
      Logger.error('Failed to get top commands:', error);
      return [];
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(guildId, period = 'week') {
    try {
      const stats = await this.getWeeklyStats(guildId);
      const date = new Date().toISOString().split('T')[0];
      const topCommands = await this.getTopCommands(guildId, date);

      const report = {
        guildId,
        period,
        generatedAt: new Date().toISOString(),
        stats,
        topCommands,
        engagement: {
          averageMessagesPerDay: Math.round(stats.totalMessages / 7),
          memberGrowth: stats.totalJoins - stats.totalLeaves,
        },
      };

      // Save report
      await firebase.push(`servers/${guildId}/analytics_reports`, report);

      return report;
    } catch (error) {
      Logger.error('Failed to generate report:', error);
      return null;
    }
  }
}

module.exports = AnalyticsPlugin;
