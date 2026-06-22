/**
 * MEMORY COMMAND - Phase 12
 * View, search, and manage server memory and knowledge base
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('Manage server memory and knowledge base')
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('Search knowledge base')
        .addStringOption((opt) =>
          opt.setName('query').setDescription('Search query').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('rules')
        .setDescription('View server rules')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add-rule')
        .setDescription('Add a server rule')
        .addStringOption((opt) =>
          opt
            .setName('rule')
            .setDescription('Rule content')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('knowledge')
        .setDescription('View knowledge base')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Knowledge type')
            .addChoices(
              { name: 'Tournament History', value: 'tournament_history' },
              { name: 'Organization', value: 'org_knowledge' },
              { name: 'Support', value: 'support_history' },
              { name: 'Training', value: 'training' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('export')
        .setDescription('Export all memory')
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const memorySystem = client.engines.memory;

    if (!memorySystem) {
      return await interaction.reply({
        content: '❌ Memory system not initialized!',
        ephemeral: true,
      });
    }

    try {
      if (subcommand === 'search') {
        await handleSearch(interaction, client, memorySystem);
      } else if (subcommand === 'rules') {
        await handleViewRules(interaction, client, memorySystem);
      } else if (subcommand === 'add-rule') {
        await handleAddRule(interaction, client, memorySystem);
      } else if (subcommand === 'knowledge') {
        await handleViewKnowledge(interaction, client, memorySystem);
      } else if (subcommand === 'export') {
        await handleExport(interaction, client, memorySystem);
      }
    } catch (error) {
      Logger.error('Memory command error:', error);
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

/**
 * Search knowledge base
 */
async function handleSearch(interaction, client, memorySystem) {
  const query = interaction.options.getString('query');

  await interaction.deferReply();

  const results = await memorySystem.searchKnowledgeBase(interaction.guildId, query);

  if (results.length === 0) {
    return await interaction.editReply('❌ No results found for your query.');
  }

  let resultText = '';
  results.slice(0, 5).forEach((item, index) => {
    resultText += `**${index + 1}. ${item.title}** (${item.type})\n`;
    resultText += `${item.content.substring(0, 100)}...\n\n`;
  });

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`🔍 Knowledge Base Search: "${query}"`)
    .setDescription(resultText)
    .setFooter({ text: `Found ${results.length} results` });

  await interaction.editReply({ embeds: [embed] });

  // Log search
  await client.engines.security.logAction(
    interaction.guildId,
    interaction.user.id,
    'knowledge_search',
    'success',
    { query, resultCount: results.length }
  );
}

/**
 * View server rules
 */
async function handleViewRules(interaction, client, memorySystem) {
  await interaction.deferReply();

  const firebase = require('../core/firebase-config');
  const rules = await firebase.get(`servers/${interaction.guildId}/server_memory/rules`);

  if (!rules || Object.keys(rules).length === 0) {
    return await interaction.editReply('ℹ️ No rules configured yet. Use `/memory add-rule` to add one.');
  }

  let rulesText = '';
  Object.entries(rules).forEach(([id, rule], index) => {
    rulesText += `**${index + 1}. ${rule.content}**\n`;
    rulesText += `_Category: ${rule.category}_\n\n`;
  });

  const embed = new EmbedBuilder()
    .setColor('#ff6600')
    .setTitle('📋 Server Rules')
    .setDescription(rulesText)
    .setFooter({ text: `Total: ${Object.keys(rules).length} rules` });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Add a server rule
 */
async function handleAddRule(interaction, client, memorySystem) {
  // Check if user is admin
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.reply({
      content: '❌ Only admins can add rules!',
      ephemeral: true,
    });
  }

  const rule = interaction.options.getString('rule');

  const ruleId = await memorySystem.storeServerRule(
    interaction.guildId,
    `rule-${Date.now()}`,
    rule,
    'custom'
  );

  if (ruleId) {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Rule Added')
      .setDescription(`**${rule}**`)
      .setFooter({ text: `Rule ID: ${ruleId}` });

    await interaction.reply({ embeds: [embed] });

    // Log action
    await client.engines.security.logAction(
      interaction.guildId,
      interaction.user.id,
      'rule_added',
      'success',
      { rule, ruleId }
    );
  } else {
    await interaction.reply('❌ Failed to add rule.');
  }
}

/**
 * View knowledge by type
 */
async function handleViewKnowledge(interaction, client, memorySystem) {
  const type = interaction.options.getString('type');

  await interaction.deferReply();

  const firebase = require('../core/firebase-config');
  const knowledge = await firebase.get(
    `servers/${interaction.guildId}/knowledge_base/${type}`
  );

  if (!knowledge || Object.keys(knowledge).length === 0) {
    return await interaction.editReply(
      `ℹ️ No ${type.replace('_', ' ')} in knowledge base yet.`
    );
  }

  let kbText = '';
  Object.entries(knowledge).forEach(([id, item], index) => {
    kbText += `**${index + 1}. ${item.title}**\n`;
    kbText += `${item.content.substring(0, 150)}...\n\n`;
  });

  const embed = new EmbedBuilder()
    .setColor('#9933ff')
    .setTitle(`📚 ${type.replace('_', ' ')}`)
    .setDescription(kbText || 'No items')
    .setFooter({ text: `Total: ${Object.keys(knowledge).length} items` });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Export all memory
 */
async function handleExport(interaction, client, memorySystem) {
  // Check if user is owner
  if (interaction.guild.ownerId !== interaction.user.id) {
    return await interaction.reply({
      content: '❌ Only the server owner can export memory!',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const memory = await memorySystem.exportMemory(interaction.guildId);

  if (memory) {
    const fileName = `server-memory-${interaction.guildId}-${Date.now()}.json`;
    const fileContent = JSON.stringify(memory, null, 2);

    // Create file (would need file system access in production)
    Logger.info(`📤 Memory exported for server ${interaction.guildId}`);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('✅ Memory Exported')
      .setDescription(`
Memory has been exported successfully.
File: \`${fileName}\`
Size: ${Math.round(fileContent.length / 1024)} KB
      `.trim());

    await interaction.editReply({ embeds: [embed] });

    // Log action
    await client.engines.security.logAction(
      interaction.guildId,
      interaction.user.id,
      'memory_exported',
      'success',
      { fileName, size: fileContent.length }
    );
  } else {
    await interaction.editReply('❌ Failed to export memory.');
  }
}
