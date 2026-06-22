/**
 * TASK MANAGER
 * Handles complex operations that require multiple steps
 * Can pause, resume, and rollback operations
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class TaskManager {
  constructor(client, database) {
    this.client = client;
    this.db = database;
    this.activeTasks = new Map(); // In-memory cache
  }

  /**
   * Create a new task
   */
  async createTask(guildId, taskType, description, steps) {
    try {
      const task = {
        guildId,
        taskType,
        description,
        status: 'created', // created, running, paused, completed, failed, rolled_back
        steps: steps.map((step, index) => ({
          id: index,
          name: step.name,
          description: step.description,
          action: step.action,
          params: step.params,
          status: 'pending', // pending, running, completed, failed
          result: null,
          error: null,
          rollbackAction: step.rollbackAction || null,
        })),
        currentStep: 0,
        progress: 0,
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        logs: [],
      };

      const taskId = await firebase.push(`servers/${guildId}/tasks`, task);
      this.activeTasks.set(taskId, task);

      Logger.info(`Created task: ${taskId} - ${taskType}`);
      return taskId;
    } catch (error) {
      Logger.error('Failed to create task:', error);
      return null;
    }
  }

  /**
   * Get task details
   */
  async getTask(guildId, taskId) {
    if (this.activeTasks.has(taskId)) {
      return this.activeTasks.get(taskId);
    }

    const task = await firebase.get(`servers/${guildId}/tasks/${taskId}`);
    if (task) {
      this.activeTasks.set(taskId, task);
    }
    return task;
  }

  /**
   * Execute task
   */
  async executeTask(guildId, taskId, executor) {
    try {
      const task = await this.getTask(guildId, taskId);
      if (!task) return false;

      task.status = 'running';
      task.startedAt = new Date().toISOString();

      // Execute steps
      for (let i = 0; i < task.steps.length; i++) {
        const step = task.steps[i];
        task.currentStep = i;

        try {
          step.status = 'running';
          Logger.info(`Executing step ${i + 1}/${task.steps.length}: ${step.name}`);

          // Call executor function
          const result = await executor(step);
          step.status = 'completed';
          step.result = result;

          // Log progress
          task.progress = Math.round(((i + 1) / task.steps.length) * 100);
          await this.updateTask(guildId, taskId, task);

        } catch (error) {
          step.status = 'failed';
          step.error = error.message;

          Logger.error(`Step ${i + 1} failed:`, error);

          // Ask whether to continue or rollback
          return {
            success: false,
            failedStep: i,
            error: error.message,
            canRollback: this.canRollback(task, i),
          };
        }
      }

      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      await this.updateTask(guildId, taskId, task);

      Logger.success(`Task completed: ${taskId}`);
      return { success: true, taskId };

    } catch (error) {
      Logger.error('Failed to execute task:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pause task execution
   */
  async pauseTask(guildId, taskId) {
    try {
      const task = await this.getTask(guildId, taskId);
      if (!task) return false;

      task.status = 'paused';
      await this.updateTask(guildId, taskId, task);
      Logger.info(`Task paused: ${taskId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to pause task:', error);
      return false;
    }
  }

  /**
   * Resume task execution
   */
  async resumeTask(guildId, taskId, executor) {
    try {
      const task = await this.getTask(guildId, taskId);
      if (!task || task.status !== 'paused') return false;

      task.status = 'running';

      // Resume from current step
      for (let i = task.currentStep; i < task.steps.length; i++) {
        const step = task.steps[i];

        if (step.status === 'completed') continue; // Skip completed steps

        try {
          step.status = 'running';
          const result = await executor(step);
          step.status = 'completed';
          step.result = result;

          task.currentStep = i;
          task.progress = Math.round(((i + 1) / task.steps.length) * 100);
          await this.updateTask(guildId, taskId, task);

        } catch (error) {
          step.status = 'failed';
          step.error = error.message;
          return { success: false, failedStep: i, error: error.message };
        }
      }

      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      await this.updateTask(guildId, taskId, task);

      Logger.success(`Task resumed and completed: ${taskId}`);
      return { success: true, taskId };

    } catch (error) {
      Logger.error('Failed to resume task:', error);
      return false;
    }
  }

  /**
   * Rollback task
   */
  async rollbackTask(guildId, taskId, executor) {
    try {
      const task = await this.getTask(guildId, taskId);
      if (!task) return false;

      Logger.warn(`Rolling back task: ${taskId}`);

      // Rollback completed steps in reverse order
      for (let i = task.currentStep; i >= 0; i--) {
        const step = task.steps[i];

        if (step.status !== 'completed' || !step.rollbackAction) continue;

        try {
          Logger.info(`Rolling back step ${i}: ${step.name}`);
          await executor({
            ...step,
            action: step.rollbackAction,
          });
        } catch (error) {
          Logger.error(`Failed to rollback step ${i}:`, error);
        }
      }

      task.status = 'rolled_back';
      task.completedAt = new Date().toISOString();
      await this.updateTask(guildId, taskId, task);

      Logger.success(`Task rolled back: ${taskId}`);
      return true;

    } catch (error) {
      Logger.error('Failed to rollback task:', error);
      return false;
    }
  }

  /**
   * Check if task can be rolled back
   */
  canRollback(task, upToStep) {
    // Check if any of the completed steps have rollback actions
    for (let i = 0; i <= upToStep; i++) {
      if (task.steps[i].status === 'completed' && task.steps[i].rollbackAction) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update task in Firebase
   */
  async updateTask(guildId, taskId, updates) {
    try {
      await firebase.update(`servers/${guildId}/tasks/${taskId}`, updates);
      this.activeTasks.set(taskId, { ...updates, guildId });
      return true;
    } catch (error) {
      Logger.error('Failed to update task:', error);
      return false;
    }
  }

  /**
   * Get all tasks for a server
   */
  async getServerTasks(guildId, filter = null) {
    try {
      const tasks = await firebase.get(`servers/${guildId}/tasks`);
      if (!tasks) return [];

      let taskArray = Object.entries(tasks).map(([id, task]) => ({ id, ...task }));

      if (filter) {
        taskArray = taskArray.filter(task => task.status === filter);
      }

      return taskArray;
    } catch (error) {
      Logger.error('Failed to get tasks:', error);
      return [];
    }
  }

  /**
   * Add log entry to task
   */
  async addLog(guildId, taskId, logEntry) {
    try {
      const task = await this.getTask(guildId, taskId);
      if (!task) return false;

      task.logs.push({
        timestamp: new Date().toISOString(),
        message: logEntry,
      });

      await this.updateTask(guildId, taskId, task);
      return true;
    } catch (error) {
      Logger.error('Failed to add log:', error);
      return false;
    }
  }
}

module.exports = TaskManager;
