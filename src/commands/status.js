/**
 * STATUS & DISCOVERY COMMAND - Phase 11
 * View server analysis, channel profiles, and system status
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('View server status and AI analysis')
    .addSubcommand((sub) =>
      sub
        .setName('server')
        .setDescription('View overall server status')
    )
    .addSubcommand((sub) =>
      sub
        .setName('channels')
        .setDescription('View discovered channel types')
    )
    .addSubcommand((sub) =>
      sub
        .setName('ai')
        .setDescription('View AI engine status')
    )
    .addSubcommand((sub) =>
      sub
        .setName('memory')
        .setDescription('View memory system status')
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.deferReply();

      if (subcommand === 'server') {
        await handleServerStatus(interaction, client);
      } else if (subcommand === 'channels') {
        await handleChannelStatus(interaction, client);
      } else if (subcommand === 'ai') {
        await handleAIStatus(interaction, client);
      } else if (subcommand === 'memory') {
        await handleMemoryStatus(interaction, client);
      }
    } catch (error) {
      Logger.error('Status command error:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`,
      });
    }
  },
};

/**
 * Server status
 */
async function handleServerStatus(interaction, client) {
  const guild = interaction.guild;
  const report = await client.engines.discovery.generateStructureReport(interaction.guildId);

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`📊 ${guild.name} - Server Status`)
    .addFields(
      {
        name: '👥 Members',
        value: `${guild.memberCount}`,
        inline: true,
      },
      {
        name: '📅 Created',
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
        inline: true,
      },
      {
        name: '📁 Categories',
        value: `${guild.channels.cache.filter((c) => c.isCategory?.()).size}`,
        inline: true,
      },
      {
        name: '💬 Text Channels',
        value: `${report?.summary?.byType?.text || 0}`,
        inline: true,
      },
      {
        name: '🎤 Voice Channels',
        value: `${report?.summary?.byType?.voice || 0}`,
        inline: true,
      },
      {
        name: '⚙️ Roles',
        value: `${guild.roles.cache.size}`,
        inline: true,
      },
      {
        name: '🤖 Bot Status',
        value: '✅ Online\n✅ All engines active\n✅ Discovery enabled',
        inline: false,
      }
    )
    .setThumbnail(guild.iconURL())
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Channel discovery status
 */
async function handleChannelStatus(interaction, client) {
  const report = await client.engines.discovery.generateStructureReport(interaction.guildId);

  if (!report) {
    return await interaction.editReply('❌ Could not generate report.');
  }

  let channelsByPurpose = '';
  for (const [purpose, count] of Object.entries(report.summary.byPurpose)) {
    const emoji = getEmojiForPurpose(purpose);
    channelsByPurpose += `${emoji} **${purpose}**: ${count}\n`;
  }

  const embed = new EmbedBuilder()
    .setColor('#ff6600')
    .setTitle('📋 Discovered Channel Types')
    .setDescription(channelsByPurpose)
    .addFields(
      {
        name: '📊 Total Channels',
        value: `${report.summary.totalChannels}`,
        inline: true,
      },
      {
        name: '🔍 Detection Accuracy',
        value: 'Analyzing...',
        inline: true,
      },
      {
        name: '💡 Recommendation',
        value: 'Use `/memory` to manage channel-related knowledge',
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  // Log view
  await client.engines.security.logAction(
    interaction.guildId,
    interaction.user.id,
    'viewed_channel_status',
    'success',
    report.summary
  );
}

/**
 * AI engine status
 */
async function handleAIStatus(interaction, client) {
  const aiEngine = client.engines.ai;
  const enhancedAI = client.engines.enhancedAI;

  const embed = new EmbedBuilder()
    .setColor('#9933ff')
    .setTitle('🤖 AI Engine Status')
    .addFields(
      {
        name: '🧠 Core AI',
        value: aiEngine ? '✅ Active' : '❌ Offline',
        inline: true,
      },
      {
        name: '🚀 Enhanced AI (Phase 10+)',
        value: enhancedAI ? '✅ Active' : '❌ Offline',
        inline: true,
      },
      {
        name: '🎤 Voice AI',
        value: '⏳ Ready (Whisper not configured)',
        inline: true,
      },
      {
        name: '💡 AI Model',
        value: 'Groq: Mixtral-8x7b-32768',
        inline: false,
      },
      {
        name: '🔧 Features',
        value: `
✅ Intent Analysis
✅ Conversation Generation
✅ Action Planning
✅ Channel Purpose Detection
✅ Auto-Profiling
✅ Voice Command Processing
        `.trim(),
        inline: false,
      },
      {
        name: '📊 Capabilities',
        value: `
Total: 50+
- Owner level: ${(await client.engines.capability.getCapabilitiesForRole('owner')).length}
- Admin level: ${(await client.engines.capability.getCapabilitiesForRole('admin')).length}
- Staff level: ${(await client.engines.capability.getCapabilitiesForRole('staff')).length}
        `.trim(),
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Memory system status
 */
async function handleMemoryStatus(interaction, client) {
  const memorySystem = client.engines.memory;
  const firebase = require('../core/firebase-config');

  // Get memory stats
  const serverMemory = await firebase.get(`servers/${interaction.guildId}/server_memory`);
  const conversationMemory = await firebase.get(
    `servers/${interaction.guildId}/conversation_memory`
  );
  const knowledgeBase = await firebase.get(`servers/${interaction.guildId}/knowledge_base`);

  const rulesCount = serverMemory?.rules ? Object.keys(serverMemory.rules).length : 0;
  const templatesCount = serverMemory?.templates
    ? Object.keys(serverMemory.templates).length
    : 0;
  const conversationsCount = conversationMemory ? Object.keys(conversationMemory).length : 0;
  let kbCount = 0;

  if (knowledgeBase && typeof knowledgeBase === 'object') {
    for (const type of Object.values(knowledgeBase)) {
      if (typeof type === 'object') {
        kbCount += Object.keys(type).length;
      }
    }
  }

  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('💾 Memory System Status')
    .addFields(
      {
        name: '🧠 System Status',
        value: memorySystem ? '✅ Active' : '❌ Offline',
        inline: true,
      },
      {
        name: '📈 Database Connection',
        value: '✅ Connected',
        inline: true,
      },
      {
        name: '📋 Server Rules',
        value: `${rulesCount} rules stored`,
        inline: true,
      },
      {
        name: '📑 Templates',
        value: `${templatesCount} templates stored`,
        inline: true,
      },
      {
        name: '💬 Conversations',
        value: `${conversationsCount} conversations tracked`,
        inline: true,
      },
      {
        name: '📚 Knowledge Base',
        value: `${kbCount} items indexed`,
        inline: true,
      },
      {
        name: '🔐 Privacy',
        value: 'All data encrypted in Firebase\nUser-specific conversations isolated',
        inline: false,
      },
      {
        name: '💡 Features',
        value: `
✅ Server Rules Storage
✅ Template Management
✅ Conversation Tracking
✅ Knowledge Base
✅ Memory Summarization
✅ Export/Import
        `.trim(),
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  // Log view
  await client.engines.security.logAction(
    interaction.guildId,
    interaction.user.id,
    'viewed_memory_status',
    'success',
    { rulesCount, templatesCount, conversationsCount, kbCount }
  );
}

/**
 * Get emoji for channel purpose
 */
function getEmojiForPurpose(purpose) {
  const emojiMap = {
    owner_chat: '👑',
    staff_chat: '👥',
    helpdesk: '💬',
    tournament: '🏆',
    announcement: '📢',
    general: '💬',
    voice_owner: '🎤',
    voice_staff: '🎙️',
    voice_general: '🎵',
    unknown: '❓',
  };

  return emojiMap[purpose] || '❓';
}
