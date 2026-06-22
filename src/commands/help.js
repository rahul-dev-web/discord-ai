/**
 * HELP COMMAND
 * Shows available commands and capabilities
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows available commands and features')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Command category')
        .addChoices(
          { name: 'General', value: 'general' },
          { name: 'Tournament', value: 'tournament' },
          { name: 'Support', value: 'support' },
          { name: 'Analytics', value: 'analytics' },
          { name: 'Moderation', value: 'moderation' },
          { name: 'Voice', value: 'voice' }
        )
    ),

  async execute(interaction, client) {
    const category = interaction.options.getString('category') || 'general';

    const helpEmbeds = {
      general: new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📚 General Commands')
        .setDescription('Basic bot commands and features')
        .addFields(
          { name: '/help', value: 'Shows this help message', inline: true },
          { name: '/info', value: 'Bot information and status', inline: true },
          { name: '/ping', value: 'Check bot latency', inline: true },
          { name: '/setup', value: 'Initial server setup wizard', inline: true }
        )
        .setFooter({ text: 'Use /help [category] for more info' }),

      tournament: new EmbedBuilder()
        .setColor('#ff6600')
        .setTitle('🎮 Tournament Commands')
        .setDescription('Tournament and competition management')
        .addFields(
          { name: '/tournament create', value: 'Create new tournament', inline: true },
          { name: '/tournament register', value: 'Register team for tournament', inline: true },
          { name: '/tournament bracket', value: 'View tournament bracket', inline: true },
          { name: '/tournament leaderboard', value: 'View leaderboard', inline: true },
          { name: '/match schedule', value: 'Schedule a match', inline: true },
          { name: '/match result', value: 'Report match result', inline: true }
        ),

      support: new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💬 Support Commands')
        .setDescription('Support ticket and helpdesk system')
        .addFields(
          { name: '/ticket create', value: 'Create support ticket', inline: true },
          { name: '/ticket list', value: 'List your tickets', inline: true },
          { name: '/faq search', value: 'Search FAQs', inline: true },
          { name: '/faq list', value: 'List all FAQs', inline: true }
        ),

      analytics: new EmbedBuilder()
        .setColor('#9933ff')
        .setTitle('📊 Analytics Commands')
        .setDescription('Server statistics and analytics')
        .addFields(
          { name: '/stats daily', value: 'Today\'s statistics', inline: true },
          { name: '/stats weekly', value: 'Weekly statistics', inline: true },
          { name: '/stats member', value: 'Member activity stats', inline: true },
          { name: '/report generate', value: 'Generate analytics report', inline: true }
        ),

      moderation: new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🛡️ Moderation Commands')
        .setDescription('Moderation and member management')
        .addFields(
          { name: '/warn member', value: 'Warn a member', inline: true },
          { name: '/mute member', value: 'Mute a member', inline: true },
          { name: '/logs view', value: 'View moderation logs', inline: true },
          { name: '/member status', value: 'Check member status', inline: true }
        ),

      voice: new EmbedBuilder()
        .setColor('#00ccff')
        .setTitle('🎤 Voice Commands')
        .setDescription('Voice channel management')
        .addFields(
          { name: '/voice active', value: 'List active voice channels', inline: true },
          { name: '/voice stats', value: 'Get voice statistics', inline: true },
          { name: '/voice duration', value: 'Check session duration', inline: true }
        ),
    };

    const embed = helpEmbeds[category] || helpEmbeds.general;
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
