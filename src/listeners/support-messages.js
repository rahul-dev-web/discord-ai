/**
 * SUPPORT MESSAGE LISTENER - Phase 14
 * Listens for messages in helpdesk channels
 * Auto-responds without requiring mentions
 */

const Logger = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    try {
      // Ignore bot messages and DMs
      if (message.author.bot || !message.guild) {
        return;
      }

      // Get engines
      const supportAI = client.engines?.supportAI;
      const smartDiscovery = client.engines?.discovery;
      const memory = client.engines?.memory;
      const commandDiscovery = client.engines?.commandDiscovery;

      if (!supportAI) {
        return; // Support AI not initialized
      }

      // Check if this is a helpdesk message
      const isHelpdesk = await supportAI.isHelpDeskChannel(
        message.guildId,
        message.channelId,
        smartDiscovery
      );

      if (!isHelpdesk) {
        return; // Not a helpdesk channel
      }

      // Show typing indicator
      try {
        await message.channel.sendTyping();
      } catch (e) {
        Logger.warn('Could not send typing indicator');
      }

      // Process the message through Support AI
      await supportAI.handleHelpDeskMessage(
        message,
        smartDiscovery,
        memory,
        commandDiscovery
      );
    } catch (error) {
      Logger.error('Support message listener error:', error);

      // Try to send error message
      try {
        if (message.replyable) {
          await message.reply({
            content: '❌ An error occurred while processing your message. Our team has been notified.',
            allowedMentions: { repliedUser: false },
          }).catch(() => {});
        }
      } catch (e) {
        Logger.error('Failed to send error message:', e);
      }
    }
  },
};
