/**
 * VOICE PLUGIN
 * Handles voice channel automation and transcription
 */

const BasePlugin = require('./base-plugin');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class VoicePlugin extends BasePlugin {
  constructor(client) {
    super(client);
    this.name = 'Voice';
    this.version = '1.0.0';
    this.description = 'Voice channel automation and monitoring';
    this.activeVoiceSessions = new Map();
  }

  /**
   * Track voice session
   */
  async startVoiceSession(guildId, userId, channelId) {
    try {
      const sessionId = `${guildId}-${userId}-${Date.now()}`;
      
      const session = {
        sessionId,
        userId,
        guildId,
        channelId,
        startTime: new Date().toISOString(),
        endTime: null,
        duration: 0,
      };

      this.activeVoiceSessions.set(sessionId, session);
      await firebase.set(`servers/${guildId}/voice_sessions/${sessionId}`, session);

      Logger.info(`Started voice session: ${sessionId}`);
      return sessionId;
    } catch (error) {
      Logger.error('Failed to start voice session:', error);
      return null;
    }
  }

  /**
   * End voice session
   */
  async endVoiceSession(guildId, sessionId) {
    try {
      const session = this.activeVoiceSessions.get(sessionId);
      if (!session) return false;

      const endTime = new Date();
      const startTime = new Date(session.startTime);
      const duration = Math.floor((endTime - startTime) / 1000); // seconds

      const updated = {
        ...session,
        endTime: endTime.toISOString(),
        duration,
      };

      await firebase.update(`servers/${guildId}/voice_sessions/${sessionId}`, updated);
      this.activeVoiceSessions.delete(sessionId);

      Logger.info(`Ended voice session: ${sessionId} (${duration}s)`);
      return duration;
    } catch (error) {
      Logger.error('Failed to end voice session:', error);
      return null;
    }
  }

  /**
   * Handle voice state update
   */
  async onVoiceStateUpdate(oldState, newState) {
    if (!this.enabled) return;

    try {
      // User joined voice
      if (!oldState.channel && newState.channel) {
        await this.startVoiceSession(
          newState.guild.id,
          newState.member.id,
          newState.channel.id
        );
      }

      // User left voice
      if (oldState.channel && !newState.channel) {
        const sessions = Array.from(this.activeVoiceSessions.values());
        const session = sessions.find(s => s.userId === oldState.member.id);
        
        if (session) {
          await this.endVoiceSession(oldState.guild.id, session.sessionId);
        }
      }

      // User switched channels
      if (oldState.channel && newState.channel && oldState.channel !== newState.channel) {
        const sessions = Array.from(this.activeVoiceSessions.values());
        const session = sessions.find(s => s.userId === oldState.member.id);
        
        if (session) {
          await this.endVoiceSession(oldState.guild.id, session.sessionId);
          await this.startVoiceSession(
            newState.guild.id,
            newState.member.id,
            newState.channel.id
          );
        }
      }
    } catch (error) {
      Logger.error(`Voice state update error:`, error);
    }
  }

  /**
   * Get voice stats for member
   */
  async getMemberVoiceStats(guildId, memberId) {
    try {
      const sessions = await firebase.get(`servers/${guildId}/voice_sessions`);
      if (!sessions) return { totalMinutes: 0, sessionCount: 0, averageSession: 0 };

      const memberSessions = Object.values(sessions)
        .filter(s => s.userId === memberId && s.endTime);

      const totalSeconds = memberSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const averageSession = memberSessions.length > 0
        ? Math.floor(totalSeconds / memberSessions.length / 60)
        : 0;

      return {
        memberId,
        totalMinutes,
        sessionCount: memberSessions.length,
        averageSession,
        lastSession: memberSessions[0]?.endTime || null,
      };
    } catch (error) {
      Logger.error('Failed to get voice stats:', error);
      return { totalMinutes: 0, sessionCount: 0, averageSession: 0 };
    }
  }

  /**
   * Get voice channel stats
   */
  async getChannelVoiceStats(guildId, channelId) {
    try {
      const sessions = await firebase.get(`servers/${guildId}/voice_sessions`);
      if (!sessions) return { totalMinutes: 0, uniqueUsers: 0, averageUsers: 0 };

      const channelSessions = Object.values(sessions)
        .filter(s => s.channelId === channelId && s.endTime);

      const totalSeconds = channelSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const uniqueUsers = new Set(channelSessions.map(s => s.userId)).size;

      return {
        channelId,
        totalMinutes,
        uniqueUsers,
        sessionCount: channelSessions.length,
      };
    } catch (error) {
      Logger.error('Failed to get channel voice stats:', error);
      return { totalMinutes: 0, uniqueUsers: 0, sessionCount: 0 };
    }
  }

  /**
   * Get active voice channels
   */
  async getActiveVoiceChannels(guildId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return [];

      return guild.channels.cache
        .filter(channel => channel.isVoiceBased() && channel.members.size > 0)
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          memberCount: channel.members.size,
          members: channel.members.map(m => ({
            id: m.id,
            username: m.user.username,
          })),
        }));
    } catch (error) {
      Logger.error('Failed to get active voice channels:', error);
      return [];
    }
  }
}

module.exports = VoicePlugin;
