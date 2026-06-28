/**
 * PHASE 18 - DASHBOARD API SERVER
 * 
 * Express server providing REST APIs for dashboard
 * Endpoints: Workflows, Analytics, Logs, Settings, Health
 * Real-time updates via WebSocket (future enhancement)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const Logger = require('../utils/logger');

class DashboardServer {
  constructor(client, port = Number(process.env.PORT) || 3000) {
    this.client = client;
    this.app = express();
    this.port = port;
    this.isRunning = false;
    this.server = null;

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Require API key for mutating dashboard routes
   */
  requireDashboardAuth(req, res, next) {
    const apiKey = process.env.DASHBOARD_API_KEY?.trim();

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({ error: 'Dashboard API key not configured' });
      }
      return next();
    }

    const provided = req.headers['x-api-key'];
    if (provided !== apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return next();
  }

  /**
   * Build chart data from workflow execution history
   */
  buildWorkflowChartData(history) {
    const labels = [];
    const total = [];
    const success = [];
    const failed = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));

      let dayTotal = 0;
      let daySuccess = 0;
      let dayFailed = 0;

      for (const entry of history) {
        const startedAt = new Date(entry.startedAt);
        startedAt.setHours(0, 0, 0, 0);

        if (startedAt.getTime() === date.getTime()) {
          dayTotal++;
          if (entry.status === 'SUCCESS') {
            daySuccess++;
          } else if (entry.status === 'FAILED') {
            dayFailed++;
          }
        }
      }

      total.push(dayTotal);
      success.push(daySuccess);
      failed.push(dayFailed);
    }

    return { labels, total, success, failed };
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
      : ['http://localhost:3000'];

    this.app.use(cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
    }));
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../../public')));

    // Request logging
    this.app.use((req, res, next) => {
      Logger.debug(`📊 [Dashboard] ${req.method} ${req.path}`);
      next();
    });

    // Error handling middleware
    this.app.use((err, req, res, next) => {
      Logger.error('Dashboard error:', err);
      res.status(500).json({ error: err.message });
    });
  }

  /**
   * Setup all API routes
   */
  setupRoutes() {
    // ==================== HEALTH CHECK ====================
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        discord: this.client.isReady?.() ? 'online' : 'starting',
        uptimeSeconds: Math.round(process.uptime()),
        startedAt: this.client.startedAt?.toISOString?.() || new Date().toISOString(),
      });
    });

    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        discord: this.client.isReady?.() ? 'online' : 'starting',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      });
    });

    // ==================== WORKFLOWS ====================

    // List all workflows
    this.app.get('/api/workflows', (req, res) => {
      try {
        const workflowEngine = this.client.engines?.workflowEngine;
        if (!workflowEngine) {
          return res.status(503).json({ error: 'Workflow engine not initialized' });
        }

        const workflows = workflowEngine.listWorkflows();
        res.json({
          success: true,
          count: workflows.length,
          workflows: workflows.map(w => ({
            id: w.id,
            name: w.name,
            description: w.description,
            steps: w.steps.length,
            autoTrigger: w.autoTrigger || false,
            createdAt: w.createdAt,
          })),
        });
      } catch (error) {
        Logger.error('Error fetching workflows:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get specific workflow details
    this.app.get('/api/workflows/:workflowId', (req, res) => {
      try {
        const { workflowId } = req.params;
        const workflowEngine = this.client.engines?.workflowEngine;

        if (!workflowEngine) {
          return res.status(503).json({ error: 'Workflow engine not initialized' });
        }

        const workflow = workflowEngine.getWorkflow(workflowId);
        if (!workflow) {
          return res.status(404).json({ error: 'Workflow not found' });
        }

        res.json({
          success: true,
          workflow: {
            ...workflow,
            steps: workflow.steps.map((s, i) => ({
              id: s.id,
              index: i,
              name: s.name,
              description: s.description,
              confirmRequired: s.confirmRequired,
            })),
          },
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Run workflow
    this.app.post('/api/workflows/:workflowId/run', this.requireDashboardAuth.bind(this), async (req, res) => {
      try {
        const { workflowId } = req.params;
        const { guildId } = req.body;

        if (!guildId) {
          return res.status(400).json({ error: 'Guild ID required' });
        }

        const workflowEngine = this.client.engines?.workflowEngine;
        if (!workflowEngine) {
          return res.status(503).json({ error: 'Workflow engine not initialized' });
        }

        const execution = await workflowEngine.executeWorkflow(guildId, workflowId, {
          executorId: 'dashboard',
          source: 'dashboard',
        });

        res.json({
          success: true,
          execution: {
            id: execution.id,
            workflowId: execution.workflowId,
            status: execution.status,
            startedAt: execution.startedAt,
          },
        });
      } catch (error) {
        Logger.error('Error running workflow:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get workflow status
    this.app.get('/api/workflows/:workflowId/status/:guildId', (req, res) => {
      try {
        const { workflowId, guildId } = req.params;
        const workflowEngine = this.client.engines?.workflowEngine;

        if (!workflowEngine) {
          return res.status(503).json({ error: 'Workflow engine not initialized' });
        }

        const execution = workflowEngine.getCurrentWorkflowStatus(guildId);
        if (!execution) {
          return res.json({ status: 'idle', message: 'No workflow running' });
        }

        const workflow = workflowEngine.getWorkflow(execution.workflowId);
        const progress = Math.round((execution.stepsCompleted.length / workflow.steps.length) * 100);

        res.json({
          success: true,
          execution: {
            id: execution.id,
            workflowId: execution.workflowId,
            status: execution.status,
            progress: progress,
            stepsCompleted: execution.stepsCompleted.length,
            totalSteps: workflow.steps.length,
            currentStep: workflow.steps[execution.currentStepIndex]?.name,
            startedAt: execution.startedAt,
          },
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get workflow history
    this.app.get('/api/workflows/history/:guildId', (req, res) => {
      try {
        const { guildId } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        const workflowEngine = this.client.engines?.workflowEngine;
        if (!workflowEngine) {
          return res.status(503).json({ error: 'Workflow engine not initialized' });
        }

        const history = workflowEngine.getExecutionHistory(guildId, limit);
        res.json({
          success: true,
          count: history.length,
          executions: history.map(e => ({
            id: e.id,
            workflowId: e.workflowId,
            status: e.status,
            stepsCompleted: e.stepsCompleted.length,
            startedAt: e.startedAt,
            completedAt: e.completedAt,
          })),
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==================== ANALYTICS ====================

    // Overview stats
    this.app.get('/api/analytics/overview/:guildId', (req, res) => {
      try {
        const { guildId } = req.params;
        const workflowEngine = this.client.engines?.workflowEngine;

        if (!workflowEngine) {
          return res.status(503).json({ error: 'Workflow engine not initialized' });
        }

        const history = workflowEngine.getExecutionHistory(guildId, 100);

        const completed = history.filter(e => e.status === 'SUCCESS').length;
        const failed = history.filter(e => e.status === 'FAILED').length;
        const total = history.length;

        const avgTime = history.length > 0
          ? Math.round(
              history.reduce((sum, e) => {
                const duration = new Date(e.completedAt) - new Date(e.startedAt);
                return sum + duration;
              }, 0) / history.length
            )
          : 0;

        res.json({
          success: true,
          stats: {
            workflowsCompleted: completed,
            workflowsFailed: failed,
            workflowsTotal: total,
            successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
            averageExecutionTime: avgTime,
            uptime: '99.9%',
          },
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Workflow execution chart data
    this.app.get('/api/analytics/workflows/:guildId', (req, res) => {
      try {
        const { guildId } = req.params;
        const workflowEngine = this.client.engines?.workflowEngine;

        if (!workflowEngine) {
          return res.status(503).json({ error: 'Workflow engine not initialized' });
        }

        const history = workflowEngine.getExecutionHistory(guildId, 100);
        const chartBuckets = this.buildWorkflowChartData(history);

        res.json({
          success: true,
          chart: {
            labels: chartBuckets.labels,
            datasets: [
              {
                label: 'Workflows Executed',
                data: chartBuckets.total,
                borderColor: '#3498DB',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
              },
              {
                label: 'Successful',
                data: chartBuckets.success,
                borderColor: '#2ECC71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                tension: 0.4,
              },
              {
                label: 'Failed',
                data: chartBuckets.failed,
                borderColor: '#E74C3C',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                tension: 0.4,
              },
            ],
          },
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==================== LOGS ====================

    this.app.get('/api/logs/:guildId', async (req, res) => {
      try {
        const { guildId } = req.params;
        const limit = parseInt(req.query.limit, 10) || 50;
        const logEngine = this.client.engines?.logging;

        if (!logEngine) {
          return res.json({
            success: true,
            logs: [{
              timestamp: new Date().toISOString(),
              type: 'info',
              message: 'Logging engine initializing',
            }],
          });
        }

        const logs = await logEngine.getLogs(guildId, limit);

        res.json({
          success: true,
          count: logs.length,
          logs: logs.map(log => ({
            timestamp: log.timestamp,
            type: log.type,
            message: log.message,
            context: log.context,
          })),
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==================== SETTINGS ====================

    this.app.get('/api/settings/:guildId', (req, res) => {
      try {
        const { guildId } = req.params;

        res.json({
          success: true,
          settings: {
            botName: 'IGL Discord Bot',
            version: '1.0.0',
            guildId: guildId,
            environment: process.env.NODE_ENV,
            autoDeployCommands: process.env.AUTO_DEPLOY_COMMANDS === 'true',
            dashboardEnabled: true,
            workflowsEnabled: true,
            loggingLevel: process.env.LOG_LEVEL || 'INFO',
          },
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Update settings
    this.app.post('/api/settings/:guildId', this.requireDashboardAuth.bind(this), async (req, res) => {
      try {
        const { guildId } = req.params;
        const { settings } = req.body;

        if (this.client.configManager && settings) {
          await this.client.configManager.updateServerConfig(guildId, settings);
        }

        Logger.info(`⚙️ Settings updated for guild ${guildId}:`, settings);

        res.json({
          success: true,
          message: 'Settings updated',
          settings: settings,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==================== STATIC FILES ====================

    // Serve dashboard (fallback to index.html for SPA)
    this.app.get('/*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../../public/index.html'), { root: '/' });
      }
    });
  }

  /**
   * Start the server
   */
  start() {
    if (this.isRunning) {
      Logger.warn('Dashboard server already running');
      return;
    }

    this.server = this.app.listen(this.port, '0.0.0.0', () => {
      this.isRunning = true;
      Logger.success(`🌐 HTTP server started on http://0.0.0.0:${this.port}`);
      Logger.info(`📊 Dashboard: http://localhost:${this.port}`);
      Logger.info(`📡 API: http://localhost:${this.port}/api/*`);
      Logger.info(`❤️ Health: http://localhost:${this.port}/health`);
    });

    this.server.on('error', (error) => {
      Logger.error('HTTP server failed:', error);
      process.exit(1);
    });
  }

  /**
   * Stop the server
   */
  stop() {
    this.isRunning = false;
    Logger.info('🌐 Dashboard server stopped');
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      port: this.port,
      url: `http://localhost:${this.port}`,
    };
  }
}

module.exports = DashboardServer;