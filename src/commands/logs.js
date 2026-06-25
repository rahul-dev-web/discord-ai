/**
 * LOGS COMMAND - Phase 15
 * Search, view, and manage logs
 * 
 * Usage:
 * /logs search [filters]
 * /logs view [log_id]
 * /logs stats
 * /logs export
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Search and manage system logs (admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search logs')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Log type')
            .addChoices(
              { name: 'Command', value: 'command_executed' },
              { name: 'Message', value: 'message_processed' },
              { name: 'Ticket', value: 'ticket_created' },
              { name: 'Error', value: 'error_occurred' },
              { name: 'Security', value: 'security_event' },
              { name: 'All', value: 'all' }
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('level')
            .setDescription('Log level')
            .addChoices(
              { name: 'Critical', value: 'CRITICAL' },
              { name: 'Error', value: 'ERROR' },
              { name: 'Warning', value: 'WARNING' },
              { name: 'Info', value: 'INFO' }
            )
            .setRequired(false)
        )
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('Filter by user')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of results (max 50)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View specific log')
        .addStringOption(option =>
          option
            .setName('log_id')
            .setDescription('Log ID to view')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View log statistics')
        .addIntegerOption(option =>
          option
            .setName('days')
            .setDescription('Time period (days)')
            .setMinValue(1)
            .setMaxValue(365)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('export')
        .setDescription('Export logs as CSV')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Log type')
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    // Admin check
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({
        content: '❌ You need Administrator permission to view logs',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const loggingEngine = client.engines?.logging;

      if (!loggingEngine) {
        return await interaction.editReply({
          content: '❌ Logging engine not initialized',
        });
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'search':
          return await handleSearch(interaction, loggingEngine);
        case 'view':
          return await handleView(interaction, loggingEngine);
        case 'stats':
          return await handleStats(interaction, loggingEngine);
        case 'export':
          return await handleExport(interaction, loggingEngine);
        default:
          return await interaction.editReply('❓ Unknown subcommand');
      }
    } catch (error) {
      Logger.error('Logs command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while processing logs',
      });
    }
  },
};

/**
 * Search logs
 */
async function handleSearch(interaction, loggingEngine) {
  try {
    const type = interaction.options.getString('type');
    const level = interaction.options.getString('level');
    const user = interaction.options.getUser('user');
    const limit = interaction.options.getInteger('limit') || 25;

    // Build filters
    const filters = { limit };
    if (type && type !== 'all') filters.type = type;
    if (level) filters.level = level;
    if (user) filters.userId = user.id;

    // Search logs
    const logs = await loggingEngine.searchLogs(interaction.guildId, filters);

    if (logs.length === 0) {
      return await interaction.editReply({
        content: '📭 No logs found matching criteria',
      });
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📋 System Logs')
      .setDescription(`Found **${logs.length}** log entries`)
      .setThumbnail(interaction.client.user.displayAvatarURL());

    // Add log entries
    for (const log of logs.slice(0, 10)) {
      const emoji = getLevelEmoji(log.level);
      const time = new Date(log.timestamp).toLocaleTimeString();

      embed.addFields({
        name: `${emoji} ${log.type}`,
        value: `**Action:** ${log.action}\n` +
               `**Result:** ${log.result}\n` +
               `**Time:** ${time}\n` +
               `**ID:** \`${log.id}\``,
        inline: false,
      });
    }

    embed.setFooter({
      text: logs.length > 10 ? `Showing 10 of ${logs.length}` : `Total: ${logs.length}`,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('Search logs error:', error);
    await interaction.editReply({
      content: '❌ Error searching logs',
    });
  }
}

/**
 * View specific log
 */
async function handleView(interaction, loggingEngine) {
  try {
    const logId = interaction.options.getString('log_id');

    const logs = await loggingEngine.searchLogs(interaction.guildId, {
      limit: 1000,
    });

    const log = logs.find(l => l.id === logId);

    if (!log) {
      return await interaction.editReply({
        content: `❌ Log not found: ${logId}`,
      });
    }

    // Create detailed embed
    const embed = new EmbedBuilder()
      .setColor(getLevelColor(log.level))
      .setTitle(`📖 Log Details`)
      .setDescription(`ID: \`${log.id}\``)
      .addFields(
        {
          name: '📊 Type & Level',
          value: `${log.type} / ${log.level}`,
          inline: true,
        },
        {
          name: '⏱️ Timestamp',
          value: new Date(log.timestamp).toLocaleString(),
          inline: true,
        },
        {
          name: '🎯 Action',
          value: log.action,
          inline: true,
        },
        {
          name: '📝 Description',
          value: log.description || 'N/A',
          inline: false,
        },
        {
          name: '✅ Result',
          value: log.result,
          inline: true,
        },
        {
          name: '⏳ Duration',
          value: `${log.duration}ms`,
          inline: true,
        },
        {
          name: '👤 User',
          value: log.userId ? `<@${log.userId}>` : 'N/A',
          inline: true,
        },
        {
          name: '👨‍💼 Staff',
          value: log.staffId ? `<@${log.staffId}>` : 'N/A',
          inline: true,
        }
      );

    if (log.error) {
      embed.addFields({
        name: '❌ Error',
        value: `\`\`\`${log.error}\`\`\``,
        inline: false,
      });
    }

    if (log.resultDetails && Object.keys(log.resultDetails).length > 0) {
      const details = Object.entries(log.resultDetails)
        .map(([key, val]) => `${key}: ${val}`)
        .join('\n');

      embed.addFields({
        name: '📦 Result Details',
        value: `\`\`\`${details}\`\`\``,
        inline: false,
      });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('View log error:', error);
    await interaction.editReply({
      content: '❌ Error viewing log',
    });
  }
}

/**
 * View log statistics
 */
async function handleStats(interaction, loggingEngine) {
  try {
    const days = interaction.options.getInteger('days') || 7;

    const stats = await loggingEngine.getLogStats(interaction.guildId, days);

    if (!stats) {
      return await interaction.editReply({
        content: '❌ Error getting statistics',
      });
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('📊 Log Statistics')
      .setDescription(`Last ${days} days`)
      .addFields(
        {
          name: '📈 Overview',
          value: `Total Logs: **${stats.totalLogs}**\n` +
                 `Errors: **${stats.errorCount}**\n` +
                 `Warnings: **${stats.warningCount}**`,
          inline: true,
        },
        {
          name: '⏱️ Performance',
          value: `Avg Duration: **${Math.round(stats.avgDuration)}ms**`,
          inline: true,
        }
      );

    // Add by type
    if (Object.keys(stats.byType).length > 0) {
      const typeStr = Object.entries(stats.byType)
        .map(([type, count]) => `• ${type}: ${count}`)
        .join('\n');

      embed.addFields({
        name: '📋 By Type',
        value: typeStr,
        inline: false,
      });
    }

    // Add by level
    if (Object.keys(stats.byLevel).length > 0) {
      const levelStr = Object.entries(stats.byLevel)
        .map(([level, count]) => `• ${level}: ${count}`)
        .join('\n');

      embed.addFields({
        name: '📊 By Level',
        value: levelStr,
        inline: false,
      });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('Stats error:', error);
    await interaction.editReply({
      content: '❌ Error getting statistics',
    });
  }
}

/**
 * Export logs as CSV
 */
async function handleExport(interaction, loggingEngine) {
  try {
    const type = interaction.options.getString('type');

    const filters = { limit: 1000 };
    if (type) filters.type = type;

    const csv = await loggingEngine.exportLogsAsCSV(
      interaction.guildId,
      filters
    );

    if (!csv || csv.length === 0) {
      return await interaction.editReply({
        content: '📭 No logs to export',
      });
    }

    // Create file
    const filename = `logs-${new Date().toISOString().split('T')[0]}.csv`;

    // Send as attachment
    await interaction.editReply({
      content: `✅ Exported ${csv.split('\n').length - 1} logs`,
      files: [
        {
          attachment: Buffer.from(csv),
          name: filename,
        },
      ],
    });

    Logger.info(`📤 Logs exported: ${filename}`);
  } catch (error) {
    Logger.error('Export error:', error);
    await interaction.editReply({
      content: '❌ Error exporting logs',
    });
  }
}

/**
 * Helper: Get emoji for level
 */
function getLevelEmoji(level) {
  const emojis = {
    CRITICAL: '🔴',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    DEBUG: '🐛',
    TRACE: '📍',
  };
  return emojis[level] || '⚪';
}

/**
 * Helper: Get color for level
 */
function getLevelColor(level) {
  const colors = {
    CRITICAL: '#ff0000',
    ERROR: '#ff6600',
    WARNING: '#ffff00',
    INFO: '#0099ff',
    DEBUG: '#00ff00',
    TRACE: '#808080',
  };
  return colors[level] || '#0099ff';
}
