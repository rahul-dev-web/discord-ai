/**
 * ADVANCED MEMORY SYSTEM - Phase 12
 * Server memory, conversation memory, and knowledge base
 * Persistent learning system for AI
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class MemorySystem {
  constructor(client, database) {
    this.client = client;
    this.db = database;
    this.conversationCache = new Map(); // Cache recent conversations
    this.memoryCache = new Map(); // Cache server memories
    this.maxConversationLength = 20; // Keep last 20 messages
  }

  /**
   * PHASE 12: Server Memory - Store rules and templates
   */
  async storeServerRule(guildId, ruleId, ruleContent, category = 'general') {
    try {
      const rule = {
        id: ruleId,
        content: ruleContent,
        category: category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'admin', // admin or auto-discovered
      };

      await firebase.set(`servers/${guildId}/server_memory/rules/${ruleId}`, rule);
      Logger.info(`💾 Rule stored: ${ruleId}`);
      return ruleId;
    } catch (error) {
      Logger.error('Failed to store server rule:', error);
      return null;
    }
  }

  /**
   * Store server template (tournament, event, etc)
   */
  async storeServerTemplate(guildId, templateId, templateData) {
    try {
      const template = {
        id: templateId,
        name: templateData.name,
        description: templateData.description,
        type: templateData.type, // tournament, event, workflow, etc
        content: templateData.content,
        createdAt: new Date().toISOString(),
        usageCount: 0,
      };

      await firebase.set(
        `servers/${guildId}/server_memory/templates/${templateId}`,
        template
      );

      Logger.info(`💾 Template stored: ${templateId}`);
      return templateId;
    } catch (error) {
      Logger.error('Failed to store template:', error);
      return null;
    }
  }

  /**
   * Store persistent server settings in memory
   */
  async storeServerMemory(guildId, key, value, category = 'settings') {
    try {
      const memory = {
        key: key,
        value: value,
        category: category,
        storedAt: new Date().toISOString(),
        importance: 1, // 1-10 scale
      };

      await firebase.set(
        `servers/${guildId}/server_memory/${category}/${key}`,
        memory
      );

      Logger.debug(`💾 Memory stored: ${category}/${key}`);
      return true;
    } catch (error) {
      Logger.error('Failed to store server memory:', error);
      return false;
    }
  }

  /**
   * PHASE 12: Conversation Memory - Save chat history
   */
  async saveConversation(guildId, channelId, userId, messages) {
    try {
      const conversationId = `${channelId}-${Date.now()}`;

      const conversation = {
        id: conversationId,
        guildId: guildId,
        channelId: channelId,
        userId: userId,
        messages: messages,
        startTime: new Date(Date.now() - messages.length * 1000).toISOString(),
        endTime: new Date().toISOString(),
        messageCount: messages.length,
        summarized: false,
      };

      await firebase.set(
        `servers/${guildId}/conversation_memory/${conversationId}`,
        conversation
      );

      // Cache it
      this.conversationCache.set(conversationId, conversation);

      Logger.debug(`💬 Conversation saved: ${conversationId}`);
      return conversationId;
    } catch (error) {
      Logger.error('Failed to save conversation:', error);
      return null;
    }
  }

  /**
   * Load conversation history
   */
  async getConversationHistory(guildId, channelId, limit = 10) {
    try {
      const conversations = await firebase.get(
        `servers/${guildId}/conversation_memory`
      );

      if (!conversations) return [];

      const filtered = Object.entries(conversations)
        .filter(([, conv]) => conv.channelId === channelId)
        .sort((a, b) => new Date(b[1].endTime) - new Date(a[1].endTime))
        .slice(0, limit)
        .map(([id, conv]) => conv);

      return filtered;
    } catch (error) {
      Logger.error('Failed to get conversation history:', error);
      return [];
    }
  }

  /**
   * PHASE 12: Knowledge Base - Store information
   */
  async addToKnowledgeBase(guildId, type, title, content) {
    try {
      const itemId = `${type}-${Date.now()}`;

      const item = {
        id: itemId,
        type: type, // tournament_history, org_knowledge, support_history, training
        title: title,
        content: content,
        createdAt: new Date().toISOString(),
        relevanceScore: 1, // Will increase with usage
        tags: this.extractTags(content),
      };

      await firebase.set(
        `servers/${guildId}/knowledge_base/${type}/${itemId}`,
        item
      );

      Logger.info(`📚 Knowledge added: ${type}/${title}`);
      return itemId;
    } catch (error) {
      Logger.error('Failed to add to knowledge base:', error);
      return null;
    }
  }

  /**
   * Search knowledge base (simple text search)
   */
  async searchKnowledgeBase(guildId, query) {
    try {
      const kb = await firebase.get(`servers/${guildId}/knowledge_base`);
      if (!kb) return [];

      const results = [];

      for (const [type, items] of Object.entries(kb)) {
        if (typeof items !== 'object') continue;

        for (const [, item] of Object.entries(items)) {
          // Score based on matches
          let score = 0;

          if (item.title?.toLowerCase().includes(query.toLowerCase())) {
            score += 10;
          }

          if (item.content?.toLowerCase().includes(query.toLowerCase())) {
            score += 5;
          }

          if (item.tags?.some((tag) => tag.includes(query.toLowerCase()))) {
            score += 3;
          }

          if (score > 0) {
            results.push({
              ...item,
              matchScore: score,
            });
          }
        }
      }

      // Sort by score
      return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);
    } catch (error) {
      Logger.error('Knowledge base search failed:', error);
      return [];
    }
  }

  /**
   * Extract tags from content
   */
  extractTags(content) {
    try {
      // Extract hashtags
      const hashtags = content.match(/#\w+/g) || [];

      // Extract key phrases (words 4+ letters)
      const words = content
        .split(/\s+/)
        .filter((w) => w.length >= 4)
        .map((w) => w.toLowerCase());

      return [...new Set([...hashtags, ...words])].slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  /**
   * PHASE 12: Summarize old conversations
   */
  async summarizeConversation(conversationId, guildId) {
    try {
      const conversation = await firebase.get(
        `servers/${guildId}/conversation_memory/${conversationId}`
      );

      if (!conversation || conversation.summarized) {
        return null;
      }

      // Use AI to summarize
      const messageTexts = conversation.messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const summaryPrompt = `Summarize this conversation in 2-3 sentences:
      
${messageTexts}`;

      const aiEngine = this.client.engines.ai;
      const summary = await aiEngine.callGroqAPI(
        [{ role: 'user', content: summaryPrompt }],
        'You are a helpful AI that summarizes conversations.'
      );

      if (summary) {
        conversation.summarized = true;
        conversation.summary = summary;
        conversation.summarizedAt = new Date().toISOString();

        await firebase.update(
          `servers/${guildId}/conversation_memory/${conversationId}`,
          {
            summarized: true,
            summary: summary,
            summarizedAt: conversation.summarizedAt,
          }
        );

        // Reduce storage by archiving full messages
        conversation.messagesArchived = true;

        Logger.info(`📝 Conversation summarized: ${conversationId}`);
        return summary;
      }

      return null;
    } catch (error) {
      Logger.error('Conversation summarization failed:', error);
      return null;
    }
  }

  /**
   * Get memory importance score
   */
  calculateImportanceScore(item) {
    let score = 1; // Base score

    // Increase if recently used
    const daysSinceCreation =
      (Date.now() - new Date(item.createdAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 7) {
      score += 3; // Recent = more important
    }

    // Increase if frequently accessed
    if (item.accessCount) {
      score += Math.min(item.accessCount / 10, 3);
    }

    // Increase if high relevance
    if (item.relevanceScore) {
      score += item.relevanceScore;
    }

    return Math.min(score, 10); // Cap at 10
  }

  /**
   * Auto-cleanup old memories
   */
  async cleanupOldMemories(guildId, daysOld = 30) {
    try {
      Logger.info(`🧹 Cleaning up memories older than ${daysOld} days...`);

      const conversations = await firebase.get(
        `servers/${guildId}/conversation_memory`
      );

      if (!conversations) return 0;

      let cleaned = 0;
      const cutoffDate = Date.now() - daysOld * 24 * 60 * 60 * 1000;

      for (const [id, conv] of Object.entries(conversations)) {
        const createdTime = new Date(conv.startTime).getTime();

        if (createdTime < cutoffDate) {
          // Archive instead of delete
          await firebase.set(
            `servers/${guildId}/conversation_archive/${id}`,
            {
              ...conv,
              archivedAt: new Date().toISOString(),
            }
          );

          // Delete from active
          await firebase.remove(
            `servers/${guildId}/conversation_memory/${id}`
          );

          cleaned++;
        }
      }

      Logger.success(`🧹 Cleaned up ${cleaned} old conversations`);
      return cleaned;
    } catch (error) {
      Logger.error('Memory cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Get relevant memory for AI context
   */
  async getRelevantMemory(guildId, query, context = {}) {
    try {
      const relevant = {
        rules: [],
        templates: [],
        knowledge: [],
        recentConversations: [],
      };

      // Get matching rules
      const rules = await firebase.get(`servers/${guildId}/server_memory/rules`);
      if (rules && typeof rules === 'object') {
        relevant.rules = Object.values(rules).slice(0, 3);
      }

      // Get matching templates
      const templates = await firebase.get(
        `servers/${guildId}/server_memory/templates`
      );
      if (templates && typeof templates === 'object') {
        relevant.templates = Object.values(templates).slice(0, 2);
      }

      // Search knowledge base
      if (query) {
        relevant.knowledge = await this.searchKnowledgeBase(guildId, query);
      }

      // Get recent conversations
      if (context.channelId) {
        relevant.recentConversations = await this.getConversationHistory(
          guildId,
          context.channelId,
          3
        );
      }

      return relevant;
    } catch (error) {
      Logger.error('Failed to get relevant memory:', error);
      return {
        rules: [],
        templates: [],
        knowledge: [],
        recentConversations: [],
      };
    }
  }

  /**
   * Rebuild memory index (for semantic search later)
   */
  async rebuildMemoryIndex(guildId) {
    try {
      Logger.info(`🔄 Rebuilding memory index for ${guildId}...`);

      const index = {
        rules: [],
        templates: [],
        knowledge: [],
        conversations: [],
      };

      // Index all rules
      const rules = await firebase.get(`servers/${guildId}/server_memory/rules`);
      if (rules) {
        index.rules = Object.keys(rules);
      }

      // Index all templates
      const templates = await firebase.get(
        `servers/${guildId}/server_memory/templates`
      );
      if (templates) {
        index.templates = Object.keys(templates);
      }

      // Index knowledge
      const kb = await firebase.get(`servers/${guildId}/knowledge_base`);
      if (kb) {
        for (const [type, items] of Object.entries(kb)) {
          if (typeof items === 'object') {
            index.knowledge.push({ type, ids: Object.keys(items) });
          }
        }
      }

      // Save index
      await firebase.set(
        `servers/${guildId}/server_memory/index`,
        index
      );

      Logger.success(`✅ Memory index rebuilt`);
      return index;
    } catch (error) {
      Logger.error('Memory index rebuild failed:', error);
      return null;
    }
  }

  /**
   * Export memory for backup
   */
  async exportMemory(guildId) {
    try {
      Logger.info(`📤 Exporting memory for ${guildId}...`);

      const memory = {
        guildId: guildId,
        exportedAt: new Date().toISOString(),
        data: {
          rules: await firebase.get(`servers/${guildId}/server_memory/rules`),
          templates: await firebase.get(
            `servers/${guildId}/server_memory/templates`
          ),
          knowledge: await firebase.get(`servers/${guildId}/knowledge_base`),
          conversations: await firebase.get(
            `servers/${guildId}/conversation_memory`
          ),
        },
      };

      Logger.success(`✅ Memory exported`);
      return memory;
    } catch (error) {
      Logger.error('Memory export failed:', error);
      return null;
    }
  }

  /**
   * Import memory from backup
   */
  async importMemory(guildId, memoryData) {
    try {
      Logger.info(`📥 Importing memory for ${guildId}...`);

      if (memoryData.data.rules) {
        for (const [id, rule] of Object.entries(memoryData.data.rules)) {
          await firebase.set(
            `servers/${guildId}/server_memory/rules/${id}`,
            rule
          );
        }
      }

      if (memoryData.data.templates) {
        for (const [id, template] of Object.entries(memoryData.data.templates)) {
          await firebase.set(
            `servers/${guildId}/server_memory/templates/${id}`,
            template
          );
        }
      }

      if (memoryData.data.knowledge) {
        for (const [type, items] of Object.entries(memoryData.data.knowledge)) {
          for (const [id, item] of Object.entries(items)) {
            await firebase.set(
              `servers/${guildId}/knowledge_base/${type}/${id}`,
              item
            );
          }
        }
      }

      Logger.success(`✅ Memory imported successfully`);
      return true;
    } catch (error) {
      Logger.error('Memory import failed:', error);
      return false;
    }
  }
}

module.exports = MemorySystem;
