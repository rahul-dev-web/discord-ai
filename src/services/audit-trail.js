/**
 * AUDIT TRAIL SERVICE - Phase 15
 * Maintains immutable audit trail of all actions
 * 
 * Features:
 * - Immutable action history
 * - Change tracking
 * - User activity timeline
 * - Permission audit
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class AuditTrail {
  constructor(client, database) {
    this.client = client;
    this.db = database;
  }

  /**
   * Record an action in audit trail
   */
  async recordAction(guildId, userId, action, details = {}) {
    try {
      const timestamp = new Date().toISOString();
      const dateStr = timestamp.split('T')[0];

      const auditEntry = {
        timestamp,
        userId,
        action,
        ...details,
      };

      // Save to audit trail (immutable - append only)
      const trailPath = `servers/${guildId}/audit_trail/${userId}/${dateStr}`;
      const trail = (await firebase.get(trailPath)) || [];

      trail.push(auditEntry);

      // Limit trail length (keep only last 1000 entries per day)
      if (trail.length > 1000) {
        trail.shift();
      }

      await firebase.set(trailPath, trail);

      Logger.debug(`📋 Audit trail recorded: ${action}`);
      return auditEntry;
    } catch (error) {
      Logger.error('Audit trail error:', error);
      return null;
    }
  }

  /**
   * Record role change
   */
  async recordRoleChange(guildId, targetUserId, fromRole, toRole, changedBy, reason = '') {
    return await this.recordAction(guildId, targetUserId, 'role_changed', {
      from: fromRole,
      to: toRole,
      changedBy,
      reason,
    });
  }

  /**
   * Record permission change
   */
  async recordPermissionChange(guildId, targetUserId, permission, granted, changedBy) {
    return await this.recordAction(guildId, targetUserId, 'permission_changed', {
      permission,
      granted,
      changedBy,
    });
  }

  /**
   * Record command execution
   */
  async recordCommand(guildId, userId, command, success, details = {}) {
    return await this.recordAction(guildId, userId, 'command_executed', {
      command,
      success,
      ...details,
    });
  }

  /**
   * Record data access
   */
  async recordDataAccess(guildId, userId, dataType, action, success) {
    return await this.recordAction(guildId, userId, 'data_accessed', {
      dataType,
      action,
      success,
    });
  }

  /**
   * Record failed attempt
   */
  async recordFailedAttempt(guildId, userId, attemptType, reason) {
    return await this.recordAction(guildId, userId, 'failed_attempt', {
      attemptType,
      reason,
    });
  }

  /**
   * Get user's full audit trail
   */
  async getUserTrail(guildId, userId) {
    try {
      const trail = [];
      const basePathTrail = `servers/${guildId}/audit_trail/${userId}`;
      const dates = await firebase.get(basePathTrail) || {};

      // Iterate through all dates
      for (const [date, entries] of Object.entries(dates)) {
        if (Array.isArray(entries)) {
          trail.push(...entries);
        }
      }

      // Sort by timestamp (newest first)
      trail.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );

      return {
        userId,
        totalActions: trail.length,
        actions: trail.slice(0, 100), // Last 100
      };
    } catch (error) {
      Logger.error('Get user trail error:', error);
      return { userId, totalActions: 0, actions: [] };
    }
  }

  /**
   * Get all changes for a user
   */
  async getUserChanges(guildId, userId, limit = 50) {
    try {
      const trail = await this.getUserTrail(guildId, userId);

      // Filter only change actions
      const changes = trail.actions.filter(action =>
        ['role_changed', 'permission_changed'].includes(action.action)
      );

      return changes.slice(0, limit);
    } catch (error) {
      Logger.error('Get user changes error:', error);
      return [];
    }
  }

  /**
   * Get permission audit
   */
  async getPermissionAudit(guildId) {
    try {
      const audit = [];
      const auditPath = `servers/${guildId}/audit_trail`;

      const allTrails = await firebase.get(auditPath) || {};

      // Iterate through all users
      for (const [userId, dateTrails] of Object.entries(allTrails)) {
        for (const [, entries] of Object.entries(dateTrails)) {
          if (Array.isArray(entries)) {
            const permissionChanges = entries.filter(e =>
              ['permission_changed', 'role_changed'].includes(e.action)
            );
            audit.push(...permissionChanges.map(e => ({
              ...e,
              userId,
            })));
          }
        }
      }

      // Sort by timestamp (newest first)
      audit.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );

      return audit;
    } catch (error) {
      Logger.error('Permission audit error:', error);
      return [];
    }
  }

  /**
   * Get activity timeline for date range
   */
  async getActivityTimeline(guildId, fromDate, toDate) {
    try {
      const timeline = [];
      const auditPath = `servers/${guildId}/audit_trail`;

      const allTrails = await firebase.get(auditPath) || {};

      const from = new Date(fromDate);
      const to = new Date(toDate);

      // Iterate through all users and dates
      for (const [userId, dateTrails] of Object.entries(allTrails)) {
        for (const [date, entries] of Object.entries(dateTrails)) {
          const entryDate = new Date(date);

          if (entryDate >= from && entryDate <= to) {
            if (Array.isArray(entries)) {
              timeline.push(...entries.map(e => ({
                ...e,
                userId,
              })));
            }
          }
        }
      }

      // Sort by timestamp
      timeline.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );

      return timeline;
    } catch (error) {
      Logger.error('Activity timeline error:', error);
      return [];
    }
  }

  /**
   * Get change history for specific user
   */
  async getChangeHistory(guildId, userId) {
    try {
      const changes = await this.getUserChanges(guildId, userId, 1000);

      // Group by action type
      const grouped = {};

      for (const change of changes) {
        const actionType = change.action;
        if (!grouped[actionType]) {
          grouped[actionType] = [];
        }
        grouped[actionType].push(change);
      }

      return {
        userId,
        summary: {
          totalChanges: changes.length,
          roleChanges: grouped.role_changed?.length || 0,
          permissionChanges: grouped.permission_changed?.length || 0,
        },
        changes: grouped,
      };
    } catch (error) {
      Logger.error('Change history error:', error);
      return { userId, summary: {}, changes: {} };
    }
  }

  /**
   * Export audit trail as CSV
   */
  async exportAuditTrailAsCSV(guildId) {
    try {
      const auditPath = `servers/${guildId}/audit_trail`;
      const allTrails = await firebase.get(auditPath) || {};

      let csv = 'Timestamp,User,Action,From,To,ChangedBy,Reason,Details\n';

      for (const [userId, dateTrails] of Object.entries(allTrails)) {
        for (const [, entries] of Object.entries(dateTrails)) {
          if (Array.isArray(entries)) {
            for (const entry of entries) {
              csv += `"${entry.timestamp}",`;
              csv += `"${userId}",`;
              csv += `"${entry.action}",`;
              csv += `"${entry.from || ''}",`;
              csv += `"${entry.to || ''}",`;
              csv += `"${entry.changedBy || ''}",`;
              csv += `"${(entry.reason || '').replace(/"/g, '""')}",`;
              csv += `"${JSON.stringify(entry).replace(/"/g, '""')}"\n`;
            }
          }
        }
      }

      return csv;
    } catch (error) {
      Logger.error('Audit trail export error:', error);
      return null;
    }
  }

  /**
   * Verify integrity of audit trail
   */
  async verifyIntegrity(guildId) {
    try {
      const auditPath = `servers/${guildId}/audit_trail`;
      const allTrails = await firebase.get(auditPath) || {};

      const result = {
        totalUsers: Object.keys(allTrails).length,
        totalEntries: 0,
        integrityOK: true,
        issues: [],
      };

      for (const [userId, dateTrails] of Object.entries(allTrails)) {
        for (const [date, entries] of Object.entries(dateTrails)) {
          if (!Array.isArray(entries)) {
            result.issues.push(`Invalid entry format for user ${userId} on ${date}`);
            result.integrityOK = false;
            continue;
          }

          result.totalEntries += entries.length;

          // Check each entry has required fields
          for (const entry of entries) {
            if (!entry.timestamp || !entry.action) {
              result.issues.push(`Missing required fields in entry for ${userId}`);
              result.integrityOK = false;
            }
          }
        }
      }

      return result;
    } catch (error) {
      Logger.error('Integrity verification error:', error);
      return {
        totalUsers: 0,
        totalEntries: 0,
        integrityOK: false,
        issues: [error.message],
      };
    }
  }

  /**
   * Clean old audit entries (archive)
   */
  async archiveOldEntries(guildId, olderThanDays = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const auditPath = `servers/${guildId}/audit_trail`;
      const allTrails = await firebase.get(auditPath) || {};

      let archivedCount = 0;

      for (const [userId, dateTrails] of Object.entries(allTrails)) {
        for (const [date, entries] of Object.entries(dateTrails)) {
          const entryDate = new Date(date);

          if (entryDate < cutoffDate) {
            // Archive this date's entries
            const archivePath = `servers/${guildId}/audit_trail_archive/${userId}/${date}`;
            await firebase.set(archivePath, entries);

            // Delete from main trail
            await firebase.delete(`${auditPath}/${userId}/${date}`);

            archivedCount += entries.length || 0;
          }
        }
      }

      Logger.info(`📦 Archived ${archivedCount} audit entries for ${guildId}`);
      return archivedCount;
    } catch (error) {
      Logger.error('Archive error:', error);
      return 0;
    }
  }
}

module.exports = AuditTrail;
