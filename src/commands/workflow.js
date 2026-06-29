/**
 * WORKFLOW COMMAND - Phase 17
 * 
 * Main user interface for executing workflows
 * Supports:
 * - List available workflows
 * - Execute workflows
 * - Track progress
 * - View history
 * - Cancel running workflows
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('workflow')
    .setDescription('🔄 Execute automation workflows')
    .setDefaultMemberPermissions('0')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('📋 List all available workflows')
        .addStringOption(option =>
          option
            .setName('filter')
            .setDescription('Filter workflows')
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'Tournament', value: 'tournament' },
              { name: 'Staff', value: 'staff' },
              { name: 'Security', value: 'security' },
              { name: 'Events', value: 'events' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('run')
        .setDescription('▶️ Execute a workflow')
        .addStringOption(option =>
          option
            .setName('workflow')
            .setDescription('Workflow to execute')
            .setRequired(true)
            .addChoices(
              { name: '🏆 Tournament Setup', value: 'tournament-setup' },
              { name: '👤 Staff Onboarding', value: 'staff-onboarding' },
              { name: '🛡️ Raid Response', value: 'raid-response' },
              { name: '💾 Server Backup', value: 'server-backup' },
              { name: '🎉 Event Creation', value: 'event-creation' },
              { name: '⚔️ Match Day', value: 'match-day' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('📊 Check workflow status')
        .addStringOption(option =>
          option
            .setName('execution_id')
            .setDescription('Execution ID (optional)')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('📜 View workflow execution history')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of entries (default: 5)')
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('⛔ Cancel running workflow')
        .addStringOption(option =>
          option
            .setName('confirmation')
            .setDescription('Type "CANCEL" to confirm')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'list':
          await handleListWorkflows(interaction);
          break;
        case 'run':
          await handleRunWorkflow(interaction);
          break;
        case 'status':
          await handleWorkflowStatus(interaction);
          break;
        case 'history':
          await handleWorkflowHistory(interaction);
          break;
        case 'cancel':
          await handleCancelWorkflow(interaction);
          break;
        default:
          await interaction.reply({ content: '❌ Unknown workflow command', ephemeral: true });
      }
    } catch (error) {
      Logger.error('Workflow command error:', error);
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

/**
 * Handle /workflow list command
 */
async function handleListWorkflows(interaction) {
  await interaction.deferReply();

  const workflowEngine = interaction.client.engines.workflowEngine;
  if (!workflowEngine) {
    return interaction.editReply('❌ Workflow engine not initialized');
  }

  const filter = interaction.options.getString('filter') || 'all';
  let workflows = workflowEngine.listWorkflows();

  // Filter workflows
  if (filter !== 'all') {
    workflows = workflows.filter(w => {
      const keywords = w.name.toLowerCase() + ' ' + w.description.toLowerCase();
      return keywords.includes(filter.toLowerCase());
    });
  }

  if (workflows.length === 0) {
    return interaction.editReply('❌ No workflows found matching filter');
  }

  // Create embed
  const embed = new EmbedBuilder()
    .setColor('#7289DA')
    .setTitle('🔄 Available Workflows')
    .setDescription(`Found ${workflows.length} workflow(s)\n\nUse \`/workflow run\` to execute`)
    .setFooter({ text: `Server: ${interaction.guildId}` })
    .setTimestamp();

  workflows.forEach((workflow) => {
    const icon = workflow.name.split(' ')[0];
    const status = workflow.autoTrigger ? '🤖 Auto' : '👤 Manual';
    
    embed.addFields({
      name: `${icon} ${workflow.name.substring(workflow.name.indexOf(' ') + 1)}`,
      value: `${workflow.description}\n**Steps**: ${workflow.steps.length} | **Mode**: ${status}`,
      inline: false,
    });
  });

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle /workflow run command
 */
async function handleRunWorkflow(interaction) {
  await interaction.deferReply();

  const workflowId = interaction.options.getString('workflow');
  const workflowEngine = interaction.client.engines.workflowEngine;

  if (!workflowEngine) {
    return interaction.editReply('❌ Workflow engine not initialized');
  }

  const workflow = workflowEngine.getWorkflow(workflowId);
  if (!workflow) {
    return interaction.editReply('❌ Workflow not found');
  }

  // Check permissions
  try {
    if (workflow.requiredPermissions) {
      const member = interaction.member;
      for (const perm of workflow.requiredPermissions) {
        if (!member.permissions.has(perm)) {
          return interaction.editReply(
            `❌ You don't have permission: **${perm}**`
          );
        }
      }
    }
  } catch (error) {
    Logger.error('Permission check error:', error);
    return interaction.editReply('❌ Error checking permissions');
  }

  // Show preview embed
  const previewEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle(`⚠️ Workflow Preview`)
    .setDescription(`Ready to execute: **${workflow.name}**`)
    .addFields(
      {
        name: 'Description',
        value: workflow.description,
        inline: false,
      },
      {
        name: 'Steps',
        value: workflow.steps.map((s, i) => `${i + 1}. ${s.name}`).join('\n'),
        inline: false,
      },
      {
        name: 'Estimated Time',
        value: estimateWorkflowTime(workflow),
        inline: true,
      },
      {
        name: 'Impact Level',
        value: getImpactLevel(workflow),
        inline: true,
      }
    )
    .setFooter({ text: 'Click "Confirm" to proceed or "Cancel" to abort' })
    .setTimestamp();

  // Action buttons
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`workflow-confirm-${workflowId}`)
      .setLabel('✅ Confirm & Execute')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('workflow-cancel-preview')
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({
    embeds: [previewEmbed],
    components: [buttons],
  });

  // Handle button interaction
  const filter = i => i.customId.startsWith('workflow-') && i.user.id === interaction.user.id;
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId === `workflow-confirm-${workflowId}`) {
      await buttonInteraction.deferUpdate();
      await executeWorkflow(buttonInteraction, workflowId, workflow);
    } else if (buttonInteraction.customId === 'workflow-cancel-preview') {
      await buttonInteraction.update({
        content: '❌ Workflow execution cancelled',
        embeds: [],
        components: [],
      });
      collector.stop();
    }
  });

  collector.on('end', (collected) => {
    if (collected.size === 0) {
      interaction.editReply({
        content: '⏱️ Workflow preview expired',
        embeds: [],
        components: [],
      }).catch(() => {});
    }
  });
}

/**
 * Execute workflow
 */
async function executeWorkflow(interaction, workflowId, workflow) {
  const workflowEngine = interaction.client.engines.workflowEngine;

  try {
    // Update message with execution started
    const startEmbed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`⏳ Workflow Executing`)
      .setDescription(`Starting: **${workflow.name}**`)
      .addFields({
        name: 'Status',
        value: '🔄 Initializing...',
        inline: false,
      })
      .setTimestamp();

    await interaction.message.edit({
      embeds: [startEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('workflow-refresh')
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('workflow-cancel-execution')
            .setLabel('⛔ Cancel')
            .setStyle(ButtonStyle.Danger)
        ),
      ],
    });

    // Start workflow execution (async, don't wait)
    const execution = await workflowEngine.executeWorkflow(
      interaction.guildId,
      workflowId,
      {
        executorId: interaction.user.id,
        executorName: interaction.user.username,
        guildId: interaction.guildId,
        autoConfirm: true,
      }
    );

    // Send execution ID
    const idEmbed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('✅ Workflow Started')
      .setDescription(`**${workflow.name}** is now executing`)
      .addFields({
        name: 'Execution ID',
        value: `\`${execution.id}\``,
        inline: false,
      })
      .setTimestamp();

    await interaction.followUp({
      embeds: [idEmbed],
      ephemeral: false,
    });

    // Monitor execution (would be done in background)
    monitorWorkflowExecution(interaction, execution, workflowEngine, workflow);
  } catch (error) {
    Logger.error('Workflow execution error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('💥 Workflow Error')
      .setDescription(`Failed to start workflow: ${error.message}`)
      .setTimestamp();

    await interaction.message.edit({
      embeds: [errorEmbed],
      components: [],
    });
  }
}

/**
 * Monitor workflow execution progress
 */
async function monitorWorkflowExecution(interaction, execution, workflowEngine, workflow) {
  // This would be replaced with a proper job queue/worker
  // For now, simulate progress updates
  
  const progressInterval = setInterval(async () => {
    const currentExecution = workflowEngine.getCurrentWorkflowStatus(interaction.guildId);

    if (!currentExecution) {
      // Execution might be complete
      clearInterval(progressInterval);
      return;
    }

    const progressPercent = Math.round(
      (currentExecution.stepsCompleted.length / workflow.steps.length) * 100
    );

    const progressBar = createProgressBar(progressPercent);

    const progressEmbed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`⏳ ${workflow.name}`)
      .setDescription(`${progressBar}\n**Progress**: ${progressPercent}%`)
      .addFields({
        name: 'Current Step',
        value: workflow.steps[currentExecution.currentStepIndex]?.name || 'N/A',
        inline: true,
      },
      {
        name: 'Completed',
        value: `${currentExecution.stepsCompleted.length}/${workflow.steps.length}`,
        inline: true,
      })
      .setTimestamp();

    // Try to update the message (might fail if user deleted it)
    try {
      await interaction.message.edit({ embeds: [progressEmbed] });
    } catch (error) {
      clearInterval(progressInterval);
      return;
    }

    // Check if complete
    if (currentExecution.status === 'SUCCESS' || currentExecution.status === 'FAILED') {
      clearInterval(progressInterval);

      const finalEmbed = new EmbedBuilder()
        .setColor(currentExecution.status === 'SUCCESS' ? '#2ECC71' : '#E74C3C')
        .setTitle(`${currentExecution.status === 'SUCCESS' ? '✅' : '❌'} Workflow ${currentExecution.status}`)
        .setDescription(`**${workflow.name}** has ${currentExecution.status.toLowerCase()}`)
        .addFields({
          name: 'Duration',
          value: formatDuration(currentExecution.completedAt - currentExecution.startedAt),
          inline: true,
        },
        {
          name: 'Steps',
          value: `${currentExecution.stepsCompleted.length}/${workflow.steps.length}`,
          inline: true,
        })
        .setFooter({ text: `ID: ${currentExecution.id}` })
        .setTimestamp();

      await interaction.message.edit({ embeds: [finalEmbed], components: [] });
    }
  }, 5000); // Update every 5 seconds
}

/**
 * Handle /workflow status command
 */
async function handleWorkflowStatus(interaction) {
  await interaction.deferReply();

  const workflowEngine = interaction.client.engines.workflowEngine;
  if (!workflowEngine) {
    return interaction.editReply('❌ Workflow engine not initialized');
  }

  const executionId = interaction.options.getString('execution_id');
  const guildId = interaction.guildId;

  // Get current or historical execution
  let execution;

  if (executionId) {
    // Look in history
    const history = workflowEngine.getExecutionHistory(guildId, 100);
    execution = history.find(e => e.id === executionId);
  } else {
    // Get current running workflow
    execution = workflowEngine.getCurrentWorkflowStatus(guildId);
  }

  if (!execution) {
    return interaction.editReply('❌ No workflow execution found');
  }

  const workflow = workflowEngine.getWorkflow(execution.workflowId);

  const statusEmbed = new EmbedBuilder()
    .setColor(getStatusColor(execution.status))
    .setTitle(`${getStatusEmoji(execution.status)} Workflow Status`)
    .setDescription(`**${workflow.name}**`)
    .addFields(
      {
        name: 'Status',
        value: execution.status,
        inline: true,
      },
      {
        name: 'Progress',
        value: `${execution.stepsCompleted.length}/${workflow.steps.length}`,
        inline: true,
      },
      {
        name: 'Execution ID',
        value: `\`${execution.id}\``,
        inline: false,
      }
    )
    .setFooter({ text: `Started: ${execution.startedAt.toLocaleString()}` })
    .setTimestamp();

  // Add step details
  if (execution.stepsCompleted.length > 0) {
    const stepsList = execution.stepsCompleted
      .slice(-5)
      .map(s => `✅ ${s.stepName}`)
      .join('\n');

    statusEmbed.addFields({
      name: 'Completed Steps',
      value: stepsList,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [statusEmbed] });
}

/**
 * Handle /workflow history command
 */
async function handleWorkflowHistory(interaction) {
  await interaction.deferReply();

  const workflowEngine = interaction.client.engines.workflowEngine;
  if (!workflowEngine) {
    return interaction.editReply('❌ Workflow engine not initialized');
  }

  const limit = interaction.options.getInteger('limit') || 5;
  const history = workflowEngine.getExecutionHistory(interaction.guildId, limit);

  if (history.length === 0) {
    return interaction.editReply('❌ No workflow history found');
  }

  const historyEmbed = new EmbedBuilder()
    .setColor('#7289DA')
    .setTitle('📜 Workflow History')
    .setDescription(`Last ${history.length} executions`)
    .setFooter({ text: `Server: ${interaction.guildId}` })
    .setTimestamp();

  history.forEach((execution) => {
    const workflow = workflowEngine.getWorkflow(execution.workflowId);
    const duration = formatDuration(execution.completedAt - execution.startedAt);
    const status = execution.status === 'SUCCESS' ? '✅' : '❌';

    historyEmbed.addFields({
      name: `${status} ${workflow.name}`,
      value: `**Duration**: ${duration}\n**ID**: \`${execution.id}\``,
      inline: false,
    });
  });

  await interaction.editReply({ embeds: [historyEmbed] });
}

/**
 * Handle /workflow cancel command
 */
async function handleCancelWorkflow(interaction) {
  await interaction.deferReply();

  const confirmation = interaction.options.getString('confirmation');
  if (confirmation.toUpperCase() !== 'CANCEL') {
    return interaction.editReply('❌ Please type "CANCEL" to confirm');
  }

  const workflowEngine = interaction.client.engines.workflowEngine;
  if (!workflowEngine) {
    return interaction.editReply('❌ Workflow engine not initialized');
  }

  try {
    const execution = await workflowEngine.cancelWorkflow(interaction.guildId);

    const cancelEmbed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('⛔ Workflow Cancelled')
      .setDescription('The running workflow has been cancelled')
      .addFields({
        name: 'Execution ID',
        value: `\`${execution.id}\``,
        inline: false,
      },
      {
        name: 'Rolled Back Steps',
        value: `${execution.rollbackStack.length} step(s)`,
        inline: true,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [cancelEmbed] });
  } catch (error) {
    await interaction.editReply(`❌ Error: ${error.message}`);
  }
}

/**
 * Helper: Create progress bar
 */
function createProgressBar(percent) {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return `[${
'█'.repeat(filled)}${
'░'.repeat(empty)}] ${percent}%`;
}

/**
 * Helper: Estimate workflow time
 */
function estimateWorkflowTime(workflow) {
  const stepsTime = workflow.steps.length * 5; // ~5 seconds per step
  const confirmationTime = workflow.steps.filter(s => s.confirmRequired).length * 10;
  const totalSeconds = stepsTime + confirmationTime;

  if (totalSeconds < 60) return `~${totalSeconds}s`;
  return `~${Math.round(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

/**
 * Helper: Get impact level
 */
function getImpactLevel(workflow) {
  const criticalSteps = workflow.steps.filter(s => s.handler.includes('execute') || s.handler.includes('delete')).length;
  
  if (criticalSteps > 5) return '🔴 **High Impact**';
  if (criticalSteps > 2) return '🟠 **Medium Impact**';
  return '🟢 **Low Impact**';
}

/**
 * Helper: Format duration
 */
function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * Helper: Get status color
 */
function getStatusColor(status) {
  const colors = {
    CREATED: '#95A5A6',
    READY: '#3498DB',
    EXECUTING: '#F39C12',
    SUCCESS: '#2ECC71',
    FAILED: '#E74C3C',
    CANCELLED: '#95A5A6',
  };
  return colors[status] || '#95A5A6';
}

/**
 * Helper: Get status emoji
 */
function getStatusEmoji(status) {
  const emojis = {
    CREATED: '📝',
    READY: '✅',
    EXECUTING: '⏳',
    SUCCESS: '🎉',
    FAILED: '💥',
    CANCELLED: '⛔',
  };
  return emojis[status] || '❓';
}
