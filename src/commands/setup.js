/**
 * SETUP COMMAND
 * First-time setup wizard for servers
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const Logger = require('../utils/logger');

function findExistingSupportChannel(guild) {
  return guild.channels.cache.find((channel) => {
    if (channel.type !== ChannelType.GuildText) return false;

    const name = channel.name.toLowerCase();
    return name.includes('helpdesk') || name.includes('support') || name.includes('ticket');
  });
}

async function findOrCreateLogChannel(guild) {
  const existing = guild.channels.cache.find((channel) => {
    if (channel.type !== ChannelType.GuildText) return false;

    const name = channel.name.toLowerCase();
    return name.includes('bot-log') || name.includes('audit-log') || name === 'logs';
  });

  if (existing) return existing;

  return guild.channels.create({
    name: 'bot-logs',
    type: ChannelType.GuildText,
    reason: 'IGL bot setup log channel',
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('First-time setup wizard for this server'),

  async execute(interaction, client) {
    // Check if user is server owner
    if (interaction.guild.ownerId !== interaction.user.id) {
      return await interaction.reply({
        content: '❌ Only the server owner can run setup!',
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      Logger.info(`Starting setup for server: ${interaction.guild.name}`);

      // Step 1: Check if already initialized
      const config = await client.configManager.getServerConfig(interaction.guildId);
      if (config?.initialized) {
        return await interaction.editReply({
          content: '⚠️ This server is already initialized!',
        });
      }

      // Step 2: Initialize server
      await client.configManager.initializeServer(interaction.guildId, {
        ownerId: interaction.user.id,
      });

      // Step 3: Scan server
      const context = await client.engines.context.scanServer(interaction.guild);

      // Step 4: Initialize capabilities
      await client.engines.capability.initializeServerCapabilities(interaction.guildId);

      // Step 5: Detect existing support channel and create only bot logs
      const logChannel = await findOrCreateLogChannel(interaction.guild);
      const supportChannel = findExistingSupportChannel(interaction.guild);

      // Step 6: Update config with channels
      await client.configManager.updateServerConfig(interaction.guildId, {
        channels: {
          logs: logChannel.id,
          support: supportChannel?.id || null,
        },
      });

      // Step 7: Create setup success embed
      const setupEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Setup Complete!')
        .setDescription('Your server is now configured for IGL Bot')
        .addFields(
          {
            name: '📋 Initialized',
            value: '✓ Server configuration created',
            inline: true,
          },
          {
            name: '📊 Context Scanned',
            value: `✓ ${context.channels.length} channels found`,
            inline: true,
          },
          {
            name: '🔐 Capabilities',
            value: '✓ Role-based capabilities enabled',
            inline: true,
          },
          {
            name: '📝 Log Channel',
            value: `${logChannel}`,
            inline: false,
          },
          {
            name: 'Support Channel',
            value: supportChannel
              ? `${supportChannel} detected`
              : 'Not detected. Create a helpdesk/support/ticket channel, then run `/setup-advanced`.',
            inline: false,
          },
          {
            name: 'Next Steps',
            value:
              '1. Set up roles for your team\n2. Create tournament categories\n3. Configure FAQs\n4. Use `/help` to see all commands',
            inline: false,
          }
        )
        .setTimestamp();

      // Create action buttons
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup_done')
          .setLabel('Done')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('setup_help')
          .setLabel('Need Help?')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [setupEmbed],
        components: [buttons],
      });

      Logger.success(`Setup completed for server: ${interaction.guild.name}`);
    } catch (error) {
      Logger.error('Setup failed:', error);
      await interaction.editReply({
        content: `❌ Setup failed: ${error.message}`,
      });
    }
  },
};
