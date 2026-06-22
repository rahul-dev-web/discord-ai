/**
 * PLUGIN LOADER
 * Dynamically loads plugins from the plugins folder
 */

const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');

class PluginLoader {
  constructor(client) {
    this.client = client;
    this.pluginsDir = path.join(__dirname, '../plugins');
  }

  /**
   * Load all plugins
   */
  async loadAllPlugins() {
    try {
      // Create plugins directory if it doesn't exist
      if (!fs.existsSync(this.pluginsDir)) {
        fs.mkdirSync(this.pluginsDir, { recursive: true });
        Logger.warn('Plugins directory created. Add plugin files.');
        return;
      }

      const pluginFiles = fs.readdirSync(this.pluginsDir)
        .filter(file => file.endsWith('-plugin.js'));

      Logger.info(`Found ${pluginFiles.length} plugins`);

      for (const file of pluginFiles) {
        try {
          await this.loadPlugin(file);
        } catch (error) {
          Logger.error(`Failed to load plugin ${file}:`, error);
        }
      }

      Logger.success(`✅ Loaded ${this.client.plugins.size} plugins`);
    } catch (error) {
      Logger.error('Failed to load plugins:', error);
    }
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(filename) {
    const filePath = path.join(this.pluginsDir, filename);
    
    // Clear require cache to reload plugin
    delete require.cache[require.resolve(filePath)];
    
    const PluginClass = require(filePath);
    const plugin = new PluginClass(this.client);

    if (!plugin.name) {
      throw new Error(`Plugin in ${filename} must have a 'name' property`);
    }

    // Register plugin
    this.client.plugins.set(plugin.name, plugin);
    Logger.info(`📦 Loaded plugin: ${plugin.name}`);

    // Initialize plugin if it has an init method
    if (plugin.init) {
      await plugin.init();
    }

    return plugin;
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginName) {
    const plugin = this.client.plugins.get(pluginName);
    if (!plugin) {
      Logger.warn(`Plugin ${pluginName} not found`);
      return false;
    }

    // Cleanup if plugin has a cleanup method
    if (plugin.cleanup) {
      await plugin.cleanup();
    }

    this.client.plugins.delete(pluginName);
    Logger.info(`Unloaded plugin: ${pluginName}`);
    return true;
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginName) {
    await this.unloadPlugin(pluginName);
    
    const filename = `${pluginName}-plugin.js`;
    const filePath = path.join(this.pluginsDir, filename);

    if (fs.existsSync(filePath)) {
      await this.loadPlugin(filename);
      return true;
    }

    Logger.error(`Plugin file not found: ${filename}`);
    return false;
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins() {
    return Array.from(this.client.plugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version || '1.0.0',
      description: plugin.description || 'No description',
    }));
  }
}

module.exports = PluginLoader;
