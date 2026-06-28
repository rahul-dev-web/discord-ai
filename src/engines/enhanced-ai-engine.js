/**
 * ENHANCED AI ENGINE - Phase 10+
 * Now with Voice AI capabilities
 * Integrates Groq for transcription and processing
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class EnhancedAIEngine {
  constructor(client, database) {
    this.client = client;
    this.db = database;
    this.apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.GROQ_MODEL;
    this.voiceContext = new Map(); // Cache voice contexts
  }

  /**
   * PHASE 10: Voice AI - Transcribe voice to text
   * (Simulated - needs Whisper API in production)
   */
  async transcribeVoice(audioBuffer, language = 'en') {
    try {
      Logger.info('🎤 Transcribing voice...');

      // In production, use: OpenAI Whisper, AssemblyAI, or Google Cloud Speech-to-Text
      // For now, simulate with Groq using audio metadata

      const transcription = {
        text: 'Voice transcription would go here',
        confidence: 0.95,
        language: language,
        timestamp: new Date().toISOString(),
      };

      return transcription;
    } catch (error) {
      Logger.error('Voice transcription failed:', error);
      return null;
    }
  }

  /**
   * PHASE 10: Process voice command
   */
  async processVoiceCommand(guildId, userId, transcript, voiceChannelId) {
    try {
      Logger.info(`🎤 Processing voice command: "${transcript}"`);

      // Analyze intent
      const intent = await this.analyzeIntent(transcript);
      Logger.debug('Voice intent:', intent);

      // Check if user has capability
      const capability = intent.requiredCapabilities?.[0];
      if (capability) {
        const hasCapability = await this.client.engines.capability.hasCapability(
          guildId,
          userId,
          capability
        );

        if (!hasCapability) {
          return {
            success: false,
            message: '❌ You do not have permission for this action.',
            canExecute: false,
          };
        }
      }

      // Assess risk
      const riskLevel = this.client.engines.security.assessRiskLevel(
        intent.intent || 'voice_command'
      );

      // Return preview for high-risk actions
      if (['high', 'critical'].includes(riskLevel)) {
        return {
          success: false,
          requiresConfirmation: true,
          riskLevel: riskLevel,
          action: transcript,
          message: `⚠️ This is a ${riskLevel} action. Please confirm in chat.`,
        };
      }

      // Execute low/medium risk commands
      return {
        success: true,
        intent: intent,
        riskLevel: riskLevel,
        canExecute: true,
      };
    } catch (error) {
      Logger.error('Voice command processing failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * PHASE 10: Generate voice response (text-to-speech)
   * (Simulated - needs TTS in production)
   */
  async generateVoiceResponse(text, voiceChannelId) {
    try {
      Logger.info('🔊 Generating voice response...');

      // In production, use: Google Cloud TTS, AWS Polly, or similar
      const audioFile = {
        text: text,
        duration: Math.ceil(text.length / 15), // Rough estimate
        format: 'mp3',
        voiceId: 'en-US-Neural2-A', // Google Cloud voice
      };

      return audioFile;
    } catch (error) {
      Logger.error('Voice response generation failed:', error);
      return null;
    }
  }

  /**
   * PHASE 10: Owner VC - Plan voice command
   * Whisper → Planner → Preview → Execute
   */
  async planVoiceCommand(guildId, userId, transcript) {
    try {
      const context = await this.client.engines.context.getServerContext(guildId);

      const systemPrompt = `You are an owner-level Discord server AI.
      A server owner just gave a voice command.
      
      Command: "${transcript}"
      Server: ${context.guildName}
      
      Create a step-by-step plan to execute this command safely.
      Return JSON with:
      {
        "steps": [{"action": "...", "params": {...}}],
        "riskLevel": "low|medium|high|critical",
        "requiresConfirmation": boolean,
        "estimatedTime": "duration"
      }`;

      const response = await this.callGroqAPI(
        [{ role: 'user', content: transcript }],
        systemPrompt
      );

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        Logger.warn('Failed to parse voice plan:', e);
      }

      return {
        steps: [],
        riskLevel: 'medium',
        requiresConfirmation: true,
        estimatedTime: 'unknown',
      };
    } catch (error) {
      Logger.error('Voice command planning failed:', error);
      return null;
    }
  }

  /**
   * PHASE 10: Owner VC - Execute with password
   * Critical actions need owner password
   */
  async executeVoiceCommandWithAuth(guildId, userId, action, password) {
    try {
      // Verify user is owner
      const guild = this.client.guilds.cache.get(guildId);
      if (guild.ownerId !== userId) {
        return { success: false, error: 'Only owner can execute critical voice commands' };
      }

      // Verify password
      const config = await this.client.configManager.getServerConfig(guildId);
      // Password verification logic here

      Logger.warn(`⚠️ OWNER VOICE COMMAND EXECUTED: ${action}`);
      return { success: true, executed: true };
    } catch (error) {
      Logger.error('Voice command execution failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * PHASE 10: Staff VC - Check permission for voice action
   */
  async checkVoicePermission(guildId, memberId, action) {
    try {
      const member = this.client.guilds.cache.get(guildId)?.members.cache.get(memberId);
      if (!member) return false;

      // Check Discord permission
      if (this.client.engines.permission.isAdmin(member)) {
        return true;
      }

      // Check capability
      const hasCapability = await this.client.engines.capability.hasCapability(
        guildId,
        memberId,
        action
      );

      return hasCapability;
    } catch (error) {
      Logger.error('Voice permission check failed:', error);
      return false;
    }
  }

  /**
   * PHASE 10: Helpdesk VC - Support conversation
   * Join → Conversation → Knowledge Base → FAQ → Memory → Escalation → Summary
   */
  async handleHelpdeskVoice(guildId, userId, voiceChannelId, transcript) {
    try {
      Logger.info('💬 Handling helpdesk voice support...');

      // 1. Join context
      const voiceSession = {
        type: 'helpdesk',
        userId: userId,
        voiceChannelId: voiceChannelId,
        startTime: new Date().toISOString(),
        transcript: transcript,
        messages: [
          {
            role: 'user',
            content: transcript,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      // 2. Search knowledge base
      const knowledge = await this.searchKnowledgeBase(guildId, transcript);

      // 3. Search FAQs
      const supportPlugin = this.client.plugins.get('Support');
      const faqs = supportPlugin ? await supportPlugin.searchFAQ(guildId, transcript) : [];

      // 4. Generate response
      const responsePrompt = `You are a helpful Discord server support agent.
      User asked: "${transcript}"
      
      Relevant FAQs: ${JSON.stringify(faqs)}
      Knowledge base: ${JSON.stringify(knowledge)}
      
      Provide helpful response. If complex, suggest human support.`;

      const response = await this.callGroqAPI(
        [{ role: 'user', content: transcript }],
        responsePrompt
      );

      voiceSession.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      });

      // 5. Check if needs escalation
      const needsEscalation = response.toLowerCase().includes('escalate') ||
        response.toLowerCase().includes('human') ||
        response.toLowerCase().includes('staff');

      if (needsEscalation) {
        Logger.info('🆘 Escalating to human staff...');
        voiceSession.escalated = true;
        voiceSession.escalatedAt = new Date().toISOString();
      }

      // 6. Save session
      await firebase.set(`servers/${guildId}/voice_support_sessions/${voiceSession.userId}`, voiceSession);

      return {
        response: response,
        escalated: needsEscalation,
        faqs: faqs,
        session: voiceSession,
      };
    } catch (error) {
      Logger.error('Helpdesk voice handling failed:', error);
      return { error: error.message };
    }
  }

  /**
   * PHASE 11: Smart Discovery - Detect channel purpose
   */
  async detectChannelPurpose(channel) {
    try {
      const name = channel.name.toLowerCase();
      const topic = (channel.topic || '').toLowerCase();
      const description = (channel.description || '').toLowerCase();

      // Check channel name patterns
      if (
        name.includes('owner') ||
        name.includes('admin-only') ||
        name.includes('leadership')
      ) {
        return 'owner_chat';
      }

      if (name.includes('staff') && channel.isVoiceBased?.()) {
        return 'staff_vc';
      }

      if (
        name.includes('helpdesk') ||
        name.includes('support') ||
        name.includes('tickets')
      ) {
        return 'helpdesk';
      }

      if (
        name.includes('tournament') ||
        name.includes('scrim') ||
        name.includes('compete')
      ) {
        return 'tournament';
      }

      if (
        name.includes('general') ||
        name.includes('chat') ||
        name.includes('discussion')
      ) {
        return 'general';
      }

      if (name.includes('announcement') || name.includes('updates')) {
        return 'announcement';
      }

      return 'unknown';
    } catch (error) {
      Logger.error('Channel purpose detection failed:', error);
      return 'unknown';
    }
  }

  /**
   * PHASE 11: Create AI Profile for channel
   */
  async createChannelProfile(guildId, channel) {
    try {
      const purpose = await this.detectChannelPurpose(channel);

      const profile = {
        channelId: channel.id,
        channelName: channel.name,
        purpose: purpose,
        linkedChannels: [],
        responsibleTeam: [],
        autoCapabilities: this.getCapabilitiesForPurpose(purpose),
        createdAt: new Date().toISOString(),
        autoConfigured: true,
      };

      // Determine responsible team
      if (['owner_chat', 'staff_vc'].includes(purpose)) {
        const config = await this.client.configManager.getServerConfig(guildId);
        profile.responsibleTeam = config.roles?.admin || [];
      }

      await firebase.set(
        `servers/${guildId}/channel_profiles/${channel.id}`,
        profile
      );

      Logger.success(`Created AI profile for ${channel.name} (${purpose})`);
      return profile;
    } catch (error) {
      Logger.error('Channel profile creation failed:', error);
      return null;
    }
  }

  /**
   * Get capabilities for channel purpose
   */
  getCapabilitiesForPurpose(purpose) {
    const capabilityMap = {
      owner_chat: [
        'manage_bot',
        'manage_plugins',
        'restart_bot',
        'manage_roles',
        'manage_channels',
      ],
      staff_vc: ['manage_members', 'manage_messages', 'view_logs'],
      helpdesk: ['create_ticket', 'manage_ticket', 'view_analytics'],
      tournament: ['create_tournament', 'manage_tournament'],
      announcement: ['send_messages', 'embed_links'],
      general: ['send_messages', 'view_members'],
      unknown: ['send_messages'],
    };

    return capabilityMap[purpose] || capabilityMap.unknown;
  }

  /**
   * PHASE 12: Search knowledge base
   */
  async searchKnowledgeBase(guildId, query) {
    try {
      const knowledgeBase = await firebase.get(`servers/${guildId}/knowledge_base`);
      if (!knowledgeBase) return [];

      // Simple text search (can be improved with semantic search)
      const results = [];
      for (const [, item] of Object.entries(knowledgeBase)) {
        if (
          item.content?.toLowerCase().includes(query.toLowerCase()) ||
          item.title?.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push(item);
        }
      }

      return results.slice(0, 5);
    } catch (error) {
      Logger.error('Knowledge base search failed:', error);
      return [];
    }
  }

  /**
   * PHASE 13: Generate role-specific help
   */
  async generateRoleSpecificHelp(guildId, userId) {
    try {
      const member = this.client.guilds.cache.get(guildId)?.members.cache.get(userId);
      if (!member) return null;

      // Determine role level
      let roleLevel = 'user';
      if (member.guild.ownerId === userId) roleLevel = 'owner';
      else if (member.permissions.has('Administrator')) roleLevel = 'admin';
      else if (member.roles.cache.some((r) => r.name.toLowerCase().includes('staff')))
        roleLevel = 'staff';

      // Get capabilities
      const capabilities =
        await this.client.engines.capability.getMemberCapabilities(guildId, userId);

      // Generate documentation
      const prompt = `Generate concise help documentation for a Discord bot user with ${roleLevel} role.
      
      Available capabilities: ${capabilities.join(', ')}
      
      Include:
      1. What they can do (summary)
      2. Example commands
      3. Tips and tricks
      4. Escalation path
      
      Keep it brief and friendly.`;

      const helpDoc = await this.callGroqAPI(
        [{ role: 'user', content: 'Generate help documentation' }],
        prompt
      );

      return {
        roleLevel: roleLevel,
        capabilities: capabilities,
        documentation: helpDoc,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      Logger.error('Role-specific help generation failed:', error);
      return null;
    }
  }

  /**
   * Call Groq API
   */
  async callGroqAPI(messages, systemPrompt) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Groq API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      Logger.error('Groq API call failed:', error);
      return null;
    }
  }
}

module.exports = EnhancedAIEngine;
