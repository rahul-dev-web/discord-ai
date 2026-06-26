/**
 * IGL ESPORTS DISCORD AI BOT
 * Main Entry Point
 * 
 * This is where the bot starts. It initializes Firebase, loads plugins,
 * and connects to Discord.
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const fs = require('fs');
const http = require('http');
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
const WorkflowEngine = require('./engines/workflow-engine'); // Phase 12
const MemorySystem = require('./engines/memory-system'); // Phase 12
const CommandDiscoveryEngine = require('./engines/command-discovery-engine'); // Phase 13
const SupportAIEngine = require('./engines/support-ai-engine'); // Phase 14
const PluginLoader = require('./core/plugin-loader');
const Logger = require('./utils/logger');
const ConfigManager = require('./core/config-manager');
const { registerSlashCommands } = require('./utils/command-registrar');

const PORT = Number(process.env.PORT) || 3000;

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
client.startedAt = new Date();

const PREFIX_OPTION_MAP = {
  help: {
    strings: { category: 0 },
  },
  status: {
    subcommand: 0,
    defaultSubcommand: 'server',
  },
  stats: {
    subcommand: 0,
    defaultSubcommand: 'daily',
    users: { user: 1 },
  },
  tournament: {
    subcommand: 0,
    defaultSubcommand: 'list',
    strings: {
      name: 1,
      type: 2,
      tournament_id: 1,
      status: 1,
    },
    integers: { max_teams: 3 },
  },
  memory: {
    subcommand: 0,
    defaultSubcommand: 'rules',
    strings: {
      query: 1,
      rule: 1,
      type: 1,
    },
  },
};

/**
 * Render Web Services must bind to a public HTTP port.
 */
function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
      const payload = {
        status: 'ok',
        discord: client.isReady() ? 'online' : 'starting',
        uptimeSeconds: Math.round(process.uptime()),
        startedAt: client.startedAt.toISOString(),
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    Logger.success(`Health server listening on port ${PORT}`);
  });

  server.on('error', (error) => {
    Logger.error('Health server failed:', error);
    process.exit(1);
  });
}

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
    
    // Phase 10-13 Engines
    client.engines.enhancedAI = new EnhancedAIEngine(client, db);
    client.engines.smartDiscovery = new SmartDiscoveryEngine(client, db);
    client.engines.memory = new MemorySystem(client, db);
    // Phase 17: Workflow Engine
    client.engines.workflowEngine = new WorkflowEngine(client);
    Logger.info('✅ WorkflowEngine initialized');
    client.engines.commandDiscovery = new CommandDiscoveryEngine(client, db);
    client.engines.supportAI = new SupportAIEngine(client, db);
    Logger.success('✨ All engines initialized! (Phase 13 included)');

    // 5. Load Plugins
    Logger.info('🔌 Loading plugins...');
    const pluginLoader = new PluginLoader(client);
    await pluginLoader.loadAllPlugins();
    Logger.success(`${client.plugins.size} plugins loaded!`);

    // 6. Load slash commands
    Logger.info('⚡ Loading commands...');
    loadSlashCommands(client);
    Logger.success(`${client.commands.size} commands loaded!`);

    // 7. Register slash commands with Discord
    await deploySlashCommandsOnStartup();

    // 8. Login to Discord
    Logger.info('🔐 Logging in to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    Logger.success('Logged in to Discord!');

  } catch (error) {
    Logger.error('Failed to initialize bot:', error);
    process.exit(1);
  }
}

/**
 * Register commands automatically on Render/startup.
 */
async function deploySlashCommandsOnStartup() {
  if (process.env.AUTO_DEPLOY_COMMANDS === 'false') {
    Logger.info('Skipping slash command auto-deploy');
    return;
  }

  try {
    const result = await registerSlashCommands(client.commands, Logger);
    Logger.success(`Slash commands ready: ${result.count} (${result.scope})`);
  } catch (error) {
    Logger.error(`Slash command auto-deploy failed: ${error.message}`);
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
      type: ActivityType.Watching,
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

  const handledPrefixCommand = await handlePrefixCommand(message);
  if (handledPrefixCommand) return;

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
 * Handle prefix commands such as !help and !stats daily
 */
async function handlePrefixCommand(message) {
  const prefix = await getPrefixForMessage(message);

  if (!message.content.startsWith(prefix)) {
    return false;
  }

  const args = parsePrefixArgs(message.content.slice(prefix.length));
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) {
    return false;
  }

  const command = client.commands.get(commandName);
  if (!command) {
    return false;
  }

  try {
    const interaction = createMessageInteraction(message, commandName, args);
    await command.execute(interaction, client);
  } catch (error) {
    Logger.error(`Prefix command error: ${error.message}`);
    await message.reply('❌ An error occurred while executing this command.');
  }

  return true;
}

/**
 * Get configured prefix for the guild
 */
async function getPrefixForMessage(message) {
  if (!message.guildId || !client.configManager) {
    return process.env.BOT_PREFIX || '!';
  }

  const config = await client.configManager.getServerConfig(message.guildId);
  return config?.prefix || process.env.BOT_PREFIX || '!';
}

/**
 * Split prefix arguments, keeping quoted text together
 */
function parsePrefixArgs(input) {
  const args = [];
  const regex = /"([^"]+)"|'([^']+)'|`([^`]+)`|(\S+)/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    args.push(match[1] || match[2] || match[3] || match[4]);
  }

  return args;
}

/**
 * Build a small interaction-compatible wrapper for message commands
 */
function createMessageInteraction(message, commandName, args) {
  const optionMap = PREFIX_OPTION_MAP[commandName] || {};
  let replyMessage = null;

  const getArg = (index) => (typeof index === 'number' ? args[index] : null);

  return {
    commandName,
    guild: message.guild,
    guildId: message.guildId,
    channel: message.channel,
    user: message.author,
    member: message.member,
    createdTimestamp: message.createdTimestamp,
    replied: false,
    deferred: false,
    options: {
      getSubcommand() {
        return getArg(optionMap.subcommand) || optionMap.defaultSubcommand || null;
      },
      getString(name) {
        return getArg(optionMap.strings?.[name]) || null;
      },
      getInteger(name) {
        const value = getArg(optionMap.integers?.[name]);
        return value ? Number.parseInt(value, 10) : null;
      },
      getUser(name) {
        const value = getArg(optionMap.users?.[name]);
        if (!value) return null;

        const userId = value.replace(/[<@!>]/g, '');
        return message.client.users.cache.get(userId) || null;
      },
    },
    async deferReply() {
      this.deferred = true;
      await message.channel.sendTyping();
    },
    async reply(payload) {
      this.replied = true;
      replyMessage = await message.reply(normalizeReplyPayload(payload));
      return replyMessage;
    },
    async editReply(payload) {
      const normalized = normalizeReplyPayload(payload);

      if (replyMessage) {
        return await replyMessage.edit(normalized);
      }

      this.replied = true;
      replyMessage = await message.reply(normalized);
      return replyMessage;
    },
  };
}

/**
 * Message replies do not support ephemeral responses
 */
function normalizeReplyPayload(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  const { ephemeral, ...messagePayload } = payload;
  return messagePayload;
}

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
startHealthServer();
initializeBot();
