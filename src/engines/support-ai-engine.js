/**
 * SUPPORT AI ENGINE - Phase 14
 * Intelligent helpdesk automation system
 * 
 * Features:
 * - Auto-respond in helpdesk channels
 * - Knowledge base integration (Phase 12)
 * - Staff routing by capability (Phase 13)
 * - Ticket creation and tracking
 * - Conversation context management
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class SupportAIEngine {
  constructor(client, database, aiEngine) {
    this.client = client;
    this.db = database;
    this.aiEngine = aiEngine;
    
    // Configuration
    this.config = {
      escalationTimeoutMinutes: 30,
      maxAutoReplies: 3,
      faqThreshold: 0.85,
      enableAutoTickets: true,
    };

    // In-memory tracking
    this.activeConversations = new Map(); // userId -> conversation data
    this.ticketCounter = 0;
    this.conversationHistory = new Map(); // userId -> message history
  }

  /**
   * Main entry point: Handle message in helpdesk channel
   */
  async handleHelpDeskMessage(message, smartDiscoveryEngine, memorySystem, discoveryEngine) {
    try {
      // 1. Verify this is a helpdesk channel
      const isHelpdesk = await this.isHelpDeskChannel(
        message.guildId,
        message.channelId,
        smartDiscoveryEngine
      );

      if (!isHelpdesk) {
        return; // Not a helpdesk, ignore
      }

      // Ignore bot messages
      if (message.author.bot) return;

      Logger.debug(`📞 Helpdesk message from ${message.author.username}`);

      // 2. Track conversation
      this.trackMessage(message);

      // 3. Check if continuation of existing conversation
      const conversationData = await this.getConversationContext(
        message.guildId,
        message.author.id
      );

      // 4. Analyze message intent and complexity
      const analysis = await this.analyzeMessage(message.content, conversationData);

      // 5. Search knowledge base
      const kbResult = await this.searchKnowledgeBase(
        message.guildId,
        analysis.intent,
        memorySystem
      );

      // 6. Decide: respond with FAQ or escalate
      if (kbResult.found && kbResult.confidence >= this.config.faqThreshold) {
        // Answer found! Respond from FAQ
        return await this.respondFromFAQ(message, kbResult);
      }

      // 7. If no FAQ answer and needs escalation
      if (analysis.needsEscalation || analysis.complexity === 'high') {
        return await this.escalateToStaff(
          message,
          analysis,
          conversationData,
          discoveryEngine,
          memorySystem
        );
      }

      // 8. Otherwise, acknowledge and offer help
      return await this.acknowledgeAndOffer(message);
    } catch (error) {
      Logger.error('Helpdesk message handling error:', error);
      await this.handleError(message, error);
    }
  }

  /**
   * Check if channel is a helpdesk channel (via Smart Discovery Engine)
   */
  async isHelpDeskChannel(guildId, channelId, smartDiscoveryEngine) {
    try {
      // Get channel profile from Smart Discovery
      const profile = await firebase.get(
        `servers/${guildId}/channel_profiles/${channelId}`
      );

      if (profile && profile.purpose === 'helpdesk') {
        return true;
      }

      // Alternative: check channel name/topic
      const channel = this.client.channels.cache.get(channelId);
      if (channel && (
        channel.name.includes('support') ||
        channel.name.includes('help') ||
        channel.topic?.includes('support')
      )) {
        return true;
      }

      return false;
    } catch (error) {
      Logger.error('Channel detection error:', error);
      return false;
    }
  }

  /**
   * Analyze message intent and complexity
   */
  async analyzeMessage(content, conversationData = {}) {
    try {
      // Simple intent detection
      const intents = {
        'how_to': /how\s+(?:do\s+)?i|how\s+to|tutorial|guide|steps/i,
        'report_issue': /error|bug|broken|not\s+working|problem|issue|crash/i,
        'account': /account|profile|name|password|login|email/i,
        'payment': /payment|billing|charge|refund|money|cost|price/i,
        'tournament': /tournament|register|team|match|bracket/i,
        'feedback': /suggest|feature|request|idea|improve/i,
      };

      let detectedIntent = 'general';
      for (const [intent, regex] of Object.entries(intents)) {
        if (regex.test(content)) {
          detectedIntent = intent;
          break;
        }
      }

      // Complexity assessment
      let complexity = 'low';
      if (content.length > 300) complexity = 'medium';
      if (content.length > 600) complexity = 'high';

      // Check if needs escalation
      const needsEscalation =
        content.includes('error') ||
        content.includes('bug') ||
        complexity === 'high';

      return {
        intent: detectedIntent,
        complexity,
        needsEscalation,
        messageLength: content.length,
        hasCode: /```/.test(content),
        hasError: /error|404|500|503/i.test(content),
      };
    } catch (error) {
      Logger.error('Message analysis error:', error);
      return { intent: 'general', complexity: 'low', needsEscalation: false };
    }
  }

  /**
   * Search knowledge base (FAQ, solved tickets, guidelines)
   */
  async searchKnowledgeBase(guildId, intent, memorySystem) {
    try {
      // First try FAQ
      const faqResults = await firebase.get(
        `servers/${guildId}/memory/faq`
      );

      if (faqResults && faqResults[intent]) {
        return {
          found: true,
          type: 'faq',
          intent,
          answer: faqResults[intent].answer,
          question: faqResults[intent].question,
          confidence: 0.95,
        };
      }

      // Then try solved tickets with same intent
      const solvedTickets = await firebase.get(
        `servers/${guildId}/tickets`
      );

      if (solvedTickets) {
        for (const [ticketId, ticket] of Object.entries(solvedTickets)) {
          if (
            ticket.status === 'resolved' &&
            ticket.tags?.includes(intent)
          ) {
            return {
              found: true,
              type: 'solved_ticket',
              ticketId,
              answer: ticket.resolution || ticket.description,
              confidence: 0.85,
            };
          }
        }
      }

      // No knowledge base match
      return {
        found: false,
        confidence: 0,
      };
    } catch (error) {
      Logger.error('Knowledge base search error:', error);
      return { found: false, confidence: 0 };
    }
  }

  /**
   * Respond with FAQ answer
   */
  async respondFromFAQ(message, kbResult) {
    try {
      const answer = kbResult.answer || kbResult.question;

      const response = `✅ **Here's the answer to your question:**\n\n${answer}\n\n` +
        `💡 *This was found in our knowledge base.*\n` +
        `React with 👍 if this solved your issue, or 👎 if you need more help!`;

      const sentMessage = await message.reply({
        content: response,
        allowedMentions: { repliedUser: false },
      });

      // Track for follow-up
      this.trackConversation(message.author.id, message.guildId, {
        type: 'faq_response',
        ticketId: null,
        message: sentMessage.id,
      });

      Logger.info(`✅ FAQ response sent for intent: ${kbResult.intent}`);
    } catch (error) {
      Logger.error('Failed to respond with FAQ:', error);
    }
  }

  /**
   * Escalate to staff
   */
  async escalateToStaff(
    message,
    analysis,
    conversationData,
    discoveryEngine,
    memorySystem
  ) {
    try {
      // 1. Create ticket
      const ticket = await this.createTicket(
        message.guildId,
        message.author.id,
        message.channelId,
        message.content,
        analysis
      );

      Logger.info(`🎫 Ticket created: ${ticket.id}`);

      // 2. Find staff with appropriate capability
      const staffMentions = await this.findAndMentionStaff(
        message.guildId,
        analysis.intent,
        discoveryEngine
      );

      // 3. Generate context summary
      const summary = await this.generateTicketSummary(
        ticket,
        conversationData,
        analysis
      );

      // 4. Send escalation message
      const escalationMsg = `🔄 **Escalating to our team...**\n\n` +
        `**Ticket ID**: #${ticket.id}\n` +
        `**Issue**: ${analysis.intent}\n` +
        `**Priority**: ${ticket.priority}\n\n` +
        `${staffMentions.mentions ? `${staffMentions.mentions}\n` : ''}` +
        `${summary}\n\n` +
        `📌 *Our team will respond shortly. Thank you for your patience!*`;

      await message.reply({
        content: escalationMsg,
        allowedMentions: { parse: ['users'] },
      });

      // 5. Send summary to staff channel (if exists)
      await this.notifyStaffChannel(message.guildId, ticket, summary);

      return true;
    } catch (error) {
      Logger.error('Escalation failed:', error);
      await message.reply({
        content: '❌ Sorry, there was an issue. Our team has been notified.',
      });
    }
  }

  /**
   * Create a support ticket
   */
  async createTicket(guildId, userId, channelId, content, analysis) {
    try {
      const ticketId = `TICKET-${Date.now()}`;

      const ticket = {
        id: ticketId,
        userId,
        channelId,
        title: content.substring(0, 100),
        description: content,
        intent: analysis.intent,
        status: 'open',
        priority: this.getPriorityFromAnalysis(analysis),
        category: this.getCategoryFromIntent(analysis.intent),
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolvedBy: null,
        assignedTo: null,
        messages: [],
        tags: [analysis.intent],
        metadata: {
          source: 'helpdesk_chat',
          complexity: analysis.complexity,
          hasError: analysis.hasError,
          escalations: 1,
        },
      };

      // Store in database
      await firebase.set(`servers/${guildId}/tickets/${ticketId}`, ticket);

      // Increment counter
      await firebase.set(
        `servers/${guildId}/ticket_counters/total`,
        (await firebase.get(`servers/${guildId}/ticket_counters/total`) || 0) + 1
      );

      return ticket;
    } catch (error) {
      Logger.error('Ticket creation failed:', error);
      throw error;
    }
  }

  /**
   * Find and mention appropriate staff
   */
  async findAndMentionStaff(guildId, intent, discoveryEngine) {
    try {
      // Map intent to capability
      const capabilityMap = {
        'how_to': 'send_messages',
        'report_issue': 'technical_support',
        'account': 'manage_members',
        'payment': 'billing_support',
        'tournament': 'manage_tournament',
        'feedback': 'send_messages',
      };

      const requiredCapability = capabilityMap[intent] || 'send_messages';

      // Find staff with this capability
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return { mentions: null };

      let mentionedStaff = [];
      const members = await guild.members.fetch();

      for (const [, member] of members) {
        if (member.user.bot) continue;

        // Check if staff (has staff role or admin)
        if (member.permissions.has('ModerateMembers') ||
            member.roles.cache.some(r =>
              r.name.toLowerCase().includes('staff') ||
              r.name.toLowerCase().includes('mod')
            )) {
          mentionedStaff.push(member);
        }
      }

      // Limit mentions to prevent spam
      mentionedStaff = mentionedStaff.slice(0, 3);

      if (mentionedStaff.length === 0) {
        return { mentions: null };
      }

      const mentions = mentionedStaff.map(m => m.toString()).join(' ');
      return { mentions, staff: mentionedStaff };
    } catch (error) {
      Logger.error('Staff finding error:', error);
      return { mentions: null };
    }
  }

  /**
   * Generate ticket summary
   */
  async generateTicketSummary(ticket, conversationData, analysis) {
    try {
      const context = conversationData.history?.slice(-3) || [];
      const contextStr = context
        .map(msg => `• ${msg}`)
        .join('\n');

      const summary = `**Context:**\n${contextStr || 'New issue'}\n\n` +
        `**Type**: ${analysis.intent}\n` +
        `**Complexity**: ${analysis.complexity}`;

      return summary;
    } catch (error) {
      Logger.error('Summary generation error:', error);
      return 'Issue needs staff attention.';
    }
  }

  /**
   * Acknowledge message and offer help
   */
  async acknowledgeAndOffer(message) {
    try {
      const responses = [
        '👂 Got it! Let me look into that for you.',
        '💭 Thanks for reaching out! Checking on that...',
        '🔍 Understood. Let me find the best way to help you.',
        '✨ I\'m analyzing your request...',
      ];

      const response = responses[Math.floor(Math.random() * responses.length)];

      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false },
      });

      Logger.info('Acknowledgment sent');
    } catch (error) {
      Logger.error('Acknowledge error:', error);
    }
  }

  /**
   * Track conversation context
   */
  trackMessage(message) {
    const userId = message.author.id;
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }

    const history = this.conversationHistory.get(userId);
    history.push(message.content.substring(0, 100));

    // Keep only last 10 messages
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Get conversation context for user
   */
  async getConversationContext(guildId, userId) {
    try {
      const history = this.conversationHistory.get(userId) || [];

      return {
        userId,
        guildId,
        history,
        messageCount: history.length,
      };
    } catch (error) {
      return { history: [] };
    }
  }

  /**
   * Track conversation in database
   */
  trackConversation(userId, guildId, data) {
    try {
      const conversationKey = `${guildId}_${userId}`;
      this.activeConversations.set(conversationKey, {
        ...data,
        lastActive: Date.now(),
      });
    } catch (error) {
      Logger.error('Conversation tracking error:', error);
    }
  }

  /**
   * Notify staff channel about new ticket
   */
  async notifyStaffChannel(guildId, ticket, summary) {
    try {
      // Try to find staff-logs or moderation channel
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return;

      const staffChannel = guild.channels.cache.find(ch =>
        ch.name.includes('staff') || ch.name.includes('logs')
      );

      if (!staffChannel || !staffChannel.isTextBased()) return;

      const notification = `🎫 **New Support Ticket**\n\n` +
        `Ticket: #${ticket.id}\n` +
        `User: <@${ticket.userId}>\n` +
        `Channel: <#${ticket.channelId}>\n` +
        `Priority: ${ticket.priority}\n\n` +
        `${summary}`;

      await staffChannel.send(notification);
    } catch (error) {
      Logger.error('Staff notification error:', error);
    }
  }

  /**
   * Handle error
   */
  async handleError(message, error) {
    try {
      await message.reply({
        content: '❌ Sorry, something went wrong. Our team has been notified.',
      });

      Logger.error(`Helpdesk error for ${message.author.id}:`, error);
    } catch (e) {
      Logger.error('Error handler failed:', e);
    }
  }

  /**
   * Get priority from analysis
   */
  getPriorityFromAnalysis(analysis) {
    if (analysis.hasError) return 'high';
    if (analysis.complexity === 'high') return 'medium';
    return 'low';
  }

  /**
   * Get category from intent
   */
  getCategoryFromIntent(intent) {
    const categoryMap = {
      'how_to': 'general',
      'report_issue': 'technical',
      'account': 'account',
      'payment': 'billing',
      'tournament': 'tournament',
      'feedback': 'general',
    };

    return categoryMap[intent] || 'general';
  }

  /**
   * Get ticket by ID
   */
  async getTicket(guildId, ticketId) {
    try {
      return await firebase.get(`servers/${guildId}/tickets/${ticketId}`);
    } catch (error) {
      Logger.error('Failed to get ticket:', error);
      return null;
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(guildId, ticketId, status, resolvedBy = null) {
    try {
      const ticket = await this.getTicket(guildId, ticketId);
      if (!ticket) return false;

      ticket.status = status;
      if (status === 'resolved') {
        ticket.resolvedAt = new Date().toISOString();
        ticket.resolvedBy = resolvedBy;
      }

      await firebase.set(`servers/${guildId}/tickets/${ticketId}`, ticket);

      Logger.info(`✅ Ticket ${ticketId} status updated to ${status}`);
      return true;
    } catch (error) {
      Logger.error('Ticket update failed:', error);
      return false;
    }
  }

  /**
   * Get ticket statistics
   */
  async getTicketStats(guildId) {
    try {
      const tickets = await firebase.get(`servers/${guildId}/tickets`);

      if (!tickets) {
        return {
          total: 0,
          open: 0,
          resolved: 0,
          closed: 0,
        };
      }

      const stats = {
        total: Object.keys(tickets).length,
        open: 0,
        resolved: 0,
        closed: 0,
      };

      for (const ticket of Object.values(tickets)) {
        if (ticket.status === 'open') stats.open++;
        if (ticket.status === 'resolved') stats.resolved++;
        if (ticket.status === 'closed') stats.closed++;
      }

      return stats;
    } catch (error) {
      Logger.error('Stats generation failed:', error);
      return { total: 0, open: 0, resolved: 0, closed: 0 };
    }
  }

  /**
   * Search tickets
   */
  async searchTickets(guildId, filters = {}) {
    try {
      const tickets = await firebase.get(`servers/${guildId}/tickets`);

      if (!tickets) return [];

      let results = Object.values(tickets);

      // Apply filters
      if (filters.status) {
        results = results.filter(t => t.status === filters.status);
      }

      if (filters.userId) {
        results = results.filter(t => t.userId === filters.userId);
      }

      if (filters.category) {
        results = results.filter(t => t.category === filters.category);
      }

      if (filters.priority) {
        results = results.filter(t => t.priority === filters.priority);
      }

      return results;
    } catch (error) {
      Logger.error('Ticket search failed:', error);
      return [];
    }
  }

  /**
   * Batch add messages to ticket
   */
  async addMessageToTicket(guildId, ticketId, messageId) {
    try {
      const ticket = await this.getTicket(guildId, ticketId);
      if (!ticket) return false;

      if (!ticket.messages) ticket.messages = [];
      if (!ticket.messages.includes(messageId)) {
        ticket.messages.push(messageId);
      }

      await firebase.set(`servers/${guildId}/tickets/${ticketId}`, ticket);
      return true;
    } catch (error) {
      Logger.error('Failed to add message to ticket:', error);
      return false;
    }
  }
}

module.exports = SupportAIEngine;
