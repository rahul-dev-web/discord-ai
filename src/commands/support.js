/**
 * SUPPORT COMMAND - Phase 14
 * Manage support/helpdesk system
 * 
 * Usage:
 * /support status - Check support system status
 * /support stats - Get support statistics
 * /support faq - Manage FAQ
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Manage support system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check support system status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View support statistics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('faq')
        .setDescription('Manage FAQ')
        .addStringOption(option =>
          option
            .setName('action')
            .setDescription('Action to perform')
            .addChoices(
              { name: 'View', value: 'view' },
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' }
            )
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('key')
            .setDescription('FAQ key/ID')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('question')
            .setDescription('Question text')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('answer')
            .setDescription('Answer text')
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const supportAI = client.engines.supportAI;

      if (!supportAI) {
        return await interaction.editReply({
          content: '❌ Support AI engine not initialized',
        });
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'status':
          return await handleStatus(interaction, client, supportAI);

        case 'stats':
          return await handleStats(interaction, client, supportAI);

        case 'faq':
          return await handleFAQ(interaction, client, supportAI);

        default:
          return await interaction.editReply('❓ Unknown subcommand');
      }
    } catch (error) {
      Logger.error('Support command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred',
      });
    }
  },
};

/**
 * Check support system status
 */
async function handleStatus(interaction, client, supportAI) {
  try {
    // Get stats
    const stats = await supportAI.getTicketStats(interaction.guildId);

    // Count staff
    const guild = await interaction.guild.fetch();
    const staffMembers = guild.members.cache.filter(m =>
      m.roles.cache.some(r =>
        r.name.toLowerCase().includes('staff') ||
        r.name.toLowerCase().includes('mod')
      ) && !m.user.bot
    );

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('💬 Support System Status')
      .setDescription('Current status of the support/helpdesk system')
      .addFields(
        {
          name: '🎫 Open Tickets',
          value: `${stats.open} tickets`,
          inline: true,
        },
        {
          name: '👨‍💼 Available Staff',
          value: `${staffMembers.size} members`,
          inline: true,
        },
        {
          name: '⚡ System Status',
          value: '🟢 Operational',
          inline: true,
        },
        {
          name: '📊 Total Tickets',
          value: `${stats.total} all-time`,
          inline: true,
        },
        {
          name: '✅ Resolved',
          value: `${stats.resolved} tickets`,
          inline: true,
        },
        {
          name: '📈 Success Rate',
          value: stats.total > 0 
            ? `${Math.round((stats.resolved / stats.total) * 100)}%`
            : 'N/A',
          inline: true,
        }
      )
      .setFooter({
        text: 'Use /ticket list to view all tickets',
      })
      .setTimestamp();

    // Add status indicator
    if (stats.open > 10) {
      embed.setColor('#ff9900');
    } else if (stats.open > 20) {
      embed.setColor('#ff0000');
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('Status check error:', error);
    await interaction.editReply({
      content: '❌ Failed to get status',
    });
  }
}

/**
 * View support statistics
 */
async function handleStats(interaction, client, supportAI) {
  try {
    // Get all tickets
    const stats = await supportAI.getTicketStats(interaction.guildId);
    const tickets = await supportAI.searchTickets(interaction.guildId, {});

    // Calculate additional stats
    let avgResolutionTime = 0;
    let resolvedTickets = tickets.filter(t => t.status === 'resolved');

    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt);
        const resolved = new Date(ticket.resolvedAt);
        return sum + (resolved - created);
      }, 0);

      avgResolutionTime = Math.round(totalTime / resolvedTickets.length / 60000); // in minutes
    }

    // Category breakdown
    const byCategory = {};
    for (const ticket of tickets) {
      const category = ticket.category || 'general';
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    // Priority breakdown
    const byPriority = {};
    for (const ticket of tickets) {
      const priority = ticket.priority || 'medium';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('📊 Support Statistics')
      .setDescription('Detailed support system statistics');

    // Overall stats
    const categoryStr = Object.entries(byCategory)
      .map(([cat, count]) => `• ${cat}: ${count}`)
      .join('\n') || 'No data';

    const priorityStr = Object.entries(byPriority)
      .map(([pri, count]) => `• ${pri}: ${count}`)
      .join('\n') || 'No data';

    embed.addFields(
      {
        name: '📈 Overall',
        value: `Total: ${stats.total}\nOpen: ${stats.open}\nResolved: ${stats.resolved}\nClosed: ${stats.closed}`,
        inline: true,
      },
      {
        name: '📁 By Category',
        value: categoryStr,
        inline: true,
      },
      {
        name: '⚡ By Priority',
        value: priorityStr,
        inline: true,
      },
      {
        name: '⏱️ Resolution Time',
        value: avgResolutionTime > 0 
          ? `Avg ${avgResolutionTime} minutes`
          : 'No resolved tickets',
        inline: true,
      }
    );

    embed.setFooter({ text: 'Updated just now' });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('Stats error:', error);
    await interaction.editReply({
      content: '❌ Failed to get statistics',
    });
  }
}

/**
 * Manage FAQ
 */
async function handleFAQ(interaction, client, supportAI) {
  try {
    const action = interaction.options.getString('action');
    const key = interaction.options.getString('key');
    const question = interaction.options.getString('question');
    const answer = interaction.options.getString('answer');

    // Check permission
    if (!interaction.member.permissions.has('ManageMessages')) {
      return await interaction.editReply({
        content: '❌ You need Manage Messages permission to modify FAQ',
      });
    }

    const faqPath = `servers/${interaction.guildId}/memory/faq`;

    switch (action) {
      case 'view': {
        const faq = await firebase.get(faqPath);

        if (!faq || Object.keys(faq).length === 0) {
          return await interaction.editReply({
            content: '📭 No FAQ entries found',
          });
        }

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('📚 Frequently Asked Questions')
          .setDescription(`${Object.keys(faq).length} entries`);

        for (const [faqKey, faqData] of Object.entries(faq).slice(0, 10)) {
          embed.addFields({
            name: `❓ ${faqKey}`,
            value: `**Q:** ${faqData.question}\n**A:** ${faqData.answer.substring(0, 100)}...`,
            inline: false,
          });
        }

        embed.setFooter({
          text: Object.keys(faq).length > 10 ? `Showing 10 of ${Object.keys(faq).length}` : '',
        });

        return await interaction.editReply({ embeds: [embed] });
      }

      case 'add': {
        if (!key || !question || !answer) {
          return await interaction.editReply({
            content: '❌ Please provide key, question, and answer',
          });
        }

        const faq = (await firebase.get(faqPath)) || {};
        faq[key] = { question, answer };

        await firebase.set(faqPath, faq);

        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ FAQ Added')
          .addFields(
            { name: 'Key', value: key, inline: true },
            { name: 'Question', value: question, inline: false },
            { name: 'Answer', value: answer.substring(0, 200) + (answer.length > 200 ? '...' : ''), inline: false }
          );

        return await interaction.editReply({ embeds: [embed] });
      }

      case 'remove': {
        if (!key) {
          return await interaction.editReply({
            content: '❌ Please provide FAQ key to remove',
          });
        }

        const faq = (await firebase.get(faqPath)) || {};

        if (!faq[key]) {
          return await interaction.editReply({
            content: `❌ FAQ entry not found: ${key}`,
          });
        }

        delete faq[key];
        await firebase.set(faqPath, faq);

        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('✅ FAQ Removed')
          .addFields({
            name: 'Removed Key',
            value: key,
            inline: false,
          });

        return await interaction.editReply({ embeds: [embed] });
      }

      default:
        return await interaction.editReply({
          content: '❓ Unknown action',
        });
    }
  } catch (error) {
    Logger.error('FAQ management error:', error);
    await interaction.editReply({
      content: '❌ Failed to manage FAQ',
    });
  }
}
