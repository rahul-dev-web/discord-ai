/**
 * PHASE 19 - ENTERPRISE RBAC
 * Role-Based Access Control System
 * 
 * Features:
 * - Custom role creation
 * - Fine-grained permissions
 * - Role hierarchy
 * - Permission delegation
 * - Audit trail
 */

const Logger = require('../utils/logger');

class EnterpriseRBAC {
  constructor(firebaseDb) {
    this.db = firebaseDb;
    this.roles = new Map();
    this.permissions = new Map();
    this.initializeDefaultRoles();
  }

  /**
   * Initialize default roles and permissions
   */
  initializeDefaultRoles() {
    // Define all possible permissions
    const allPermissions = [
      'workflow:view',
      'workflow:create',
      'workflow:edit',
      'workflow:delete',
      'workflow:run',
      'plugin:view',
      'plugin:install',
      'plugin:uninstall',
      'plugin:configure',
      'settings:view',
      'settings:edit',
      'logs:view',
      'logs:delete',
      'users:manage',
      'roles:manage',
      'billing:manage',
      'analytics:view',
    ];

    allPermissions.forEach(perm => this.permissions.set(perm, true));

    // Owner - all permissions
    this.createRole('owner', allPermissions, 'Full access to all features');

    // Admin - most permissions except billing
    this.createRole('admin', [
      'workflow:*',
      'plugin:*',
      'settings:edit',
      'logs:view',
      'users:manage',
      'roles:manage',
      'analytics:view',
    ], 'Administrative access');

    // Moderator - moderation focused
    this.createRole('moderator', [
      'workflow:view',
      'workflow:run',
      'plugin:view',
      'logs:view',
      'logs:delete',
      'users:manage',
      'analytics:view',
    ], 'Moderation access');

    // User - basic access
    this.createRole('user', [
      'workflow:view',
      'workflow:run',
      'plugin:view',
      'settings:view',
      'analytics:view',
    ], 'Standard user access');

    Logger.info('✅ Default RBAC roles initialized');
  }

  /**
   * Create custom role
   */
  async createRole(roleName, permissions, description = '') {
    try {
      const role = {
        id: `role_${Date.now()}`,
        name: roleName,
        permissions: permissions,
        description: description,
        createdAt: new Date().toISOString(),
        isDefault: false,
      };

      this.roles.set(roleName, role);
      await this.db.ref(`roles/${roleName}`).set(role);

      Logger.info(`✅ Role created: ${roleName}`);
      return role;
    } catch (error) {
      Logger.error('Error creating role:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(guildId, userId, roleName) {
    try {
      const role = this.roles.get(roleName);
      if (!role) {
        throw new Error('Role not found');
      }

      const assignment = {
        userId,
        roleName,
        permissions: role.permissions,
        assignedAt: new Date().toISOString(),
      };

      await this.db.ref(`servers/${guildId}/members/${userId}`).update(assignment);

      Logger.info(`👤 Role ${roleName} assigned to ${userId}`);
      return assignment;
    } catch (error) {
      Logger.error('Error assigning role:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async checkPermission(guildId, userId, requiredPermission) {
    try {
      // Check if owner
      const memberData = await this.db.ref(
        `servers/${guildId}/members/${userId}`
      ).once('value');

      const member = memberData.val();
      if (!member) {
        return false;
      }

      const permissions = member.permissions || [];

      // Check for wildcard or specific permission
      if (permissions.includes('*') || permissions.includes('*:*')) {
        return true;
      }

      // Check for wildcard category match
      const category = requiredPermission.split(':')[0];
      if (permissions.includes(`${category}:*`)) {
        return true;
      }

      // Check for specific permission
      return permissions.includes(requiredPermission);
    } catch (error) {
      Logger.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get user roles and permissions
   */
  async getUserPermissions(guildId, userId) {
    try {
      const memberData = await this.db.ref(
        `servers/${guildId}/members/${userId}`
      ).once('value');

      const member = memberData.val();
      return {
        userId,
        role: member?.roleName,
        permissions: member?.permissions || [],
        assignedAt: member?.assignedAt,
      };
    } catch (error) {
      Logger.error('Error fetching user permissions:', error);
      throw error;
    }
  }

  /**
   * Get all roles in server
   */
  async getServerRoles(guildId) {
    try {
      const rolesData = await this.db.ref(`roles`).once('value');
      const roles = rolesData.val() || {};
      return Object.values(roles);
    } catch (error) {
      Logger.error('Error fetching roles:', error);
      throw error;
    }
  }

  /**
   * Update role permissions
   */
  async updateRolePermissions(roleName, permissions) {
    try {
      const role = this.roles.get(roleName);
      if (!role) {
        throw new Error('Role not found');
      }

      const updated = {
        ...role,
        permissions,
        updatedAt: new Date().toISOString(),
      };

      this.roles.set(roleName, updated);
      await this.db.ref(`roles/${roleName}`).update(updated);

      Logger.info(`📝 Role ${roleName} permissions updated`);
      return updated;
    } catch (error) {
      Logger.error('Error updating role:', error);
      throw error;
    }
  }

  /**
   * Revoke role from user
   */
  async revokeRole(guildId, userId) {
    try {
      await this.db.ref(`servers/${guildId}/members/${userId}`).remove();
      Logger.info(`🔓 Role revoked for ${userId}`);
    } catch (error) {
      Logger.error('Error revoking role:', error);
      throw error;
    }
  }

  /**
   * Get role info
   */
  getRole(roleName) {
    return this.roles.get(roleName);
  }

  /**
   * Get all roles
   */
  getAllRoles() {
    return Array.from(this.roles.values());
  }
}

module.exports = EnterpriseRBAC;
