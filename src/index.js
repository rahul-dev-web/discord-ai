/**
 * IGL ESPORTS DISCORD AI BOT
 * Main Entry Point
 * 
 * This is where the bot starts. It initializes Firebase, loads plugins,
 * and connects to Discord.
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Import core systems
const { initializeFirebase, getDatabase } = require('./core/firebase-config');
const EventBus = require('./core/event-bus');
const ContextEngine = require('./engines/context-engine');
const PermissionEngine = require('./engines/permission-engine');
const CapabilityEngine = require('./engines/capability-engine');
const SecurityEngine = require('./engines/security-engine');
const TaskManager = require('./engines/task-manager');
const AIEngine = require('./engines/ai-engine');
const EnhancedAIEngine = require('./engines/enhanced-ai-engine'); // Phase 10+
const SmartDiscoveryEngine = require('./engines/smart-discovery-engine'); // Phase 11
const MemorySystem = require('./engines/memory-system'); // Phase 12
const PluginLoader = require('./core/plugin-loader');
const Logger = require('./utils/logger');
const ConfigManager = require('./core/config-manager');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ],
});

// Global collections for commands and plugins
client.commands = new Collection();
client.plugins = new Collection();
client.engines = {};

/**
 * Initialize all systems
 */
async function initializeBot() {
  try {
    Logger.info('🚀 Starting IGL Discord Bot...');

    // 1. Initialize Firebase
    Logger.info('📡 Connecting to Firebase...');
    initializeFirebase();
    const db = getDatabase();
    Logger.success('Firebase connected!');

    // 2. Initialize Event Bus
    Logger.info('🔌 Initializing Event Bus...');
    const eventBus = new EventBus();
    client.eventBus = eventBus;
    Logger.success('Event Bus ready!');

    // 3. Initialize Config Manager
    Logger.info('⚙️ Loading configuration...');
    const configManager = new ConfigManager(db);
    await configManager.loadConfigs();
    client.configManager = configManager;
    Logger.success('Configuration loaded!');

    // 4. Initialize Engines
    Logger.info('🔨 Initializing Engines...');
    client.engines.context = new ContextEngine(client, db);
    client.engines.permission = new PermissionEngine(client, db);
    client.engines.capability = new CapabilityEngine(client, db);
    client.engines.security = new SecurityEngine(client, db);
    client.engines.taskManager = new TaskManager(client, db);
    client.engines.ai = new AIEngine(client, db);
    
    // Phase 10-12 Engines
    client.engines.enhancedAI = new EnhancedAIEngine(client, db);
    client.engines.discovery = new SmartDiscoveryEngine(client, db);
    client.engines.memory = new MemorySystem(client, db);
    
    Logger.success('All engines initialized!');

    // 5. Load Plugins
    Logger.info('🔌 Loading plugins...');
    const pluginLoader = new PluginLoader(client);
    await pluginLoader.loadAllPlugins();
    Logger.success(`${client.plugins.size} plugins loaded!`);

    // 6. Load slash commands
    Logger.info('⚡ Loading commands...');
    loadSlashCommands(client);
    Logger.success(`${client.commands.size} commands loaded!`);

    // 7. Login to Discord
    Logger.info('🔐 Logging in to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    Logger.success('Logged in to Discord!');

  } catch (error) {
    Logger.error('Failed to initialize bot:', error);
    process.exit(1);
  }
}

/**
 * Load all slash commands
 */
function loadSlashCommands(client) {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
  }

  const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    }
  }
}

/**
 * Bot ready event
 */
client.once('ready', async () => {
  Logger.success(`✅ Bot is online as ${client.user.tag}`);
  Logger.info(`📊 Serving ${client.guilds.cache.size} servers`);
  
  // Update presence
  client.user.setPresence({
    activities: [{
      name: 'IGL Esports 🎮',
      type: 'WATCHING',
    }],
    status: 'online',
  });

  // Initialize context for all servers
  for (const guild of client.guilds.cache.values()) {
    await client.engines.context.scanServer(guild);
    
    // Phase 11: Smart discovery
    await client.engines.discovery.discoverServer(guild.id);
    await client.engines.discovery.autoCreateChannelProfiles(guild.id);
  }

  Logger.success('🎯 All servers initialized!');
});

/**
 * Guild create event - when bot joins a new server
 */
client.on('guildCreate', async (guild) => {
  Logger.info(`📍 Joined new server: ${guild.name}`);
  
  // Scan and initialize the server
  await client.engines.context.scanServer(guild);
  
  // Run first-time setup if needed
  const db = getDatabase();
  const ref = require('firebase/database').ref(db, `servers/${guild.id}/initialized`);
  const snapshot = await require('firebase/database').get(ref);
  
  if (!snapshot.val()) {
    Logger.info(`🚀 Running first-time setup for ${guild.name}`);
    // Setup wizard will be triggered
  }
});

/**
 * Handle slash commands
 */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    Logger.error(`Command error: ${error.message}`);
    await interaction.reply({
      content: '❌ An error occurred while executing this command.',
      ephemeral: true,
    });
  }
});

/**
 * Handle messages
 */
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Let plugins handle messages
  for (const plugin of client.plugins.values()) {
    if (plugin.onMessage) {
      try {
        await plugin.onMessage(message);
      } catch (error) {
        Logger.error(`Plugin error in ${plugin.name}:`, error);
      }
    }
  }
});

/**
 * Handle voice state updates
 */
client.on('voiceStateUpdate', async (oldState, newState) => {
  // Let plugins handle voice events
  for (const plugin of client.plugins.values()) {
    if (plugin.onVoiceStateUpdate) {
      try {
        await plugin.onVoiceStateUpdate(oldState, newState);
      } catch (error) {
        Logger.error(`Plugin error in ${plugin.name}:`, error);
      }
    }
  }
});

/**
 * Error handling
 */
client.on('error', error => {
  Logger.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  Logger.error('Unhandled rejection:', error);
});

// Start the bot
initializeBot();