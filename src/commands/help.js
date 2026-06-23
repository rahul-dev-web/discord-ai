/**
 * HELP COMMAND - Phase 13 Update
 * Now uses CommandDiscoveryEngine for dynamic documentation!
 * Shows available commands based on user's actual capabilities
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows available commands and features (dynamic)')
    .addStringOption(option =>
      option
        .setName('capability')
        .setDescription('Filter by capability')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const discoveryEngine = client.engines.discovery;

      // Phase 13: Use discovery engine to get dynamic capabilities
      if (!discoveryEngine) {
        return showStaticHelp(interaction);
      }

      const guildId = interaction.guildId;
      const userId = interaction.user.id;
      const capabilityFilter = interaction.options.getString('capability');

      // Get user's actual capabilities
      const userCapabilities = await discoveryEngine.getUserCapabilities(guildId, userId);

      if (!userCapabilities) {
        return showStaticHelp(interaction);
      }

      // Create dynamic embed based on actual capabilities
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📚 Dynamic Command Help')
        .setDescription(
          `Commands available for **${userCapabilities.role}** role\n` +
          `You have **${userCapabilities.capabilities.length}** capabilities`
        )
        .setThumbnail(interaction.user.displayAvatarURL());

      // Get tools for user
      const allTools = await discoveryEngine.getAvailableTools(guildId);

      if (!allTools || Object.keys(allTools).length === 0) {
        embed.addFields({
          name: '📭 No tools registered',
          value: 'No commands are available in this server yet',
          inline: false,
        });
      } else {
        // Group tools by capability
        const toolsByCapability = {};

        for (const [toolId, toolData] of Object.entries(allTools)) {
          const capability = toolData.capability || 'other';
          
          // Filter by user's capabilities
          if (!userCapabilities.capabilities.includes(capability)) {
            continue;
          }

          // Apply capability filter if specified
          if (capabilityFilter && capability !== capabilityFilter) {
            continue;
          }

          if (!toolsByCapability[capability]) {
            toolsByCapability[capability] = [];
          }

          toolsByCapability[capability].push({
            command: toolData.command || toolId,
            name: toolData.name || toolId,
            description: toolData.description || 'No description',
          });
        }

        if (Object.keys(toolsByCapability).length === 0) {
          embed.addFields({
            name: '🔒 No accessible tools',
            value: 'You don\'t have permission to use any tools yet',
            inline: false,
          });
        } else {
          // Add tools grouped by capability
          for (const [capability, tools] of Object.entries(toolsByCapability)) {
            const emoji = getCapabilityEmoji(capability);
            const toolList = tools
              .map(t => `\`/${t.command}\` - ${t.description}`)
              .join('\n');

            embed.addFields({
              name: `${emoji} ${capability}`,
              value: toolList || 'No tools',
              inline: false,
            });
          }
        }
      }

      embed.addFields({
        name: '💡 Tip',
        value: 'Use `/discover capabilities` for detailed information about your capabilities!\nUse `/discover tools` to see all available tools in the server.',
        inline: false,
      });

      embed.setFooter({
        text: 'Phase 13: Dynamic Command Discovery | Commands update automatically when plugins are installed',
      });
      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error('Help command error:', error);
      return showStaticHelp(interaction);
    }
  },
};

/**
 * Fallback to static help if discovery engine fails
 */
async function showStaticHelp(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('📚 Help - Static Mode')
    .setDescription('Discovery engine is initializing...')
    .addFields(
      { name: '/discover', value: 'Show available commands (dynamic)', inline: true },
      { name: '/status', value: 'Bot status information', inline: true },
      { name: '/setup', value: 'Server setup wizard', inline: true }
    )
    .setFooter({ text: 'Try /discover capabilities for more info' });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Get emoji for capability
 */
function getCapabilityEmoji(capability) {
  const emojis = {
    manage_bot: '🤖',
    manage_plugins: '🔌',
    restart_bot: '🔄',
    manage_roles: '👥',
    manage_channels: '📢',
    view_logs: '📋',
    change_settings: '⚙️',
    create_tournament: '🏆',
    manage_tournament: '🎮',
    manage_members: '👨‍💼',
    manage_messages: '✏️',
    create_ticket: '🎫',
    manage_ticket: '🎟️',
    view_analytics: '📊',
    send_messages: '💬',
    manage_voice: '🎤',
    view_members: '👀',
    view_server_stats: '📈',
  };

  return emojis[capability] || '⚡';
}