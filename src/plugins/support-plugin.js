/**
 * SUPPORT PLUGIN
 * Manages support tickets and helpdesk
 */

const BasePlugin = require('./base-plugin');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class SupportPlugin extends BasePlugin {
  constructor(client) {
    super(client);
    this.name = 'Support';
    this.version = '1.0.0';
    this.description = 'Support ticket and helpdesk system';
  }

  /**
   * Create support ticket
   */
  async createTicket(guildId, userId, subject, description) {
    try {
      const ticket = {
        guildId,
        userId,
        subject,
        description,
        status: 'open',
        priority: 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            userId,
            content: description,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const ticketId = await firebase.push(`servers/${guildId}/support_tickets`, ticket);
      Logger.info(`Created support ticket: ${ticketId}`);
      return ticketId;
    } catch (error) {
      Logger.error('Failed to create ticket:', error);
      return null;
    }
  }

  /**
   * Get ticket
   */
  async getTicket(guildId, ticketId) {
    try {
      return await firebase.get(`servers/${guildId}/support_tickets/${ticketId}`);
    } catch (error) {
      Logger.error('Failed to get ticket:', error);
      return null;
    }
  }

  /**
   * Add message to ticket
   */
  async addTicketMessage(guildId, ticketId, userId, content) {
    try {
      const ticket = await this.getTicket(guildId, ticketId);
      if (!ticket) return false;

      ticket.messages.push({
        userId,
        content,
        timestamp: new Date().toISOString(),
      });

      ticket.updatedAt = new Date().toISOString();

      await firebase.update(`servers/${guildId}/support_tickets/${ticketId}`, ticket);
      return true;
    } catch (error) {
      Logger.error('Failed to add ticket message:', error);
      return false;
    }
  }

  /**
   * Close ticket
   */
  async closeTicket(guildId, ticketId) {
    try {
      return await firebase.update(`servers/${guildId}/support_tickets/${ticketId}`, {
        status: 'closed',
        closedAt: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Failed to close ticket:', error);
      return false;
    }
  }

  /**
   * Get all open tickets
   */
  async getOpenTickets(guildId) {
    try {
      const tickets = await firebase.get(`servers/${guildId}/support_tickets`);
      if (!tickets) return [];

      return Object.entries(tickets)
        .filter(([, ticket]) => ticket.status === 'open')
        .map(([id, ticket]) => ({ id, ...ticket }));
    } catch (error) {
      Logger.error('Failed to get open tickets:', error);
      return [];
    }
  }

  /**
   * Add FAQ
   */
  async addFAQ(guildId, question, answer) {
    try {
      return await firebase.push(`servers/${guildId}/faqs`, {
        question,
        answer,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('Failed to add FAQ:', error);
      return null;
    }
  }

  /**
   * Get FAQs
   */
  async getFAQs(guildId) {
    try {
      return await firebase.get(`servers/${guildId}/faqs`);
    } catch (error) {
      Logger.error('Failed to get FAQs:', error);
      return [];
    }
  }

  /**
   * Search FAQ
   */
  async searchFAQ(guildId, query) {
    try {
      const faqs = await this.getFAQs(guildId);
      if (!faqs) return [];

      return Object.entries(faqs)
        .filter(([, faq]) =>
          faq.question.toLowerCase().includes(query.toLowerCase()) ||
          faq.answer.toLowerCase().includes(query.toLowerCase())
        )
        .map(([id, faq]) => ({ id, ...faq }));
    } catch (error) {
      Logger.error('Failed to search FAQs:', error);
      return [];
    }
  }
}

module.exports = SupportPlugin;
