import React, { useState, useEffect } from 'react';
import '../styles/analytics.css';

export default function AnalyticsPage({ guildId }) {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [guildId]);

  const fetchAnalytics = async () => {
    try {
      const statsRes = await fetch(`/api/analytics/overview/${guildId}`);
      const chartRes = await fetch(`/api/analytics/workflows/${guildId}`);

      const statsData = await statsRes.json();
      const workflowData = await chartRes.json();

      if (statsData.success) {
        setStats(statsData.stats);
      }
      if (workflowData.success) {
        setChartData(workflowData.chart);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading">Loading analytics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="analytics-page">
        <div className="error">Failed to load analytics data</div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1>📊 Analytics Dashboard</h1>
        <p>Monitor workflow performance and system health</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Workflows Completed</h3>
            <p className="stat-value">{stats.workflowsCompleted}</p>
            <span className="stat-label">successful executions</span>
          </div>
        </div>

        <div className="stat-card error">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <h3>Workflow Failures</h3>
            <p className="stat-value">{stats.workflowsFailed}</p>
            <span className="stat-label">failed executions</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Success Rate</h3>
            <p className="stat-value">{stats.successRate}%</p>
            <span className="stat-label">success percentage</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <h3>Avg Execution Time</h3>
            <p className="stat-value">{Math.round(stats.averageExecutionTime / 1000)}s</p>
            <span className="stat-label">average duration</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Total Workflows</h3>
            <p className="stat-value">{stats.workflowsTotal}</p>
            <span className="stat-label">total executions</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <h3>Uptime</h3>
            <p className="stat-value">{stats.uptime}</p>
            <span className="stat-label">system availability</span>
          </div>
        </div>
      </div>

      {chartData && (
        <div className="chart-container">
          <h2>📈 Execution Trends (Last 7 Days)</h2>
          <div className="chart-info">
            <p>Total Executions: <strong>{stats.workflowsTotal}</strong></p>
            <p>Success Rate: <strong>{stats.successRate}%</strong></p>
          </div>
          <div className="chart-placeholder">
            <p>Chart data visualization ready</p>
            <small>Install Chart.js to render graphs</small>
          </div>
        </div>
      )}
    </div>
  );
}
