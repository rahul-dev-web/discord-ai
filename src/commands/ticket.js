/**
 * TICKET COMMAND - Phase 14
 * Manage support tickets
 * 
 * Usage:
 * /ticket create - Create a new ticket
 * /ticket list - List tickets
 * /ticket view - View ticket details
 * /ticket resolve - Mark ticket as resolved
 * /ticket assign - Assign ticket to staff
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage support tickets')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new support ticket')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Ticket title')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Detailed description')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Issue category')
            .addChoices(
              { name: 'General', value: 'general' },
              { name: 'Technical', value: 'technical' },
              { name: 'Account', value: 'account' },
              { name: 'Billing', value: 'billing' },
              { name: 'Tournament', value: 'tournament' },
              { name: 'Other', value: 'other' }
            )
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('priority')
            .setDescription('Priority level')
            .addChoices(
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' },
              { name: 'Critical', value: 'critical' }
            )
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List tickets')
        .addStringOption(option =>
          option
            .setName('filter')
            .setDescription('Filter by status')
            .addChoices(
              { name: 'Open', value: 'open' },
              { name: 'Resolved', value: 'resolved' },
              { name: 'Closed', value: 'closed' },
              { name: 'All', value: 'all' }
            )
            .setRequired(false)
        )
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('Filter by user')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View ticket details')
        .addStringOption(option =>
          option
            .setName('ticket')
            .setDescription('Ticket ID (e.g., TICKET-123456)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('resolve')
        .setDescription('Mark ticket as resolved')
        .addStringOption(option =>
          option
            .setName('ticket')
            .setDescription('Ticket ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('resolution')
            .setDescription('How was it resolved?')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('assign')
        .setDescription('Assign ticket to staff')
        .addStringOption(option =>
          option
            .setName('ticket')
            .setDescription('Ticket ID')
            .setRequired(true)
        )
        .addUserOption(option =>
          option
            .setName('staff')
            .setDescription('Staff member')
            .setRequired(true)
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
        case 'create':
          return await handleCreate(interaction, client, supportAI);

        case 'list':
          return await handleList(interaction, client, supportAI);

        case 'view':
          return await handleView(interaction, client, supportAI);

        case 'resolve':
          return await handleResolve(interaction, client, supportAI);

        case 'assign':
          return await handleAssign(interaction, client, supportAI);

        default:
          return await interaction.editReply('❓ Unknown subcommand');
      }
    } catch (error) {
      Logger.error('Ticket command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while managing the ticket',
      });
    }
  },
};

/**
 * Create new ticket
 */
async function handleCreate(interaction, client, supportAI) {
  try {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const category = interaction.options.getString('category') || 'general';
    const priority = interaction.options.getString('priority') || 'medium';

    // Create ticket
    const ticket = await supportAI.createTicket(
      interaction.guildId,
      interaction.user.id,
      interaction.channelId,
      `${title}\n\n${description}`,
      {
        intent: category,
        complexity: description.length > 200 ? 'high' : 'low',
        hasError: /error|bug|broken/i.test(description),
      }
    );

    // Update priority and category if provided
    ticket.priority = priority;
    ticket.category = category;

    await firebase.set(
      `servers/${interaction.guildId}/tickets/${ticket.id}`,
      ticket
    );

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Ticket Created')
      .setDescription(`Your ticket has been created and assigned to our support team.`)
      .addFields(
        { name: '🎫 Ticket ID', value: ticket.id, inline: true },
        { name: '📁 Category', value: category, inline: true },
        { name: '⚡ Priority', value: priority.toUpperCase(), inline: true },
        { name: '📝 Title', value: title, inline: false },
        { name: '✉️ What to do next', value: 'Our team will respond in this channel shortly!', inline: false }
      )
      .setFooter({ text: 'Save your ticket ID for reference' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    Logger.info(`✅ Ticket created: ${ticket.id}`);
  } catch (error) {
    Logger.error('Create ticket error:', error);
    await interaction.editReply({
      content: '❌ Failed to create ticket',
    });
  }
}

/**
 * List tickets
 */
async function handleList(interaction, client, supportAI) {
  try {
    const filter = interaction.options.getString('filter') || 'open';
    const user = interaction.options.getUser('user');

    // Build filters
    const filters = {};
    if (filter !== 'all') {
      filters.status = filter;
    }
    if (user) {
      filters.userId = user.id;
    }

    // Search tickets
    const tickets = await supportAI.searchTickets(interaction.guildId, filters);

    if (tickets.length === 0) {
      return await interaction.editReply({
        content: `📭 No tickets found${filter !== 'all' ? ` with status: ${filter}` : ''}`,
      });
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🎫 Support Tickets')
      .setDescription(`Found **${tickets.length}** ticket(s)`)
      .setThumbnail(client.user.displayAvatarURL());

    // Add tickets (limit to 10)
    for (const ticket of tickets.slice(0, 10)) {
      const userTag = ticket.userId ? `<@${ticket.userId}>` : 'Unknown';
      const timeAgo = getTimeAgo(new Date(ticket.createdAt));

      embed.addFields({
        name: `${getStatusEmoji(ticket.status)} ${ticket.id} - ${ticket.priority.toUpperCase()}`,
        value: `User: ${userTag}\nCategory: ${ticket.category}\nCreated: ${timeAgo} ago\nTitle: ${ticket.title.substring(0, 50)}...`,
        inline: false,
      });
    }

    if (tickets.length > 10) {
      embed.setFooter({ text: `Showing 10 of ${tickets.length} tickets` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('List tickets error:', error);
    await interaction.editReply({
      content: '❌ Failed to list tickets',
    });
  }
}

/**
 * View ticket details
 */
async function handleView(interaction, client, supportAI) {
  try {
    const ticketId = interaction.options.getString('ticket');

    // Get ticket
    const ticket = await supportAI.getTicket(interaction.guildId, ticketId);

    if (!ticket) {
      return await interaction.editReply({
        content: `❌ Ticket not found: ${ticketId}`,
      });
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(getStatusColor(ticket.status))
      .setTitle(`🎫 ${ticket.id}`)
      .setDescription(ticket.description.substring(0, 500))
      .addFields(
        { name: '👤 User', value: `<@${ticket.userId}>`, inline: true },
        { name: '📊 Status', value: `${getStatusEmoji(ticket.status)} ${ticket.status}`, inline: true },
        { name: '⚡ Priority', value: ticket.priority.toUpperCase(), inline: true },
        { name: '📁 Category', value: ticket.category, inline: true },
        { name: '👨‍💼 Assigned To', value: ticket.assignedTo ? `<@${ticket.assignedTo}>` : 'Unassigned', inline: true },
        { name: '📍 Channel', value: `<#${ticket.channelId}>`, inline: true },
        { name: '📅 Created', value: getTimeAgo(new Date(ticket.createdAt)) + ' ago', inline: true },
        { name: '✏️ Title', value: ticket.title, inline: false }
      );

    if (ticket.resolvedAt) {
      embed.addFields({
        name: '✅ Resolved',
        value: `${getTimeAgo(new Date(ticket.resolvedAt))} ago by <@${ticket.resolvedBy}>`,
        inline: false,
      });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('View ticket error:', error);
    await interaction.editReply({
      content: '❌ Failed to view ticket',
    });
  }
}

/**
 * Resolve ticket
 */
async function handleResolve(interaction, client, supportAI) {
  try {
    const ticketId = interaction.options.getString('ticket');
    const resolution = interaction.options.getString('resolution');

    // Update ticket
    const ticket = await supportAI.getTicket(interaction.guildId, ticketId);

    if (!ticket) {
      return await interaction.editReply({
        content: `❌ Ticket not found: ${ticketId}`,
      });
    }

    ticket.status = 'resolved';
    ticket.resolution = resolution;
    ticket.resolvedAt = new Date().toISOString();
    ticket.resolvedBy = interaction.user.id;

    await firebase.set(
      `servers/${interaction.guildId}/tickets/${ticketId}`,
      ticket
    );

    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Ticket Resolved')
      .addFields(
        { name: 'Ticket ID', value: ticketId, inline: true },
        { name: 'Resolved by', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Resolution', value: resolution, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    Logger.info(`✅ Ticket resolved: ${ticketId}`);
  } catch (error) {
    Logger.error('Resolve ticket error:', error);
    await interaction.editReply({
      content: '❌ Failed to resolve ticket',
    });
  }
}

/**
 * Assign ticket
 */
async function handleAssign(interaction, client, supportAI) {
  try {
    const ticketId = interaction.options.getString('ticket');
    const staff = interaction.options.getUser('staff');

    // Update ticket
    const ticket = await supportAI.getTicket(interaction.guildId, ticketId);

    if (!ticket) {
      return await interaction.editReply({
        content: `❌ Ticket not found: ${ticketId}`,
      });
    }

    ticket.assignedTo = staff.id;

    await firebase.set(
      `servers/${interaction.guildId}/tickets/${ticketId}`,
      ticket
    );

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('✅ Ticket Assigned')
      .addFields(
        { name: 'Ticket ID', value: ticketId, inline: true },
        { name: 'Assigned to', value: `<@${staff.id}>`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Notify staff member
    try {
      await staff.send(`You have been assigned ticket **${ticketId}** by <@${interaction.user.id}>`);
    } catch (e) {
      Logger.warn(`Could not DM staff member: ${staff.id}`);
    }

    Logger.info(`✅ Ticket assigned: ${ticketId} → ${staff.id}`);
  } catch (error) {
    Logger.error('Assign ticket error:', error);
    await interaction.editReply({
      content: '❌ Failed to assign ticket',
    });
  }
}

/**
 * Helper: Get status emoji
 */
function getStatusEmoji(status) {
  const emojis = {
    'open': '🔴',
    'resolved': '🟢',
    'closed': '⚪',
    'on_hold': '🟡',
  };
  return emojis[status] || '⚪';
}

/**
 * Helper: Get status color
 */
function getStatusColor(status) {
  const colors = {
    'open': '#ff0000',
    'resolved': '#00ff00',
    'closed': '#808080',
    'on_hold': '#ffff00',
  };
  return colors[status] || '#0099ff';
}

/**
 * Helper: Format time ago
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

const firebase = require('../core/firebase-config');
