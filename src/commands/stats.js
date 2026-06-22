/**
 * ANALYTICS COMMANDS
 * View server statistics and metrics
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View server statistics')
    .addSubcommand(subcommand =>
      subcommand
        .setName('daily')
        .setDescription('View today\'s statistics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('weekly')
        .setDescription('View weekly statistics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('member')
        .setDescription('View member activity')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to check')
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const analyticsPlugin = client.plugins.get('Analytics');

    if (!analyticsPlugin) {
      return await interaction.reply({
        content: '❌ Analytics plugin is not loaded!',
        ephemeral: true,
      });
    }

    try {
      if (subcommand === 'daily') {
        await handleDaily(interaction, analyticsPlugin);
      } else if (subcommand === 'weekly') {
        await handleWeekly(interaction, analyticsPlugin);
      } else if (subcommand === 'member') {
        await handleMember(interaction, client, analyticsPlugin);
      }
    } catch (error) {
      Logger.error('Stats command error:', error);
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

async function handleDaily(interaction, analyticsPlugin) {
  await interaction.deferReply();

  const today = new Date().toISOString().split('T')[0];
  const stats = await analyticsPlugin.getDailyStats(interaction.guildId, today);

  if (!stats) {
    return await interaction.editReply('❌ Failed to fetch statistics');
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`📊 Daily Statistics - ${today}`)
    .addFields(
      { name: '💬 Messages', value: stats.messages.toString(), inline: true },
      { name: '➕ Joins', value: stats.joins.toString(), inline: true },
      { name: '➖ Leaves', value: stats.leaves.toString(), inline: true },
      {
        name: 'Net Change',
        value: stats.netChange > 0 ? `+${stats.netChange}` : stats.netChange.toString(),
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleWeekly(interaction, analyticsPlugin) {
  await interaction.deferReply();

  const stats = await analyticsPlugin.getWeeklyStats(interaction.guildId);

  if (!stats) {
    return await interaction.editReply('❌ Failed to fetch statistics');
  }

  let weeklyData = '';
  stats.weekStats.forEach(day => {
    weeklyData += `**${day.date}**: ${day.messages} messages, ${day.joins} joins, ${day.leaves} leaves\n`;
  });

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('📊 Weekly Statistics')
    .setDescription(weeklyData)
    .addFields(
      { name: '💬 Total Messages', value: stats.totalMessages.toString(), inline: true },
      { name: '👥 Total Joins', value: stats.totalJoins.toString(), inline: true },
      { name: '📉 Total Leaves', value: stats.totalLeaves.toString(), inline: true },
      {
        name: 'Growth',
        value: (stats.totalJoins - stats.totalLeaves).toString(),
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleMember(interaction, client, analyticsPlugin) {
  const user = interaction.options.getUser('user');
  await interaction.deferReply();

  const memberActivity = await analyticsPlugin.getMemberActivity(interaction.guildId, user.id);

  const voiceStats = await client.plugins
    .get('Voice')
    ?.getMemberVoiceStats(interaction.guildId, user.id);

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`👤 ${user.username}'s Activity`)
    .addFields(
      {
        name: '💬 Messages',
        value: memberActivity?.messageCount?.toString() || '0',
        inline: true,
      },
      {
        name: '🎤 Voice Duration',
        value: voiceStats?.totalMinutes?.toString() + ' minutes' || '0 minutes',
        inline: true,
      },
      {
        name: '📞 Voice Sessions',
        value: voiceStats?.sessionCount?.toString() || '0',
        inline: true,
      },
      {
        name: 'Last Active',
        value: memberActivity?.lastActive || 'Never',
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
