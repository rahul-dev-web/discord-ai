import React, { useState, useEffect } from 'react';
import '../styles/logs.css';

export default function LogsPage({ guildId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [guildId]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/logs/${guildId}?limit=100`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLoading(false);
    }
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.type === filter);

  const getLogIcon = (type) => {
    const icons = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'debug': '🐛',
    };
    return icons[type] || '📝';
  };

  if (loading) {
    return (
      <div className="logs-page">
        <div className="loading">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="logs-page">
      <div className="page-header">
        <h1>📋 Activity Logs</h1>
        <p>View all system activities and events</p>
      </div>

      <div className="logs-controls">
        <div className="filter-group">
          <label>Filter by type:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Logs</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
        <div className="log-stats">
          <span>Total: {filteredLogs.length}</span>
          <button onClick={fetchLogs} className="refresh-btn">🔄 Refresh</button>
        </div>
      </div>

      <div className="logs-container">
        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <p>No logs found for this filter</p>
          </div>
        ) : (
          <table className="logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Message</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, 50).map((log, i) => (
                <tr key={i} className={`log-${log.type}`}>
                  <td className="log-time">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="log-type">
                    <span className="type-badge">
                      {getLogIcon(log.type)} {log.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="log-message">{log.message}</td>
                  <td className="log-context">
                    {log.context ? <code>{JSON.stringify(log.context).substring(0, 30)}...</code> : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
