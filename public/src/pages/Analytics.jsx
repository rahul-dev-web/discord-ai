import React, { useState, useEffect } from 'react';
import Chart from '../components/Chart';
import '../styles/analytics.css';

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const statsRes = await fetch('/api/analytics/overview');
      const chartRes = await fetch('/api/analytics/workflows');
      
      const statsData = await statsRes.json();
      const workflowData = await chartRes.json();
      
      setStats(statsData);
      setChartData(workflowData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  if (!stats) return <div className="loading">Loading analytics...</div>;

  return (
    <div className="analytics-page">
      <h1>📊 Analytics Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Workflows Completed</h3>
          <p className="stat-value">{stats.workflowsCompleted}</p>
        </div>
        <div className="stat-card">
          <h3>Failed Workflows</h3>
          <p className="stat-value error">{stats.workflowsFailed}</p>
        </div>
        <div className="stat-card">
          <h3>Uptime</h3>
          <p className="stat-value">{stats.uptime}</p>
        </div>
        <div className="stat-card">
          <h3>Avg Execution Time</h3>
          <p className="stat-value">{stats.averageExecutionTime}ms</p>
        </div>
      </div>

      {chartData && (
        <div className="chart-container">
          <h2>Workflow Execution Trends</h2>
          <Chart data={chartData} />
        </div>
      )}
    </div>
  );
}