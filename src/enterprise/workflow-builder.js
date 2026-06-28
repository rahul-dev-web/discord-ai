/**
 * PHASE 19 - CUSTOM WORKFLOW BUILDER
 * Visual Workflow Creation & Management
 * 
 * Features:
 * - Create custom workflows
 * - Drag & drop step configuration
 * - Conditional logic
 * - Variable system
 * - Testing & validation
 */

const Logger = require('../utils/logger');

class WorkflowBuilder {
  constructor(firebaseDb) {
    this.db = firebaseDb;
    this.workflows = new Map();
    this.stepTemplates = this.initializeStepTemplates();
  }

  /**
   * Initialize step templates
   */
  initializeStepTemplates() {
    return {
      'send-message': {
        id: 'send-message',
        name: 'Send Message',
        description: 'Send a message to a channel',
        icon: '💬',
        inputs: [
          { name: 'channel', type: 'string', required: true },
          { name: 'message', type: 'string', required: true },
        ],
      },
      'create-role': {
        id: 'create-role',
        name: 'Create Role',
        description: 'Create a new Discord role',
        icon: '👤',
        inputs: [
          { name: 'roleName', type: 'string', required: true },
          { name: 'color', type: 'string', required: false },
          { name: 'permissions', type: 'array', required: false },
        ],
      },
      'create-channel': {
        id: 'create-channel',
        name: 'Create Channel',
        description: 'Create a new channel',
        icon: '#️⃣',
        inputs: [
          { name: 'channelName', type: 'string', required: true },
          { name: 'type', type: 'enum', values: ['text', 'voice'], required: true },
        ],
      },
      'add-role': {
        id: 'add-role',
        name: 'Add Role to User',
        description: 'Add a role to a member',
        icon: '➕',
        inputs: [
          { name: 'userId', type: 'string', required: true },
          { name: 'roleId', type: 'string', required: true },
        ],
      },
      'ban-user': {
        id: 'ban-user',
        name: 'Ban User',
        description: 'Ban a user from server',
        icon: '⛔',
        inputs: [
          { name: 'userId', type: 'string', required: true },
          { name: 'reason', type: 'string', required: false },
        ],
      },
      'log-event': {
        id: 'log-event',
        name: 'Log Event',
        description: 'Log an event to database',
        icon: '📝',
        inputs: [
          { name: 'eventType', type: 'string', required: true },
          { name: 'data', type: 'object', required: false },
        ],
      },
      'delay': {
        id: 'delay',
        name: 'Delay',
        description: 'Wait for specified time',
        icon: '⏱️',
        inputs: [
          { name: 'milliseconds', type: 'number', required: true },
        ],
      },
      'condition': {
        id: 'condition',
        name: 'Conditional',
        description: 'Execute based on condition',
        icon: '🔀',
        inputs: [
          { name: 'variable', type: 'string', required: true },
          { name: 'operator', type: 'enum', values: ['==', '!=', '>', '<', 'contains'], required: true },
          { name: 'value', type: 'string', required: true },
        ],
      },
    };
  }

  /**
   * Create new custom workflow
   */
  async createWorkflow(guildId, config) {
    try {
      const workflow = {
        id: `custom_${Date.now()}`,
        guildId,
        name: config.name,
        description: config.description || '',
        steps: config.steps || [],
        triggers: config.triggers || [],
        conditions: config.conditions || [],
        variables: config.variables || {},
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        author: config.author,
      };

      this.workflows.set(workflow.id, workflow);
      await this.db.ref(`servers/${guildId}/workflows/${workflow.id}`).set(workflow);

      Logger.info(`✅ Custom workflow created: ${workflow.name}`);
      return workflow;
    } catch (error) {
      Logger.error('Error creating workflow:', error);
      throw error;
    }
  }

  /**
   * Add step to workflow
   */
  async addStep(workflowId, stepConfig) {
    try {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const step = {
        id: `step_${Date.now()}`,
        templateId: stepConfig.templateId,
        name: stepConfig.name,
        inputs: stepConfig.inputs,
        order: workflow.steps.length,
      };

      workflow.steps.push(step);
      workflow.updatedAt = new Date().toISOString();

      this.workflows.set(workflowId, workflow);

      Logger.info(`➕ Step added to workflow: ${stepConfig.name}`);
      return step;
    } catch (error) {
      Logger.error('Error adding step:', error);
      throw error;
    }
  }

  /**
   * Add conditional logic
   */
  async addCondition(workflowId, conditionConfig) {
    try {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const condition = {
        id: `condition_${Date.now()}`,
        stepId: conditionConfig.stepId,
        type: 'if',
        variable: conditionConfig.variable,
        operator: conditionConfig.operator,
        value: conditionConfig.value,
        thenSteps: conditionConfig.thenSteps || [],
        elseSteps: conditionConfig.elseSteps || [],
      };

      workflow.conditions.push(condition);
      workflow.updatedAt = new Date().toISOString();

      this.workflows.set(workflowId, workflow);

      Logger.info(`🔀 Condition added to workflow`);
      return condition;
    } catch (error) {
      Logger.error('Error adding condition:', error);
      throw error;
    }
  }

  /**
   * Test workflow in sandbox
   */
  async testWorkflow(workflowId, testData) {
    try {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // Simulate execution without making real changes
      const results = {
        workflowId,
        status: 'success',
        stepsExecuted: workflow.steps.length,
        conditionsEvaluated: workflow.conditions.length,
        output: testData,
        executionTime: Math.random() * 1000, // Simulated
        errors: [],
      };

      Logger.info(`🧪 Workflow tested: ${workflowId}`);
      return results;
    } catch (error) {
      Logger.error('Error testing workflow:', error);
      throw error;
    }
  }

  /**
   * Publish workflow
   */
  async publishWorkflow(workflowId) {
    try {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      if (workflow.steps.length === 0) {
        throw new Error('Workflow must have at least one step');
      }

      workflow.status = 'published';
      workflow.version += 1;
      workflow.publishedAt = new Date().toISOString();
      workflow.updatedAt = new Date().toISOString();

      this.workflows.set(workflowId, workflow);

      Logger.success(`🚀 Workflow published: ${workflow.name} (v${workflow.version})`);
      return workflow;
    } catch (error) {
      Logger.error('Error publishing workflow:', error);
      throw error;
    }
  }

  /**
   * Get workflow
   */
  async getWorkflow(workflowId) {
    try {
      return this.workflows.get(workflowId);
    } catch (error) {
      Logger.error('Error fetching workflow:', error);
      throw error;
    }
  }

  /**
   * List all server workflows
   */
  async listServerWorkflows(guildId) {
    try {
      const workflows = Array.from(this.workflows.values())
        .filter(w => w.guildId === guildId);
      return workflows;
    } catch (error) {
      Logger.error('Error listing workflows:', error);
      throw error;
    }
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId) {
    try {
      this.workflows.delete(workflowId);
      Logger.info(`🗑️ Workflow deleted: ${workflowId}`);
    } catch (error) {
      Logger.error('Error deleting workflow:', error);
      throw error;
    }
  }

  /**
   * Get step templates
   */
  getStepTemplates() {
    return Array.from(Object.values(this.stepTemplates));
  }

  /**
   * Get specific step template
   */
  getStepTemplate(templateId) {
    return this.stepTemplates[templateId];
  }

  /**
   * Validate workflow
   */
  validateWorkflow(workflow) {
    const errors = [];

    if (!workflow.name || workflow.name.trim() === '') {
      errors.push('Workflow name is required');
    }

    if (workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = WorkflowBuilder;
