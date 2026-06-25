/**
 * SECURITY LOGGER - Phase 15
 * Tracks security events and potential threats
 * 
 * Features:
 * - Failed login attempts
 * - Permission escalations
 * - Suspicious activity
 * - Threat detection
 * - Alert system
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class SecurityLogger {
  constructor(client, database) {
    this.client = client;
    this.db = database;

    // Configuration
    this.config = {
      failedLoginThreshold: 5,        // Failed attempts to alert
      suspiciousThresholdPerHour: 10, // Suspicious events per hour
      alertThreshold: 3,              // Alert after N events
    };

    // Track failed attempts per user
    this.failedAttempts = new Map();
    this.suspiciousActivities = new Map();
  }

  /**
   * Log failed login attempt
   */
  async logFailedLogin(guildId, userId, reason = '') {
    try {
      const timestamp = new Date().toISOString();

      const logEntry = {
        id: `fail_${Date.now()}`,
        userId,
        timestamp,
        type: 'failed_login',
        reason,
        source: 'bot',
      };

      // Save to database
      await firebase.set(
        `servers/${guildId}/security_logs/failed_logins/${logEntry.id}`,
        logEntry
      );

      // Track in memory
      const key = `${guildId}_${userId}`;
      const count = (this.failedAttempts.get(key) || 0) + 1;
      this.failedAttempts.set(key, count);

      // Check threshold
      if (count >= this.config.failedLoginThreshold) {
        await this.alertFailedLogins(guildId, userId, count);
      }

      Logger.debug(`🔒 Failed login logged: ${userId}`);
      return logEntry.id;
    } catch (error) {
      Logger.error('Failed login logging error:', error);
      return null;
    }
  }

  /**
   * Log permission escalation attempt
   */
  async logEscalationAttempt(guildId, userId, attemptedPermission, reason = '') {
    try {
      const timestamp = new Date().toISOString();

      const logEntry = {
        id: `escalation_${Date.now()}`,
        userId,
        timestamp,
        type: 'escalation_attempt',
        attemptedPermission,
        reason,
        source: 'bot',
        severity: 'high',
      };

      // Save to database
      await firebase.set(
        `servers/${guildId}/security_logs/escalations/${logEntry.id}`,
        logEntry
      );

      // Alert immediately (high severity)
      await this.alertEscalationAttempt(guildId, userId, attemptedPermission);

      Logger.warn(`⚠️ Escalation attempt: ${userId} tried to escalate to ${attemptedPermission}`);
      return logEntry.id;
    } catch (error) {
      Logger.error('Escalation logging error:', error);
      return null;
    }
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(guildId, userId, activityType, severity = 'medium', details = {}) {
    try {
      const timestamp = new Date().toISOString();

      const logEntry = {
        id: `suspicious_${Date.now()}`,
        userId,
        timestamp,
        type: 'suspicious_activity',
        activityType,
        severity,  // low, medium, high, critical
        details,
        source: 'bot',
      };

      // Save to database
      await firebase.set(
        `servers/${guildId}/security_logs/suspicious/${logEntry.id}`,
        logEntry
      );

      // Track suspicious activity
      const key = `${guildId}_${userId}`;
      const count = (this.suspiciousActivities.get(key) || 0) + 1;
      this.suspiciousActivities.set(key, count);

      // Check thresholds
      if (severity === 'high' || severity === 'critical') {
        await this.alertSuspiciousActivity(guildId, userId, activityType, severity);
      }

      Logger.warn(`🚨 Suspicious activity: ${activityType} by ${userId}`);
      return logEntry.id;
    } catch (error) {
      Logger.error('Suspicious activity logging error:', error);
      return null;
    }
  }

  /**
   * Log access attempt
   */
  async logAccessAttempt(guildId, userId, resource, action, allowed) {
    try {
      const timestamp = new Date().toISOString();

      const logEntry = {
        id: `access_${Date.now()}`,
        userId,
        timestamp,
        type: 'access_attempt',
        resource,
        action,
        allowed,
        source: 'bot',
      };

      // Save to database
      const result = allowed ? 'granted' : 'denied';
      await firebase.set(
        `servers/${guildId}/security_logs/access/${result}/${logEntry.id}`,
        logEntry
      );

      if (!allowed) {
        Logger.debug(`🔒 Access denied: ${userId} tried to ${action} ${resource}`);
      }

      return logEntry.id;
    } catch (error) {
      Logger.error('Access logging error:', error);
      return null;
    }
  }

  /**
   * Log data access
   */
  async logDataAccess(guildId, userId, dataType, action) {
    try {
      const timestamp = new Date().toISOString();

      const logEntry = {
        id: `data_${Date.now()}`,
        userId,
        timestamp,
        type: 'data_access',
        dataType,
        action,
        source: 'bot',
      };

      // Save to database
      await firebase.set(
        `servers/${guildId}/security_logs/data_access/${logEntry.id}`,
        logEntry
      );

      Logger.debug(`👁️ Data accessed: ${userId} - ${dataType}`);
      return logEntry.id;
    } catch (error) {
      Logger.error('Data access logging error:', error);
      return null;
    }
  }

  /**
   * Get security summary
   */
  async getSecuritySummary(guildId) {
    try {
      const summary = {
        failedLogins: 0,
        escalationAttempts: 0,
        suspiciousActivities: 0,
        accessDenials: 0,
        lastIncident: null,
        riskLevel: 'low', // low, medium, high, critical
        alerts: [],
      };

      // Get failed logins
      const failedLogins = await firebase.get(
        `servers/${guildId}/security_logs/failed_logins`
      ) || {};
      summary.failedLogins = Object.keys(failedLogins).length;

      // Get escalation attempts
      const escalations = await firebase.get(
        `servers/${guildId}/security_logs/escalations`
      ) || {};
      summary.escalationAttempts = Object.keys(escalations).length;

      // Get suspicious activities
      const suspicious = await firebase.get(
        `servers/${guildId}/security_logs/suspicious`
      ) || {};
      summary.suspiciousActivities = Object.keys(suspicious).length;

      // Get access denials
      const denied = await firebase.get(
        `servers/${guildId}/security_logs/access/denied`
      ) || {};
      summary.accessDenials = Object.keys(denied).length;

      // Calculate risk level
      const riskScore = 
        summary.failedLogins * 1 +
        summary.escalationAttempts * 5 +
        summary.suspiciousActivities * 2 +
        summary.accessDenials * 0.5;

      if (riskScore > 50) {
        summary.riskLevel = 'critical';
      } else if (riskScore > 20) {
        summary.riskLevel = 'high';
      } else if (riskScore > 5) {
        summary.riskLevel = 'medium';
      } else {
        summary.riskLevel = 'low';
      }

      return summary;
    } catch (error) {
      Logger.error('Security summary error:', error);
      return null;
    }
  }

  /**
   * Get failed logins for user
   */
  async getFailedLogins(guildId, userId) {
    try {
      const logins = await firebase.get(
        `servers/${guildId}/security_logs/failed_logins`
      ) || {};

      return Object.values(logins)
        .filter(log => log.userId === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      Logger.error('Get failed logins error:', error);
      return [];
    }
  }

  /**
   * Detect patterns in security logs
   */
  async detectPatterns(guildId) {
    try {
      const patterns = {
        bruteForceAttempts: [],
        distributedAttacks: [],
        privilegeEscalation: [],
        dataExfiltration: [],
      };

      // Get all security logs
      const failedLogins = await firebase.get(
        `servers/${guildId}/security_logs/failed_logins`
      ) || {};

      // Detect brute force (5+ failed attempts in 10 minutes)
      const userAttempts = {};
      for (const log of Object.values(failedLogins)) {
        if (!userAttempts[log.userId]) {
          userAttempts[log.userId] = [];
        }
        userAttempts[log.userId].push(new Date(log.timestamp));
      }

      for (const [userId, attempts] of Object.entries(userAttempts)) {
        if (attempts.length >= 5) {
          const timeWindow = 10 * 60 * 1000; // 10 minutes
          const recentAttempts = attempts.filter(time =>
            Date.now() - time < timeWindow
          );

          if (recentAttempts.length >= 5) {
            patterns.bruteForceAttempts.push({
              userId,
              attempts: recentAttempts.length,
              timeWindow: '10 minutes',
              severity: 'high',
            });
          }
        }
      }

      return patterns;
    } catch (error) {
      Logger.error('Pattern detection error:', error);
      return null;
    }
  }

  /**
   * Alert on failed logins
   */
  async alertFailedLogins(guildId, userId, count) {
    try {
      Logger.warn(
        `🚨 ALERT: ${userId} has ${count} failed login attempts`
      );

      // Could send notifications here
      // For now, just log it
    } catch (error) {
      Logger.error('Failed login alert error:', error);
    }
  }

  /**
   * Alert on escalation attempt
   */
  async alertEscalationAttempt(guildId, userId, permission) {
    try {
      Logger.warn(
        `🚨 CRITICAL: Escalation attempt by ${userId} for ${permission}`
      );

      // Notify server owner
      const guild = this.client.guilds.cache.get(guildId);
      if (guild) {
        const owner = await guild.fetchOwner();
        if (owner && owner.user) {
          try {
            await owner.user.send(
              `🚨 **Critical Security Alert**\n\n` +
              `Escalation Attempt Detected!\n` +
              `User: <@${userId}>\n` +
              `Attempted Permission: ${permission}\n` +
              `Time: ${new Date().toLocaleString()}\n\n` +
              `Please investigate immediately.`
            );
          } catch (e) {
            Logger.warn('Could not alert server owner');
          }
        }
      }
    } catch (error) {
      Logger.error('Escalation alert error:', error);
    }
  }

  /**
   * Alert on suspicious activity
   */
  async alertSuspiciousActivity(guildId, userId, activityType, severity) {
    try {
      Logger.warn(
        `⚠️ Alert: Suspicious activity - ${activityType} by ${userId} (${severity})`
      );

      // Send alert based on severity
      if (severity === 'critical') {
        // Immediate notification
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
          const owner = await guild.fetchOwner();
          if (owner && owner.user) {
            await owner.user.send(
              `🚨 **Critical Security Alert**\n\n` +
              `${activityType}\n` +
              `User: <@${userId}>\n` +
              `Severity: Critical`
            ).catch(() => {});
          }
        }
      }
    } catch (error) {
      Logger.error('Suspicious activity alert error:', error);
    }
  }

  /**
   * Clear failed attempts cache
   */
  clearFailedAttempts(guildId, userId) {
    const key = `${guildId}_${userId}`;
    this.failedAttempts.delete(key);
  }

  /**
   * Clear suspicious activity cache
   */
  clearSuspiciousActivities(guildId, userId) {
    const key = `${guildId}_${userId}`;
    this.suspiciousActivities.delete(key);
  }
}

module.exports = SecurityLogger;
