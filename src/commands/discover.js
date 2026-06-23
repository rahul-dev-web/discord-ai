/**
 * DISCOVER COMMAND - Phase 13
 * Live, dynamic command discovery based on user's role and capabilities
 * 
 * Usage:
 * /discover - Show what I can do
 * /discover capabilities - Detailed list of my capabilities
 * /discover tools - All available tools
 * /discover role - What my current role is
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('discover')
    .setDescription('🔍 Discover what you can do based on your role')
    .addSubcommand(subcommand =>
      subcommand
        .setName('capabilities')
        .setDescription('Show all your available capabilities')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('tools')
        .setDescription('Show all available tools in the server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('role')
        .setDescription('Check your current role and permissions')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('documentation')
        .setDescription('Get full documentation of available commands')
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();
      const discoveryEngine = client.engines.discovery;

      if (!discoveryEngine) {
        return await interaction.editReply({
          content: '❌ Discovery engine not initialized',
        });
      }

      switch (subcommand) {
        case 'capabilities':
          return await handleCapabilities(interaction, client, discoveryEngine);

        case 'tools':
          return await handleTools(interaction, client, discoveryEngine);

        case 'role':
          return await handleRole(interaction, client, discoveryEngine);

        case 'documentation':
          return await handleDocumentation(interaction, client, discoveryEngine);

        default:
          return await interaction.editReply({
            content: '❓ Unknown subcommand',
          });
      }
    } catch (error) {
      Logger.error('Discover command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while discovering commands',
      });
    }
  },
};

/**
 * Show user's capabilities
 */
async function handleCapabilities(interaction, client, discoveryEngine) {
  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Get user capabilities from Phase 13 engine
    const capabilities = await discoveryEngine.getUserCapabilities(guildId, userId);

    if (!capabilities || capabilities.error) {
      return await interaction.editReply({
        content: '❌ Failed to retrieve your capabilities',
      });
    }

    // Create embed showing capabilities
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🎯 Your Available Capabilities')
      .setDescription(
        `You have **${capabilities.count}** capabilities available as a **${capabilities.role}**`
      )
      .setThumbnail(interaction.user.displayAvatarURL());

    // Group capabilities by category
    const capabilities_by_category = groupCapabilities(capabilities.capabilities);

    for (const [category, caps] of Object.entries(capabilities_by_category)) {
      embed.addFields({
        name: `${getEmoji(category)} ${category}`,
        value: caps.map(cap => `• \`${cap}\``).join('\n'),
        inline: false,
      });
    }

    embed.setFooter({
      text: 'Use /discover tools to see available commands for these capabilities',
    });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('Failed to handle capabilities:', error);
    await interaction.editReply({
      content: '❌ Error retrieving capabilities',
    });
  }
}

/**
 * Show all available tools in the server
 */
async function handleTools(interaction, client, discoveryEngine) {
  try {
    const guildId = interaction.guildId;

    // Get all available tools
    const allTools = await discoveryEngine.getAvailableTools(guildId);

    if (!allTools || Object.keys(allTools).length === 0) {
      return await interaction.editReply({
        content: '📭 No tools registered in this server yet',
      });
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🛠️ Available Tools')
      .setDescription(
        `There are **${Object.keys(allTools).length}** tools available in this server`
      );

    // Group tools by capability
    const toolsByCapability = {};

    for (const [toolId, toolData] of Object.entries(allTools)) {
      const capability = toolData.capability || 'other';

      if (!toolsByCapability[capability]) {
        toolsByCapability[capability] = [];
      }

      toolsByCapability[capability].push({
        id: toolId,
        name: toolData.name,
        command: toolData.command,
      });
    }

    // Add fields
    for (const [capability, tools] of Object.entries(toolsByCapability)) {
      const toolList = tools
        .map(t => `• \`${t.command}\` - ${t.name}`)
        .join('\n');

      embed.addFields({
        name: `${getEmoji(capability)} ${capability}`,
        value: toolList || 'No tools',
        inline: false,
      });
    }

    embed.setFooter({
      text: 'Use /discover capabilities to see what you can access',
    });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('Failed to handle tools:', error);
    await interaction.editReply({
      content: '❌ Error retrieving tools',
    });
  }
}

/**
 * Show user's current role
 */
async function handleRole(interaction, client, discoveryEngine) {
  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const member = await interaction.guild.members.fetch(userId);

    // Get role from discovery engine
    const role = await discoveryEngine.detectUserRole(guildId, userId);
    const capabilities = await discoveryEngine.getCapabilitiesForRole(
      guildId,
      role
    );

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle('👤 Your Role Information')
      .setDescription(`You are a **${role}** in this server`)
      .setThumbnail(interaction.user.displayAvatarURL());

    // Add role info
    embed.addFields(
      {
        name: '🏷️ Discord Role',
        value: member.roles.highest.toString() || 'Member',
        inline: true,
      },
      {
        name: '📊 Capability Count',
        value: `${capabilities.length} capabilities`,
        inline: true,
      },
      {
        name: '⚡ Access Level',
        value: getRoleLevel(role),
        inline: true,
      }
    );

    // Add permissions summary
    const hasAdmin = member.permissions.has('Administrator');
    const hasModerator = member.permissions.has('ModerateMembers');
    const hasManageChannels = member.permissions.has('ManageChannels');

    embed.addFields({
      name: '🔑 Key Permissions',
      value: [
        hasAdmin ? '✅ Administrator' : '❌ Administrator',
        hasModerator ? '✅ Moderator' : '❌ Moderator',
        hasManageChannels ? '✅ Manage Channels' : '❌ Manage Channels',
      ].join('\n'),
      inline: false,
    });

    embed.setFooter({
      text: 'Use /discover capabilities to see all your abilities',
    });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    Logger.error('Failed to handle role:', error);
    await interaction.editReply({
      content: '❌ Error retrieving role information',
    });
  }
}

/**
 * Show full documentation
 */
async function handleDocumentation(interaction, client, discoveryEngine) {
  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Generate documentation
    const documentation = await discoveryEngine.generateDocumentation(guildId, userId);

    if (!documentation) {
      return await interaction.editReply({
        content: '❌ Failed to generate documentation',
      });
    }

    // Create embeds (limit to 10 embeds per message)
    const embeds = [];

    // First embed - summary
    const summaryEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📚 Complete Command Documentation')
      .setDescription(
        `Generated for **${documentation.role}** role\n` +
        `You have access to **${documentation.totalCapabilities}** capabilities\n` +
        `Server has **${documentation.totalTools}** registered tools`
      )
      .setTimestamp();

    embeds.push(summaryEmbed);

    // Add capability embeds
    for (const capability of documentation.capabilities.slice(0, 9)) {
      const capEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(
          `${getEmoji(capability.name)} ${capability.name}`
        )
        .setDescription(capability.description);

      if (capability.tools && capability.tools.length > 0) {
        const toolList = capability.tools
          .map(t => `• **${t.name}** - ${t.description}`)
          .join('\n');

        capEmbed.addFields({
          name: '🛠️ Available Tools',
          value: toolList || 'No tools',
          inline: false,
        });
      }

      embeds.push(capEmbed);
    }

    await interaction.editReply({ embeds });
  } catch (error) {
    Logger.error('Failed to handle documentation:', error);
    await interaction.editReply({
      content: '❌ Error generating documentation',
    });
  }
}

/**
 * Group capabilities by category
 */
function groupCapabilities(capabilities) {
  const groups = {
    'Management': [],
    'Moderation': [],
    'Tickets & Support': [],
    'Analytics': [],
    'Communication': [],
    'Voice': [],
    'Other': [],
  };

  const categoryMap = {
    manage_bot: 'Management',
    manage_plugins: 'Management',
    restart_bot: 'Management',
    manage_roles: 'Management',
    manage_channels: 'Management',
    change_settings: 'Management',
    manage_members: 'Moderation',
    manage_messages: 'Moderation',
    manage_tournament: 'Management',
    create_tournament: 'Management',
    create_ticket: 'Tickets & Support',
    manage_ticket: 'Tickets & Support',
    view_analytics: 'Analytics',
    view_logs: 'Moderation',
    send_messages: 'Communication',
    view_members: 'Communication',
    manage_voice: 'Voice',
    view_server_stats: 'Analytics',
  };

  for (const cap of capabilities) {
    const category = categoryMap[cap] || 'Other';
    if (groups[category]) {
      groups[category].push(cap);
    }
  }

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([, caps]) => caps.length > 0)
  );
}

/**
 * Get emoji for capability category
 */
function getEmoji(category) {
  const emojis = {
    Management: '🤖',
    Moderation: '🛡️',
    'Tickets & Support': '🎫',
    Analytics: '📊',
    Communication: '💬',
    Voice: '🎤',
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

  return emojis[category] || '⚡';
}

/**
 * Get role level display
 */
function getRoleLevel(role) {
  const levels = {
    owner: '🔴 Level 5 - Owner',
    lead: '🟠 Level 4 - Lead',
    admin: '🟡 Level 3 - Admin',
    senior_staff: '🟢 Level 2 - Senior Staff',
    staff: '🔵 Level 2 - Staff',
    moderator: '🟣 Level 1 - Moderator',
    member: '⚪ Level 0 - Member',
    guest: '⚪ Level -1 - Guest',
  };

  return levels[role] || '⚪ Unknown';
}
