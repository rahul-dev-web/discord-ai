const express = require('express');
const cors = require('cors');
const path = require('path');
const Logger = require('../utils/logger');

class DashboardServer {
  constructor(client) {
    this.client = client;
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../../public')));
  }

  setupRoutes() {
    // Workflow routes
    this.app.get('/api/workflows', (req, res) => {
      const workflows = this.client.engines.workflowEngine.listWorkflows();
      res.json(workflows);
    });

    this.app.post('/api/workflows/:id/run', async (req, res) => {
      try {
        const { id } = req.params;
        const execution = await this.client.engines.workflowEngine.executeWorkflow(
          req.body.guildId,
          id,
          req.body.context
        );
        res.json({ success: true, execution });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/workflows/:id/status', (req, res) => {
      const { id } = req.params;
      const status = this.client.engines.workflowEngine.getCurrentWorkflowStatus(
        req.body.guildId
      );
      res.json(status);
    });

    // Analytics routes
    this.app.get('/api/analytics/overview', (req, res) => {
      const stats = {
        workflowsCompleted: 42,
        workflowsFailed: 2,
        uptime: '99.9%',
        averageExecutionTime: 245, // ms
      };
      res.json(stats);
    });

    this.app.get('/api/analytics/workflows', (req, res) => {
      const data = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Workflows Executed',
            data: [12, 19, 8, 15, 22, 10, 14],
            borderColor: '#3498DB',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
          },
        ],
      };
      res.json(data);
    });

    // Logs route
    this.app.get('/api/logs', (req, res) => {
      const limit = req.query.limit || 50;
      const logs = this.client.engines.logging?.getLogs(limit) || [];
      res.json(logs);
    });

    // Settings route
    this.app.get('/api/settings', (req, res) => {
      const settings = {
        botName: 'IGL Discord Bot',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        autoDeployCommands: process.env.AUTO_DEPLOY_COMMANDS === 'true',
      };
      res.json(settings);
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'ok',
        timestamp: new Date(),
        uptime: process.uptime(),
      });
    });

    // Serve dashboard
    this.app.get('/*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/index.html'));
    });
  }

  start() {
    this.app.listen(this.port, () => {
      Logger.info(`🌐 Dashboard running on http://localhost:${this.port}`);
    });
  }
}

module.exports = DashboardServer;