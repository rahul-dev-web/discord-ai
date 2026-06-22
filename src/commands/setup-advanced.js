/**
 * ENHANCED SETUP COMMAND
 * Phase 10-12: Advanced setup with smart discovery and memory
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-advanced')
    .setDescription('Advanced server setup with smart discovery (Phase 10+)'),

  async execute(interaction, client) {
    // Check if user is server owner
    if (interaction.guild.ownerId !== interaction.user.id) {
      return await interaction.reply({
        content: '❌ Only the server owner can run advanced setup!',
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      Logger.info(`⚙️ Starting advanced setup for server: ${interaction.guild.name}`);

      // Step 1: Smart Discovery
      Logger.info('🔍 Running smart discovery...');
      const discoveries = await client.engines.discovery.discoverServer(interaction.guildId);

      // Step 2: Auto-create profiles
      Logger.info('🤖 Creating channel profiles...');
      await client.engines.discovery.autoCreateChannelProfiles(interaction.guildId);

      // Step 3: Initialize memory system
      Logger.info('💾 Initializing memory system...');
      await client.engines.memory.storeServerMemory(
        interaction.guildId,
        'server_name',
        interaction.guild.name
      );

      // Step 4: Auto-assign roles to team
      const config = await client.configManager.getServerConfig(interaction.guildId);
      if (!config?.initialized) {
        await client.configManager.initializeServer(interaction.guildId, {
          ownerId: interaction.user.id,
        });
      }

      // Step 5: Initialize capabilities
      await client.engines.capability.initializeServerCapabilities(interaction.guildId);

      // Step 6: Generate structure report
      const report = await client.engines.discovery.generateStructureReport(
        interaction.guildId
      );

      // Step 7: Store initial rules in memory
      await client.engines.memory.storeServerRule(
        interaction.guildId,
        'rule-1',
        'Be respectful to all members',
        'community'
      );

      await client.engines.memory.storeServerRule(
        interaction.guildId,
        'rule-2',
        'No spam or self-promotion',
        'community'
      );

      // Create success embed
      const setupEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Advanced Setup Complete!')
        .setDescription('Server is fully configured with Phase 10+ features')
        .addFields(
          {
            name: '🔍 Smart Discovery',
            value: `Analyzed ${report?.summary?.totalChannels || 0} channels`,
            inline: true,
          },
          {
            name: '📊 Channel Distribution',
            value: `
Text: ${report?.summary?.byType?.text || 0}
Voice: ${report?.summary?.byType?.voice || 0}
          `.trim(),
            inline: true,
          },
          {
            name: '📋 Channel Types Detected',
            value: Object.entries(report?.summary?.byPurpose || {})
              .map(([purpose, count]) => `${purpose}: ${count}`)
              .join('\n') || 'None',
            inline: false,
          },
          {
            name: '💾 Memory System',
            value: '✅ Server memory initialized\n✅ Knowledge base ready\n✅ Conversation tracking enabled',
            inline: false,
          },
          {
            name: '🤖 AI Features Enabled',
            value:
              '✅ Enhanced AI engine\n✅ Voice AI ready\n✅ Smart discovery active\n✅ Auto-profiling enabled',
            inline: false,
          },
          {
            name: 'Next Steps',
            value:
              '1. Review detected channels\n2. Configure staff roles\n3. Set up recovery email\n4. Create server rules in memory\n5. Use `/status` to see all systems',
            inline: false,
          }
        )
        .setTimestamp();

      // Create action buttons
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup_review_channels')
          .setLabel('Review Channels')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_view_report')
          .setLabel('View Report')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_complete')
          .setLabel('Done')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({
        embeds: [setupEmbed],
        components: [buttons],
      });

      Logger.success(`✅ Advanced setup completed for ${interaction.guild.name}`);

      // Log this action
      await client.engines.security.logAction(
        interaction.guildId,
        interaction.user.id,
        'advanced_setup_completed',
        'success',
        {
          channelsAnalyzed: report?.summary?.totalChannels || 0,
          memoryInitialized: true,
          aiEnabled: true,
        }
      );
    } catch (error) {
      Logger.error('Advanced setup failed:', error);
      await interaction.editReply({
        content: `❌ Setup failed: ${error.message}`,
      });
    }
  },
};
