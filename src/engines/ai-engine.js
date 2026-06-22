/**
 * AI ENGINE
 * Integrates Groq LLM for intelligent decision making
 * Uses context, permissions, and capabilities to reason about actions
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class AIEngine {
  constructor(client, database) {
    this.client = client;
    this.db = database;
    this.apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'; // Free tier Groq model

    if (!this.apiKey) {
      Logger.error('GROQ_API_KEY not found in environment variables!');
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
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
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

  /**
   * Generate bot response to user message
   */
  async generateResponse(message, context) {
    try {
      const guild = message.guild;
      const user = message.author;

      // Build context for AI
      const systemPrompt = `You are IGL Esports Discord Bot Assistant, helping manage an esports community.
      
Your role:
- Help users with tournament management
- Answer questions about server features
- Assist with team operations
- Provide support to community members

Server: ${guild.name}
User: ${user.username}
Channel: ${message.channel.name}

Respond helpfully but concisely. Use Discord formatting if needed.`;

      const userMessages = [
        { role: 'user', content: message.content },
      ];

      const response = await this.callGroqAPI(userMessages, systemPrompt);
      return response;
    } catch (error) {
      Logger.error('Failed to generate response:', error);
      return '❌ I encountered an error while processing your request.';
    }
  }

  /**
   * Plan a complex action
   */
  async planAction(actionName, context, capabilities) {
    try {
      const systemPrompt = `You are an AI planning agent for Discord server automation.
      
Action: ${actionName}
Available Capabilities: ${capabilities.join(', ')}
Server Context: ${JSON.stringify(context, null, 2)}

Create a step-by-step plan to accomplish this action.
Return ONLY a JSON object with:
{
  "steps": [
    {"name": "step name", "description": "what to do", "capability": "required capability"},
    ...
  ],
  "risks": ["risk 1", "risk 2"],
  "estimatedTime": "duration"
}`;

      const userMessages = [
        { role: 'user', content: `Plan this action: ${actionName}` },
      ];

      const response = await this.callGroqAPI(userMessages, systemPrompt);
      
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        Logger.warn('Failed to parse AI plan as JSON:', e);
      }

      return { steps: [], risks: [], estimatedTime: 'unknown' };
    } catch (error) {
      Logger.error('Failed to plan action:', error);
      return { steps: [], risks: [], estimatedTime: 'unknown' };
    }
  }

  /**
   * Generate documentation for capabilities
   */
  async generateDocumentation(memberCapabilities, roleName) {
    try {
      const systemPrompt = `You are a helpful Discord bot assistant documenting available commands.
      
Create clear, beginner-friendly documentation for the following capabilities:
${memberCapabilities.join('\n')}

Role: ${roleName}

Format as a friendly guide with examples where relevant.`;

      const userMessages = [
        { role: 'user', content: `Create documentation for ${roleName} role capabilities.` },
      ];

      const response = await this.callGroqAPI(userMessages, systemPrompt);
      return response;
    } catch (error) {
      Logger.error('Failed to generate documentation:', error);
      return 'Unable to generate documentation at this time.';
    }
  }

  /**
   * Analyze sentiment and intent
   */
  async analyzeIntent(userMessage) {
    try {
      const systemPrompt = `Analyze the user's message and determine:
1. Intent: what they want to do
2. Sentiment: positive, neutral, or negative
3. Confidence: how confident you are (0-1)
4. RequiredCapabilities: what the bot needs to help

Return ONLY JSON with these fields.`;

      const userMessages = [
        { role: 'user', content: userMessage },
      ];

      const response = await this.callGroqAPI(userMessages, systemPrompt);

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        Logger.warn('Failed to parse intent analysis:', e);
      }

      return {
        intent: 'unknown',
        sentiment: 'neutral',
        confidence: 0,
        requiredCapabilities: [],
      };
    } catch (error) {
      Logger.error('Failed to analyze intent:', error);
      return {
        intent: 'error',
        sentiment: 'neutral',
        confidence: 0,
        requiredCapabilities: [],
      };
    }
  }

  /**
   * Generate tournament setup workflow
   */
  async generateTournamentPlan(tournamentType, participantCount) {
    try {
      const systemPrompt = `You are an expert at organizing esports tournaments.
      
Tournament Type: ${tournamentType}
Participants: ${participantCount}

Create a detailed setup plan with Discord channel structure and roles needed.
Return ONLY JSON with this structure:
{
  "channels": ["channel names to create"],
  "roles": ["role names to create"],
  "steps": ["setup steps in order"],
  "estimatedTime": "time needed"
}`;

      const userMessages = [
        { role: 'user', content: `Plan a ${tournamentType} tournament for ${participantCount} players.` },
      ];

      const response = await this.callGroqAPI(userMessages, systemPrompt);

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        Logger.warn('Failed to parse tournament plan:', e);
      }

      return {
        channels: [],
        roles: [],
        steps: [],
        estimatedTime: 'unknown',
      };
    } catch (error) {
      Logger.error('Failed to generate tournament plan:', error);
      return {
        channels: [],
        roles: [],
        steps: [],
        estimatedTime: 'unknown',
      };
    }
  }

  /**
   * Answer FAQ questions
   */
  async answerFAQ(question, knowledgeBase) {
    try {
      const systemPrompt = `You are a helpful support agent for IGL Esports Discord server.
      
Knowledge Base:
${JSON.stringify(knowledgeBase, null, 2)}

Answer the user's question using the knowledge base.
If the answer isn't in the knowledge base, be honest about it.`;

      const userMessages = [
        { role: 'user', content: question },
      ];

      const response = await this.callGroqAPI(userMessages, systemPrompt);
      return response;
    } catch (error) {
      Logger.error('Failed to answer FAQ:', error);
      return 'I\'m not sure how to answer that. Please ask a server admin for help.';
    }
  }

  /**
   * Save conversation for memory
   */
  async saveConversation(guildId, channelId, userId, messages) {
    try {
      const conversation = {
        guildId,
        channelId,
        userId,
        messages,
        savedAt: new Date().toISOString(),
      };

      const conversationId = await firebase.push(
        `servers/${guildId}/conversations`,
        conversation
      );

      return conversationId;
    } catch (error) {
      Logger.error('Failed to save conversation:', error);
      return null;
    }
  }

  /**
   * Load conversation history
   */
  async loadConversationHistory(guildId, channelId, limit = 10) {
    try {
      const conversations = await firebase.get(`servers/${guildId}/conversations`);
      if (!conversations) return [];

      const filtered = Object.entries(conversations)
        .filter(([, conv]) => conv.channelId === channelId)
        .sort((a, b) => new Date(b[1].savedAt) - new Date(a[1].savedAt))
        .slice(0, limit)
        .map(([id, conv]) => conv);

      return filtered;
    } catch (error) {
      Logger.error('Failed to load conversation history:', error);
      return [];
    }
  }
}

module.exports = AIEngine;
