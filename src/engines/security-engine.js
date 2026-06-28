/**
 * SECURITY ENGINE
 * Manages risk levels, password protection, and action validation
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class SecurityEngine {
  constructor(client, database) {
    this.client = client;
    this.db = database;
  }

  /**
   * Hash password with bcrypt (supports legacy PBKDF2 verification)
   */
  hashPassword(password) {
    return bcrypt.hashSync(password, 12);
  }

  hashPasswordLegacy(password) {
    return crypto
      .pbkdf2Sync(password, process.env.SECURITY_SALT, 10000, 64, 'sha256')
      .toString('hex');
  }

  /**
   * Verify password
   */
  verifyPassword(password, hash) {
    if (!hash) return false;

    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      return bcrypt.compareSync(password, hash);
    }

    return this.hashPasswordLegacy(password) === hash;
  }

  /**
   * Create OTP for verification
   */
  generateOTP(length = 6) {
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += crypto.randomInt(0, 10).toString();
    }
    return otp;
  }

  /**
   * Store OTP temporarily
   */
  async storeOTP(guildId, userId, otp, expiryMinutes = 10) {
    try {
      const path = `servers/${guildId}/otp/${userId}`;
      await firebase.set(path, {
        otp,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiryMinutes * 60000).toISOString(),
      });
      return true;
    } catch (error) {
      Logger.error('Failed to store OTP:', error);
      return false;
    }
  }

  /**
   * Verify OTP
   */
  async verifyOTP(guildId, userId, otp) {
    try {
      const data = await firebase.get(`servers/${guildId}/otp/${userId}`);
      if (!data) return false;

      const expiresAt = new Date(data.expiresAt);
      if (expiresAt < new Date()) {
        // OTP expired
        await firebase.remove(`servers/${guildId}/otp/${userId}`);
        return false;
      }

      const isValid = data.otp === otp;
      if (isValid) {
        // Clear OTP after verification
        await firebase.remove(`servers/${guildId}/otp/${userId}`);
      }
      return isValid;
    } catch (error) {
      Logger.error('Failed to verify OTP:', error);
      return false;
    }
  }

  /**
   * Assess risk level of an action
   * Returns: low, medium, high, critical
   */
  assessRiskLevel(action, context) {
    const riskMap = {
      // Critical - Irreversible
      'delete_server': 'critical',
      'delete_all_channels': 'critical',
      'delete_all_roles': 'critical',
      'ban_all_members': 'critical',

      // High - Server Changes
      'create_category': 'high',
      'delete_category': 'high',
      'manage_roles': 'high',
      'manage_channels': 'high',
      'change_server_settings': 'high',

      // Medium - Modifications
      'send_announcement': 'medium',
      'create_event': 'medium',
      'delete_messages': 'medium',
      'timeout_member': 'medium',

      // Low - Read-only
      'read_logs': 'low',
      'view_analytics': 'low',
      'list_members': 'low',
      'view_settings': 'low',
    };

    return riskMap[action] || 'medium';
  }

  /**
   * Validate action based on risk level
   */
  async validateAction(guildId, userId, action, context) {
    try {
      const riskLevel = this.assessRiskLevel(action, context);

      const validation = {
        action,
        userId,
        guildId,
        riskLevel,
        requires: this.getValidationRequirement(riskLevel),
        validated: false,
        validatedAt: null,
      };

      return validation;
    } catch (error) {
      Logger.error('Failed to validate action:', error);
      return null;
    }
  }

  /**
   * Get validation requirement based on risk level
   */
  getValidationRequirement(riskLevel) {
    const requirements = {
      low: {
        needsPreview: false,
        needsConfirmation: false,
        needsPassword: false,
      },
      medium: {
        needsPreview: true,
        needsConfirmation: true,
        needsPassword: false,
      },
      high: {
        needsPreview: true,
        needsConfirmation: true,
        needsPassword: false,
      },
      critical: {
        needsPreview: true,
        needsConfirmation: true,
        needsPassword: true,
      },
    };

    return requirements[riskLevel] || requirements.medium;
  }

  /**
   * Create action log for audit trail
   */
  async logAction(guildId, userId, action, status, details) {
    try {
      const logEntry = {
        userId,
        action,
        status, // 'success', 'failed', 'denied'
        details,
        timestamp: new Date().toISOString(),
      };

      const logId = await firebase.push(`servers/${guildId}/audit_logs`, logEntry);
      return logId;
    } catch (error) {
      Logger.error('Failed to log action:', error);
      return null;
    }
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(guildId, limit = 100) {
    try {
      const logs = await firebase.get(`servers/${guildId}/audit_logs`);
      if (!logs) return [];

      const logArray = Object.entries(logs)
        .map(([id, log]) => ({ id, ...log }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);

      return logArray;
    } catch (error) {
      Logger.error('Failed to get audit logs:', error);
      return [];
    }
  }

  /**
   * Rate limit check
   */
  async checkRateLimit(userId, action, limit = 5, windowMs = 60000) {
    try {
      const key = `ratelimit:${userId}:${action}`;
      const data = await firebase.get(key);

      if (!data) {
        await firebase.set(key, {
          count: 1,
          resetAt: new Date(Date.now() + windowMs).toISOString(),
        });
        return { allowed: true, remaining: limit - 1 };
      }

      const resetAt = new Date(data.resetAt);
      if (resetAt < new Date()) {
        // Window expired
        await firebase.set(key, {
          count: 1,
          resetAt: new Date(Date.now() + windowMs).toISOString(),
        });
        return { allowed: true, remaining: limit - 1 };
      }

      if (data.count >= limit) {
        return { allowed: false, remaining: 0, retryAfter: resetAt };
      }

      await firebase.update(key, { count: data.count + 1 });
      return { allowed: true, remaining: limit - data.count - 1 };
    } catch (error) {
      Logger.error('Rate limit check failed:', error);
      return { allowed: true }; // Allow if check fails
    }
  }

  /**
   * Generate recovery codes
   */
  generateRecoveryCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Store recovery codes
   */
  async storeRecoveryCodes(guildId, userId, codes) {
    try {
      const hashedCodes = codes.map(code => this.hashPassword(code));
      const path = `servers/${guildId}/recovery_codes/${userId}`;
      
      await firebase.set(path, {
        codes: hashedCodes,
        usedCodes: [],
        createdAt: new Date().toISOString(),
      });
      
      return codes; // Return plain codes to show user
    } catch (error) {
      Logger.error('Failed to store recovery codes:', error);
      return null;
    }
  }

  /**
   * Verify recovery code
   */
  async verifyRecoveryCode(guildId, userId, code) {
    try {
      const data = await firebase.get(`servers/${guildId}/recovery_codes/${userId}`);
      if (!data) return false;

      const hashedCode = this.hashPassword(code);
      const isValid = data.codes.includes(hashedCode);

      if (isValid && !data.usedCodes.includes(hashedCode)) {
        // Mark code as used
        await firebase.update(`servers/${guildId}/recovery_codes/${userId}`, {
          usedCodes: [...data.usedCodes, hashedCode],
        });
        return true;
      }

      return false;
    } catch (error) {
      Logger.error('Failed to verify recovery code:', error);
      return false;
    }
  }
}

module.exports = SecurityEngine;
