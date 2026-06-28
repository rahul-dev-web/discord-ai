/**
 * PHASE 19 - PLUGIN MARKETPLACE
 * Discover, Install & Manage Plugins
 * 
 * Features:
 * - Plugin registry & discovery
 * - One-click installation
 * - Version management
 * - Ratings & reviews
 * - Auto-updates
 */

const Logger = require('../utils/logger');

class PluginMarketplace {
  constructor(firebaseDb) {
    this.db = firebaseDb;
    this.plugins = new Map();
    this.reviews = new Map();
    this.installations = new Map();
  }

  /**
   * Publish plugin to marketplace
   */
  async publishPlugin(pluginData) {
    try {
      const plugin = {
        id: `plugin_${Date.now()}`,
        name: pluginData.name,
        description: pluginData.description,
        version: '1.0.0',
        author: pluginData.author,
        authorId: pluginData.authorId,
        category: pluginData.category || 'general',
        downloads: 0,
        rating: 5,
        reviews: [],
        code: pluginData.code || '',
        documentation: pluginData.documentation || '',
        requirements: pluginData.requirements || [],
        price: pluginData.price || 0,
        status: 'pending_review', // pending_review, approved, rejected
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: pluginData.tags || [],
      };

      this.plugins.set(plugin.id, plugin);
      await this.db.ref(`marketplace/plugins/${plugin.id}`).set(plugin);

      Logger.info(`📦 Plugin submitted: ${plugin.name}`);
      return plugin;
    } catch (error) {
      Logger.error('Error publishing plugin:', error);
      throw error;
    }
  }

  /**
   * Search plugins
   */
  async searchPlugins(query, filters = {}) {
    try {
      let results = Array.from(this.plugins.values())
        .filter(p => p.status === 'approved')
        .filter(p =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase()) ||
          p.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
        );

      // Apply filters
      if (filters.category) {
        results = results.filter(p => p.category === filters.category);
      }

      if (filters.minRating) {
        results = results.filter(p => p.rating >= filters.minRating);
      }

      if (filters.maxPrice !== undefined) {
        results = results.filter(p => p.price <= filters.maxPrice);
      }

      if (filters.sortBy === 'downloads') {
        results.sort((a, b) => b.downloads - a.downloads);
      } else if (filters.sortBy === 'rating') {
        results.sort((a, b) => b.rating - a.rating);
      } else {
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      return results;
    } catch (error) {
      Logger.error('Error searching plugins:', error);
      throw error;
    }
  }

  /**
   * Install plugin to server
   */
  async installPlugin(guildId, pluginId) {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin || plugin.status !== 'approved') {
        throw new Error('Plugin not available');
      }

      const installation = {
        id: `install_${Date.now()}`,
        guildId,
        pluginId,
        pluginName: plugin.name,
        version: plugin.version,
        installedAt: new Date().toISOString(),
        status: 'active',
        enabled: true,
      };

      this.installations.set(`${guildId}_${pluginId}`, installation);
      plugin.downloads += 1;

      await this.db.ref(`servers/${guildId}/plugins/${pluginId}`).set(installation);
      await this.db.ref(`marketplace/plugins/${pluginId}`).update({ downloads: plugin.downloads });

      Logger.success(`✅ Plugin installed: ${plugin.name} (${guildId})`);
      return installation;
    } catch (error) {
      Logger.error('Error installing plugin:', error);
      throw error;
    }
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(guildId, pluginId) {
    try {
      this.installations.delete(`${guildId}_${pluginId}`);
      await this.db.ref(`servers/${guildId}/plugins/${pluginId}`).remove();

      Logger.info(`⛔ Plugin uninstalled from ${guildId}`);
    } catch (error) {
      Logger.error('Error uninstalling plugin:', error);
      throw error;
    }
  }

  /**
   * Update plugin version
   */
  async updatePlugin(pluginId, version, changelog) {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        throw new Error('Plugin not found');
      }

      plugin.version = version;
      plugin.changelog = changelog;
      plugin.updatedAt = new Date().toISOString();

      this.plugins.set(pluginId, plugin);
      await this.db.ref(`marketplace/plugins/${pluginId}`).update(plugin);

      Logger.success(`🔄 Plugin updated: ${plugin.name} (v${version})`);
      return plugin;
    } catch (error) {
      Logger.error('Error updating plugin:', error);
      throw error;
    }
  }

  /**
   * Add review/rating
   */
  async addReview(pluginId, review) {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        throw new Error('Plugin not found');
      }

      const reviewObj = {
        id: `review_${Date.now()}`,
        pluginId,
        userId: review.userId,
        rating: review.rating, // 1-5
        title: review.title,
        comment: review.comment,
        createdAt: new Date().toISOString(),
        helpful: 0,
      };

      plugin.reviews.push(reviewObj);
      this.reviews.set(reviewObj.id, reviewObj);

      // Recalculate average rating
      if (plugin.reviews.length > 0) {
        const avgRating = plugin.reviews.reduce((sum, r) => sum + r.rating, 0) / plugin.reviews.length;
        plugin.rating = Math.round(avgRating * 10) / 10;
      }

      this.plugins.set(pluginId, plugin);
      await this.db.ref(`marketplace/plugins/${pluginId}`).update(plugin);

      Logger.info(`⭐ Review added for ${plugin.name}`);
      return reviewObj;
    } catch (error) {
      Logger.error('Error adding review:', error);
      throw error;
    }
  }

  /**
   * Get plugin details
   */
  async getPlugin(pluginId) {
    try {
      return this.plugins.get(pluginId);
    } catch (error) {
      Logger.error('Error fetching plugin:', error);
      throw error;
    }
  }

  /**
   * Get server plugins
   */
  async getServerPlugins(guildId) {
    try {
      const plugins = Array.from(this.installations.values())
        .filter(i => i.guildId === guildId && i.enabled);
      return plugins;
    } catch (error) {
      Logger.error('Error fetching server plugins:', error);
      throw error;
    }
  }

  /**
   * Get trending plugins
   */
  async getTrendingPlugins(limit = 10) {
    try {
      const trending = Array.from(this.plugins.values())
        .filter(p => p.status === 'approved')
        .sort((a, b) => b.downloads - a.downloads)
        .slice(0, limit);
      return trending;
    } catch (error) {
      Logger.error('Error fetching trending plugins:', error);
      throw error;
    }
  }

  /**
   * Get featured plugins
   */
  async getFeaturedPlugins(limit = 5) {
    try {
      const featured = Array.from(this.plugins.values())
        .filter(p => p.status === 'approved')
        .sort((a, b) => b.rating - a.rating)
        .slice(0, limit);
      return featured;
    } catch (error) {
      Logger.error('Error fetching featured plugins:', error);
      throw error;
    }
  }

  /**
   * Get plugin categories
   */
  getCategories() {
    return [
      'general',
      'moderation',
      'analytics',
      'entertainment',
      'utility',
      'voice',
      'database',
      'ai',
      'integration',
      'other',
    ];
  }
}

module.exports = PluginMarketplace;
