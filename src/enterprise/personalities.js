/**
 * PHASE 19 - AI PERSONALITY SYSTEM
 * Custom AI Training & Configuration
 * 
 * Features:
 * - Custom personality creation
 * - Training data management
 * - Fine-tuning
 * - Multi-language support
 * - System prompt generation
 */

const Logger = require('../utils/logger');

class AIPersonalitySystem {
  constructor(firebaseDb) {
    this.db = firebaseDb;
    this.personalities = new Map();
    this.trainingData = new Map();
    this.initializeDefaultPersonalities();
  }

  /**
   * Initialize default personalities
   */
  initializeDefaultPersonalities() {
    const defaults = [
      {
        id: 'professional',
        name: 'Professional',
        description: 'Formal, business-like tone for corporate environments',
        tone: 'formal',
        style: 'business',
        language: 'en',
        systemPrompt: 'You are a professional AI assistant. Be formal, concise, and business-focused.',
        examples: [],
        isDefault: true,
      },
      {
        id: 'friendly',
        name: 'Friendly',
        description: 'Casual and approachable tone for community servers',
        tone: 'casual',
        style: 'conversational',
        language: 'en',
        systemPrompt: 'You are a friendly AI assistant. Be approachable, warm, and conversational.',
        examples: [],
        isDefault: true,
      },
      {
        id: 'technical',
        name: 'Technical',
        description: 'Precise and detailed for technical support',
        tone: 'precise',
        style: 'technical',
        language: 'en',
        systemPrompt: 'You are a technical AI assistant. Be precise, detailed, and solution-focused.',
        examples: [],
        isDefault: true,
      },
      {
        id: 'creative',
        name: 'Creative',
        description: 'Imaginative and expressive for creative communities',
        tone: 'playful',
        style: 'creative',
        language: 'en',
        systemPrompt: 'You are a creative AI assistant. Be imaginative, expressive, and inspiring.',
        examples: [],
        isDefault: true,
      },
    ];

    defaults.forEach(personality => {
      this.personalities.set(personality.id, personality);
    });

    Logger.info('✅ Default AI personalities initialized');
  }

  /**
   * Create custom personality
   */
  async createPersonality(guildId, config) {
    try {
      const personality = {
        id: `personality_${Date.now()}`,
        guildId,
        name: config.name,
        description: config.description || '',
        tone: config.tone,
        style: config.style,
        language: config.language || 'en',
        systemPrompt: config.systemPrompt || this.buildSystemPrompt(config),
        trainingData: config.trainingData || [],
        examples: config.examples || [],
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 500,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDefault: false,
      };

      this.personalities.set(personality.id, personality);
      await this.db.ref(`servers/${guildId}/personalities/${personality.id}`).set(personality);

      Logger.success(`✨ Custom personality created: ${personality.name}`);
      return personality;
    } catch (error) {
      Logger.error('Error creating personality:', error);
      throw error;
    }
  }

  /**
   * Build system prompt from config
   */
  buildSystemPrompt(config) {
    const basePrompts = {
      'professional': 'You are a professional assistant. Be formal and business-focused.',
      'friendly': 'You are a friendly assistant. Be warm and approachable.',
      'technical': 'You are a technical expert. Be precise and detailed.',
      'creative': 'You are a creative partner. Be imaginative and inspiring.',
    };

    let prompt = basePrompts[config.style] || 'You are a helpful assistant.';

    if (config.tone) {
      prompt += ` Maintain a ${config.tone} tone.`;
    }

    if (config.language !== 'en') {
      prompt += ` Respond primarily in ${config.language}.`;
    }

    return prompt;
  }

  /**
   * Add training example
   */
  async addTrainingExample(personalityId, example) {
    try {
      const personality = this.personalities.get(personalityId);
      if (!personality) {
        throw new Error('Personality not found');
      }

      const trainingExample = {
        id: `example_${Date.now()}`,
        input: example.input,
        output: example.output,
        category: example.category || 'general',
        createdAt: new Date().toISOString(),
      };

      personality.examples.push(trainingExample);
      personality.updatedAt = new Date().toISOString();

      this.personalities.set(personalityId, personality);

      Logger.info(`📚 Training example added to ${personality.name}`);
      return trainingExample;
    } catch (error) {
      Logger.error('Error adding training example:', error);
      throw error;
    }
  }

  /**
   * Add training data (bulk)
   */
  async addTrainingData(personalityId, dataArray) {
    try {
      const personality = this.personalities.get(personalityId);
      if (!personality) {
        throw new Error('Personality not found');
      }

      const processed = dataArray.map((item, index) => ({
        id: `data_${Date.now()}_${index}`,
        ...item,
        createdAt: new Date().toISOString(),
      }));

      personality.trainingData.push(...processed);
      personality.updatedAt = new Date().toISOString();

      this.personalities.set(personalityId, personality);

      Logger.info(`📊 ${dataArray.length} training data added to ${personality.name}`);
      return processed;
    } catch (error) {
      Logger.error('Error adding training data:', error);
      throw error;
    }
  }

  /**
   * Adjust AI parameters
   */
  async adjustParameters(personalityId, params) {
    try {
      const personality = this.personalities.get(personalityId);
      if (!personality) {
        throw new Error('Personality not found');
      }

      const updated = {
        ...personality,
        temperature: params.temperature !== undefined ? params.temperature : personality.temperature,
        maxTokens: params.maxTokens !== undefined ? params.maxTokens : personality.maxTokens,
        topP: params.topP !== undefined ? params.topP : personality.topP,
        frequencyPenalty: params.frequencyPenalty !== undefined ? params.frequencyPenalty : personality.frequencyPenalty,
        presencePenalty: params.presencePenalty !== undefined ? params.presencePenalty : personality.presencePenalty,
        updatedAt: new Date().toISOString(),
      };

      this.personalities.set(personalityId, updated);

      Logger.info(`⚙️ Parameters adjusted for ${personality.name}`);
      return updated;
    } catch (error) {
      Logger.error('Error adjusting parameters:', error);
      throw error;
    }
  }

  /**
   * Get personality
   */
  async getPersonality(personalityId) {
    try {
      return this.personalities.get(personalityId);
    } catch (error) {
      Logger.error('Error fetching personality:', error);
      throw error;
    }
  }

  /**
   * Get server personalities
   */
  async getServerPersonalities(guildId) {
    try {
      const personalities = Array.from(this.personalities.values())
        .filter(p => p.guildId === guildId || p.isDefault);
      return personalities;
    } catch (error) {
      Logger.error('Error fetching personalities:', error);
      throw error;
    }
  }

  /**
   * Get default personalities
   */
  getDefaultPersonalities() {
    return Array.from(this.personalities.values())
      .filter(p => p.isDefault);
  }

  /**
   * Delete custom personality
   */
  async deletePersonality(personalityId) {
    try {
      const personality = this.personalities.get(personalityId);
      if (personality.isDefault) {
        throw new Error('Cannot delete default personality');
      }

      this.personalities.delete(personalityId);

      Logger.info(`🗑️ Personality deleted: ${personality.name}`);
    } catch (error) {
      Logger.error('Error deleting personality:', error);
      throw error;
    }
  }

  /**
   * Duplicate personality (for customization)
   */
  async duplicatePersonality(personalityId, guildId, newName) {
    try {
      const original = this.personalities.get(personalityId);
      if (!original) {
        throw new Error('Personality not found');
      }

      const duplicate = {
        ...original,
        id: `personality_${Date.now()}`,
        guildId,
        name: newName,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.personalities.set(duplicate.id, duplicate);

      Logger.info(`📋 Personality duplicated: ${newName}`);
      return duplicate;
    } catch (error) {
      Logger.error('Error duplicating personality:', error);
      throw error;
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'hi'];
  }
}

module.exports = AIPersonalitySystem;
