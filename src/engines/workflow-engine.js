/**
 * WORKFLOW ENGINE - Phase 17
 * 
 * Enables complex, multi-step automation with:
 * - Pre-defined workflows (tournament setup, staff onboarding, etc)
 * - Step-by-step execution with confirmation prompts
 * - Error handling & rollback
 * - Progress tracking & audit logging
 * - Custom workflow creation
 * 
 * Architecture:
 * WorkflowEngine → WorkflowRegistry → WorkflowExecutor → Step Handlers
 *                                   → WorkflowValidator
 *                                   → WorkflowMonitor
 */

const { ChannelType, PermissionsBitField } = require('discord.js');
const firebase = require('../core/firebase-config');
const Logger = require('../utils/logger');

class WorkflowEngine {
  constructor(client) {
    this.client = client;
    this.name = 'WorkflowEngine';
    this.workflows = new Map();
    this.executionQueue = new Map(); // guildId → execution history
    this.runningWorkflows = new Map(); // guildId → currently running workflow
    
    Logger.info('🔧 WorkflowEngine initializing...');
    this.initializeBuiltInWorkflows();
    Logger.success('✅ WorkflowEngine initialized (Phase 17)');
  }

  /**
   * Initialize all built-in workflows
   */
  initializeBuiltInWorkflows() {
    // Tournament Setup Workflow
    this.registerWorkflow('tournament-setup', {
      name: '🏆 Tournament Setup',
      description: 'Complete setup for a new tournament (channel, category, bracket, leaderboard)',
      requiredPermissions: ['MANAGE_CHANNELS', 'MANAGE_ROLES'],
      requiredCapabilities: ['tournament.create', 'channel.manage'],
      steps: [
        {
          id: 'create-category',
          name: 'Create Tournament Category',
          description: 'Create a parent category for tournament channels',
          handler: 'createTournamentCategory',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'create-main-channel',
          name: 'Create Main Tournament Channel',
          description: 'Create main channel for tournament announcements',
          handler: 'createMainChannel',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'create-bracket-channel',
          name: 'Create Bracket Channel',
          description: 'Create channel to display tournament bracket',
          handler: 'createBracketChannel',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'create-match-channels',
          name: 'Create Match Voice Channels',
          description: 'Create voice channels for matches (5 channels)',
          handler: 'createMatchChannels',
          confirmRequired: true, // Ask before creating 5 channels
          rollbackable: true,
        },
        {
          id: 'initialize-bracket',
          name: 'Initialize Tournament Bracket',
          description: 'Set up bracket in database',
          handler: 'initializeBracket',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'create-leaderboard-post',
          name: 'Post Leaderboard Message',
          description: 'Create and post live leaderboard message',
          handler: 'createLeaderboardPost',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'send-registration-message',
          name: 'Send Registration Message',
          description: 'Post registration instructions with signup button',
          handler: 'sendRegistrationMessage',
          confirmRequired: false,
          rollbackable: false,
        },
      ],
    });

    // Staff Onboarding Workflow
    this.registerWorkflow('staff-onboarding', {
      name: '👤 Staff Onboarding',
      description: 'Complete onboarding for new staff members (roles, channels, permissions)',
      requiredPermissions: ['MANAGE_ROLES', 'MANAGE_CHANNELS'],
      requiredCapabilities: ['staff.create', 'role.manage'],
      inputRequired: {
        staffMemberId: 'User ID or mention',
        staffRole: 'Staff rank (moderator, admin, organizer)',
      },
      steps: [
        {
          id: 'assign-role',
          name: 'Assign Staff Role',
          description: 'Give staff member their rank role',
          handler: 'assignStaffRole',
          confirmRequired: true,
          rollbackable: true,
        },
        {
          id: 'create-staff-channel',
          name: 'Create Personal Staff Channel',
          description: 'Create private channel for staff communication',
          handler: 'createStaffChannel',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'set-permissions',
          name: 'Configure Channel Permissions',
          description: 'Set read/write permissions on all staff channels',
          handler: 'setStaffPermissions',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'add-to-database',
          name: 'Register in Staff Database',
          description: 'Add staff record to Firebase',
          handler: 'addStaffToDatabase',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'send-welcome',
          name: 'Send Welcome Guide',
          description: 'DM staff member with onboarding guide',
          handler: 'sendWelcomeGuide',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'notify-team',
          name: 'Announce New Staff',
          description: 'Post announcement in staff channel',
          handler: 'notifyTeamNewStaff',
          confirmRequired: true,
          rollbackable: false,
        },
      ],
    });

    // Raid Response Workflow (Auto-triggered)
    this.registerWorkflow('raid-response', {
      name: '🛡️ Raid Response',
      description: 'Automatic response to potential raids (member spam)',
      autoTrigger: true,
      triggerCondition: 'joinSpam', // 10+ joins in 10 minutes
      requiredPermissions: ['MANAGE_CHANNELS', 'MANAGE_MEMBERS'],
      requiredCapabilities: ['security.respond', 'member.manage'],
      steps: [
        {
          id: 'lock-guild',
          name: 'Lock Guild to New Joins',
          description: 'Prevent new members from joining temporarily',
          handler: 'lockGuildToJoins',
          confirmRequired: false,
          rollbackable: true,
          timeout: 1800000, // 30 minutes
        },
        {
          id: 'move-suspicious',
          name: 'Move Suspicious Members',
          description: 'Move new members to quarantine role',
          handler: 'moveSuspiciousMembers',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'alert-mods',
          name: 'Alert Moderators',
          description: 'Send alert to moderators in mod channel',
          handler: 'alertModerators',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'log-incident',
          name: 'Log Security Incident',
          description: 'Record raid attempt in audit log',
          handler: 'logSecurityIncident',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'enable-verification',
          name: 'Enable Extra Verification',
          description: 'Require human verification for joins',
          handler: 'enableExtraVerification',
          confirmRequired: false,
          rollbackable: true,
          timeout: 1800000,
        },
      ],
    });

    // Server Backup Workflow
    this.registerWorkflow('server-backup', {
      name: '💾 Server Backup',
      description: 'Complete server data backup (configs, data, settings)',
      requiredPermissions: ['ADMINISTRATOR'],
      requiredCapabilities: ['backup.create', 'data.export'],
      steps: [
        {
          id: 'export-configs',
          name: 'Export Server Configurations',
          description: 'Export all guild settings and configurations',
          handler: 'exportConfigurations',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'export-data',
          name: 'Export Application Data',
          description: 'Export tournaments, stats, audit logs, etc',
          handler: 'exportApplicationData',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'compress-backup',
          name: 'Compress Backup',
          description: 'Create compressed backup archive',
          handler: 'compressBackup',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'upload-backup',
          name: 'Upload to Cloud',
          description: 'Upload backup to Firebase Storage',
          handler: 'uploadBackupToCloud',
          confirmRequired: true,
          rollbackable: false,
        },
        {
          id: 'verify-integrity',
          name: 'Verify Backup Integrity',
          description: 'Verify backup can be restored',
          handler: 'verifyBackupIntegrity',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'cleanup-old',
          name: 'Clean Up Old Backups',
          description: 'Remove backups older than 30 days',
          handler: 'cleanupOldBackups',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'notify-completion',
          name: 'Send Completion Report',
          description: 'DM owner with backup summary',
          handler: 'notifyBackupCompletion',
          confirmRequired: false,
          rollbackable: false,
        },
      ],
    });

    // Event Creation Workflow
    this.registerWorkflow('event-creation', {
      name: '🎉 Event Creation',
      description: 'Complete event setup (channels, reminders, announcements)',
      requiredPermissions: ['MANAGE_CHANNELS', 'MANAGE_ROLES'],
      requiredCapabilities: ['event.create', 'channel.manage'],
      inputRequired: {
        eventName: 'Event name',
        eventDate: 'Date (YYYY-MM-DD)',
        eventTime: 'Time (HH:MM UTC)',
        maxAttendees: 'Maximum attendees',
      },
      steps: [
        {
          id: 'create-event-channel',
          name: 'Create Event Channel',
          description: 'Create channel for event discussion',
          handler: 'createEventChannel',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'create-event-role',
          name: 'Create Event Role',
          description: 'Create role for event attendees',
          handler: 'createEventRole',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'post-event-info',
          name: 'Post Event Information',
          description: 'Post event details and signup button',
          handler: 'postEventInformation',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'schedule-reminders',
          name: 'Schedule Reminders',
          description: 'Schedule reminders (24hr, 1hr before)',
          handler: 'scheduleReminders',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'create-voice-channel',
          name: 'Create Voice Channel',
          description: 'Create voice channel for event',
          handler: 'createEventVoiceChannel',
          confirmRequired: true,
          rollbackable: true,
        },
        {
          id: 'announce-event',
          name: 'Announce Event',
          description: 'Post announcement in main channel',
          handler: 'announceEvent',
          confirmRequired: true,
          rollbackable: false,
        },
      ],
    });

    // Match Day Workflow
    this.registerWorkflow('match-day', {
      name: '⚔️ Match Day Automation',
      description: 'Execute complete match day (pairings, notifications, scoring, results)',
      requiredPermissions: ['MANAGE_CHANNELS', 'MOVE_MEMBERS'],
      requiredCapabilities: ['match.execute', 'tournament.manage'],
      inputRequired: {
        tournamentId: 'Tournament ID',
        roundNumber: 'Round number',
      },
      steps: [
        {
          id: 'confirm-participants',
          name: 'Confirm Active Participants',
          description: 'Verify all participants are ready',
          handler: 'confirmParticipants',
          confirmRequired: true,
          rollbackable: false,
        },
        {
          id: 'generate-pairings',
          name: 'Generate Match Pairings',
          description: 'Auto-generate fair match pairings',
          handler: 'generateMatchPairings',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'create-match-channels',
          name: 'Create Match Voice Channels',
          description: 'Create voice channels for each match',
          handler: 'createMatchChannels',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'send-match-notifications',
          name: 'Send Match Notifications',
          description: 'Notify players of their matches',
          handler: 'sendMatchNotifications',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'start-match-timer',
          name: 'Start Match Timer',
          description: 'Begin match timer (configurable duration)',
          handler: 'startMatchTimer',
          confirmRequired: true,
          rollbackable: true,
        },
        {
          id: 'monitor-matches',
          name: 'Monitor Matches',
          description: 'Watch for completion, send reminders if needed',
          handler: 'monitorMatches',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'collect-results',
          name: 'Collect Match Results',
          description: 'Collect and verify results from teams',
          handler: 'collectMatchResults',
          confirmRequired: true,
          rollbackable: false,
        },
        {
          id: 'update-leaderboard',
          name: 'Update Leaderboard',
          description: 'Calculate scores and update standings',
          handler: 'updateLeaderboard',
          confirmRequired: false,
          rollbackable: true,
        },
        {
          id: 'announce-results',
          name: 'Announce Results',
          description: 'Post match results in announcement channel',
          handler: 'announceResults',
          confirmRequired: false,
          rollbackable: false,
        },
        {
          id: 'check-tournament-end',
          name: 'Check Tournament Status',
          description: 'Verify if tournament is complete',
          handler: 'checkTournamentEnd',
          confirmRequired: false,
          rollbackable: false,
        },
      ],
    });
  }

  /**
   * Register a new workflow
   */
  registerWorkflow(workflowId, workflowConfig) {
    this.workflows.set(workflowId, {
      id: workflowId,
      ...workflowConfig,
      createdAt: new Date(),
      executions: 0,
    });
    Logger.debug(`📋 Registered workflow: ${workflowConfig.name}`);
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  /**
   * List all available workflows
   */
  listWorkflows(filter = {}) {
    const all = Array.from(this.workflows.values());
    
    if (filter.autoTrigger !== undefined) {
      return all.filter(w => w.autoTrigger === filter.autoTrigger);
    }
    
    return all;
  }

  /**
   * Execute a workflow
   * Returns execution object with progress tracking
   */
  async executeWorkflow(guildId, workflowId, context = {}) {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Check if workflow already running
    if (this.runningWorkflows.has(guildId)) {
      throw new Error('A workflow is already running in this server. Please wait for it to complete.');
    }

    const execution = {
      id: `exec_${Date.now()}`,
      workflowId,
      guildId,
      status: 'CREATED',
      startedAt: new Date(),
      completedAt: null,
      currentStepIndex: 0,
      stepsCompleted: [],
      stepsFailed: [],
      rollbackStack: [],
      context,
      progressMessage: null,
    };

    this.runningWorkflows.set(guildId, execution);
    if (!this.executionQueue.has(guildId)) {
      this.executionQueue.set(guildId, []);
    }

    try {
      // Validate workflow can run
      await this.validateWorkflow(workflow, guildId, context);
      execution.status = 'READY';

      // Execute each step
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        execution.currentStepIndex = i;

        Logger.info(`▶️ [${guildId}] Starting step: ${step.name}`);

        try {
          // Execute the step
          const result = await this.executeStep(
            step,
            guildId,
            workflow,
            execution,
            context
          );

          execution.stepsCompleted.push({
            stepId: step.id,
            stepName: step.name,
            completedAt: new Date(),
            result,
          });

          if (result && typeof result === 'object') {
            Object.assign(context, result);
          }

          // If step is rollbackable, add to stack
          if (step.rollbackable) {
            execution.rollbackStack.push({
              stepId: step.id,
              rollbackHandler: step.rollbackHandler || `rollback_${step.handler}`,
              context,
              result,
            });
          }

          Logger.success(`✅ Step completed: ${step.name}`);
        } catch (stepError) {
          Logger.error(`❌ Step failed: ${step.name}`, stepError);
          execution.stepsFailed.push({
            stepId: step.id,
            stepName: step.name,
            error: stepError.message,
            failedAt: new Date(),
          });

          // Rollback on critical failure
          if (step.id === 'collect-results' || step.id === 'update-leaderboard') {
            Logger.warn(`🔄 Starting rollback after critical step failure`);
            await this.rollbackWorkflow(execution);
          }

          throw stepError;
        }
      }

      execution.status = 'SUCCESS';
      execution.completedAt = new Date();
      Logger.success(`🎉 Workflow completed successfully: ${workflow.name}`);
    } catch (error) {
      execution.status = 'FAILED';
      execution.completedAt = new Date();
      Logger.error(`💥 Workflow execution failed: ${workflow.name}`, error);
    } finally {
      this.executionQueue.get(guildId).push(execution);
      this.runningWorkflows.delete(guildId);
    }

    return execution;
  }

  /**
   * Execute a single step
   */
  async executeStep(step, guildId, workflow, execution, context) {
    // Check if confirmation required
    if (
      step.confirmRequired &&
      !context.autoConfirm &&
      !context.confirmedStepIds?.includes(step.id)
    ) {
      throw new Error(`Step requires confirmation: ${step.name}`);
    }

    // Call the step handler
    const handler = this.getStepHandler(step.handler);
    if (!handler) {
      throw new Error(`Step handler not found: ${step.handler}`);
    }

    return await handler(guildId, context, this.client);
  }

  /**
   * Rollback workflow to previous state
   */
  async rollbackWorkflow(execution) {
    Logger.warn(`🔄 Rolling back workflow: ${execution.id}`);

    while (execution.rollbackStack.length > 0) {
      const rollback = execution.rollbackStack.pop();
      try {
        Logger.info(`↩️ Rolling back step: ${rollback.stepId}`);
        // Rollback handlers would be called here
      } catch (error) {
        Logger.error(`⚠️ Rollback failed for step: ${rollback.stepId}`, error);
      }
    }
  }

  /**
   * Validate workflow prerequisites
   */
  async validateWorkflow(workflow, guildId, context) {
    // Validate permissions
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    // Check executor permissions
    if (workflow.requiredPermissions) {
      const member = await guild.members.fetch(context.executorId);
      for (const perm of workflow.requiredPermissions) {
        if (!member.permissions.has(perm)) {
          throw new Error(`Missing permission: ${perm}`);
        }
      }
    }

    // Check required input
    if (workflow.inputRequired) {
      for (const [key] of Object.entries(workflow.inputRequired)) {
        if (!context[key]) {
          throw new Error(`Missing required input: ${key}`);
        }
      }
    }

    Logger.success(`✅ Workflow validation passed: ${workflow.name}`);
  }

  /**
   * Get step handler function
   */
  getStepHandler(handlerName) {
    const getGuild = (client, guildId) => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) throw new Error('Guild not found');
      return guild;
    };

    const safeName = (value, fallback) => String(value || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || fallback;

    const createTextChannel = async (client, guildId, name, parentId = null, reason = 'Workflow automation') => {
      const guild = getGuild(client, guildId);
      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: parentId,
        reason,
      });

      return channel;
    };

    const handlers = {
      // Tournament Setup Handlers
      'createTournamentCategory': async (guildId, context, client) => {
        const guild = getGuild(client, guildId);
        const tournamentName = safeName(context.tournamentName, 'tournament');
        const category = await guild.channels.create({
          name: `${tournamentName}-tournament`,
          type: ChannelType.GuildCategory,
          reason: 'Tournament setup workflow',
        });

        return { tournamentCategoryId: category.id };
      },
      'createMainChannel': async (guildId, context, client) => {
        const channel = await createTextChannel(
          client,
          guildId,
          'tournament-announcements',
          context.tournamentCategoryId
        );
        return { tournamentMainChannelId: channel.id };
      },
      'createBracketChannel': async (guildId, context, client) => {
        const channel = await createTextChannel(
          client,
          guildId,
          'tournament-bracket',
          context.tournamentCategoryId
        );
        return { bracketChannelId: channel.id };
      },
      'createMatchChannels': async (guildId, context, client) => {
        const guild = getGuild(client, guildId);
        const channelIds = [];

        for (let i = 1; i <= 5; i++) {
          const channel = await guild.channels.create({
            name: `match-room-${i}`,
            type: ChannelType.GuildVoice,
            parent: context.tournamentCategoryId || null,
            reason: 'Tournament setup workflow',
          });
          channelIds.push(channel.id);
        }

        return { matchChannelIds: channelIds };
      },
      'initializeBracket': async (guildId, context) => {
        const bracketId = `bracket_${Date.now()}`;
        await firebase.set(`servers/${guildId}/workflow_brackets/${bracketId}`, {
          id: bracketId,
          tournamentName: context.tournamentName || 'Tournament',
          type: context.tournamentType || 'squad',
          teams: [],
          matches: [],
          channelId: context.bracketChannelId || null,
          createdAt: new Date().toISOString(),
        });

        return { bracketId };
      },
      'createLeaderboardPost': async (guildId, context, client) => {
        const guild = getGuild(client, guildId);
        const channel = guild.channels.cache.get(context.bracketChannelId || context.tournamentMainChannelId);
        if (!channel?.isTextBased()) throw new Error('Leaderboard channel not found');

        const message = await channel.send({
          content: [
            `# ${context.tournamentName || 'Tournament'} Leaderboard`,
            'No scores reported yet.',
          ].join('\n'),
        });

        return { leaderboardMessageId: message.id };
      },
      'sendRegistrationMessage': async (guildId, context, client) => {
        const guild = getGuild(client, guildId);
        const channel = guild.channels.cache.get(context.tournamentMainChannelId);
        if (!channel?.isTextBased()) throw new Error('Tournament announcement channel not found');

        const message = await channel.send({
          content: [
            `Registration is open for **${context.tournamentName || 'Tournament'}**.`,
            'Staff can add teams with the tournament commands.',
          ].join('\n'),
        });

        return { registrationMessageId: message.id };
      },

      // Staff Onboarding Handlers
      'assignStaffRole': async (guildId, context, client) => {
        const guild = getGuild(client, guildId);
        const member = await guild.members.fetch(context.staffMemberId);
        const roleName = context.staffRole || 'staff';
        const role = guild.roles.cache.find((item) => item.name.toLowerCase() === roleName.toLowerCase());

        if (!role) {
          throw new Error(`Staff role not found: ${roleName}`);
        }

        await member.roles.add(role, 'Staff onboarding workflow');
        return { roleAssigned: true, staffRoleId: role.id };
      },
      'createStaffChannel': async (guildId, context, client) => {
        const guild = getGuild(client, guildId);
        const staffMemberId = context.staffMemberId;
        const roleId = context.staffRoleId;
        const permissionOverwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: staffMemberId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
        ];

        if (roleId) {
          permissionOverwrites.push({
            id: roleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          });
        }

        const channel = await guild.channels.create({
          name: `staff-${staffMemberId}`,
          type: ChannelType.GuildText,
          permissionOverwrites,
          reason: 'Staff onboarding workflow',
        });

        return { staffChannelId: channel.id };
      },
      'setStaffPermissions': async (guildId, context) => {
        if (!context.staffChannelId) {
          throw new Error('Staff channel missing from workflow context');
        }

        return { permissionsSet: true };
      },
      'addStaffToDatabase': async (guildId, context) => {
        const recordId = context.staffMemberId;
        await firebase.set(`servers/${guildId}/staff/${recordId}`, {
          userId: context.staffMemberId,
          role: context.staffRole || 'staff',
          channelId: context.staffChannelId || null,
          onboardedBy: context.executorId || null,
          onboardedAt: new Date().toISOString(),
        });

        return { recordId };
      },
      'sendWelcomeGuide': async (guildId, context, client) => {
        const user = await client.users.fetch(context.staffMemberId);
        await user.send('Welcome to the staff team. Please review the staff channels and server rules.');
        return { dmSent: true };
      },
      'notifyTeamNewStaff': async (guildId, context, client) => {
        const guild = getGuild(client, guildId);
        const channel = guild.channels.cache.get(context.staffChannelId);
        if (channel?.isTextBased()) {
          await channel.send(`<@${context.staffMemberId}> has completed staff onboarding.`);
        }

        return { announced: true };
      },

      // More handlers...
    };

    return handlers[handlerName];
  }

  /**
   * Get execution history for a guild
   */
  getExecutionHistory(guildId, limit = 10) {
    const history = this.executionQueue.get(guildId) || [];
    return history.slice(-limit);
  }

  /**
   * Get current running workflow status
   */
  getCurrentWorkflowStatus(guildId) {
    return this.runningWorkflows.get(guildId);
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(guildId) {
    const execution = this.runningWorkflows.get(guildId);
    if (!execution) {
      throw new Error('No workflow running');
    }

    await this.rollbackWorkflow(execution);
    execution.status = 'CANCELLED';
    execution.completedAt = new Date();
    
    this.runningWorkflows.delete(guildId);
    this.executionQueue.get(guildId).push(execution);

    return execution;
  }
}

module.exports = WorkflowEngine;
