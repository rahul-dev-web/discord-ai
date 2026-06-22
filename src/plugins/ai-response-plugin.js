/**
 * AI RESPONSE PLUGIN
 * Generates intelligent responses using Groq LLM
 * Responds to messages in supported channels
 */

const BasePlugin = require('./base-plugin');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class AIResponsePlugin extends BasePlugin {
  constructor(client) {
    super(client);
    this.name = 'AIResponse';
    this.version = '1.0.0';
    this.description = 'AI-powered response generator';
  }

  /**
   * Handle message
   */
  async onMessage(message) {
    if (!this.enabled) return;

    // Ignore bot messages
    if (message.author.bot) return;

    // Check if bot is mentioned or in AI channel
    const isMationed = message.mentions.has(this.client.user);
    const config = await this.client.configManager.getServerConfig(message.guildId);
    const isAIChannel = message.channelId === config?.channels?.ai;

    if (!isMationed && !isAIChannel) return;

    try {
      // Show typing indicator
      await message.channel.sendTyping();

      // Get context
      const context = await this.client.engines.context.getServerContext(message.guildId);

      // Generate response
      const response = await this.client.engines.ai.generateResponse(message, context);

      if (!response) {
        await message.reply('❌ I encountered an error while processing your message.');
        return;
      }

      // Split message if too long
      if (response.length > 2000) {
        const chunks = response.match(/[\s\S]{1,2000}/g);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(response);
      }

      // Save conversation
      await this.client.engines.ai.saveConversation(
        message.guildId,
        message.channelId,
        message.author.id,
        [
          { role: 'user', content: message.content },
          { role: 'assistant', content: response },
        ]
      );

    } catch (error) {
      Logger.error(`${this.name} error:`, error);
      await message.reply('❌ An error occurred while processing your message.');
    }
  }
}

module.exports = AIResponsePlugin;
