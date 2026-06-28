/**
 * PHASE 18 - REACT DASHBOARD
 * Main App Component
 * 
 * Features:
 * - Sidebar navigation
 * - Real-time bot status
 * - Page switching
 * - Health monitoring
 */

import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import WorkflowsPage from './pages/Workflows';
import AnalyticsPage from './pages/Analytics';
import LogsPage from './pages/Logs';
import SettingsPage from './pages/Settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState('workflows');
  const [botStatus, setBotStatus] = useState('checking');
  const [serverStats, setServerStats] = useState(null);
  const [guildId, setGuildId] = useState(
    localStorage.getItem('guildId') || 'default-guild'
  );

  useEffect(() => {
    checkBotHealth();
    const healthInterval = setInterval(checkBotHealth, 30000); // Every 30 seconds
    return () => clearInterval(healthInterval);
  }, []);

  const checkBotHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setBotStatus(data.status === 'ok' ? 'online' : 'offline');
      setServerStats(data);
    } catch (error) {
      setBotStatus('offline');
      console.error('Health check failed:', error);
    }
  };

  const renderPage = () => {
    const pageProps = { guildId, setGuildId };

    switch (currentPage) {
      case 'workflows':
        return <WorkflowsPage {...pageProps} />;
      case 'analytics':
        return <AnalyticsPage {...pageProps} />;
      case 'logs':
        return <LogsPage {...pageProps} />;
      case 'settings':
        return <SettingsPage {...pageProps} />;
      default:
        return <WorkflowsPage {...pageProps} />;
    }
  };

  return (
    <div className="app">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        botStatus={botStatus}
        guildId={guildId}
        onGuildChange={setGuildId}
      />
      <div className="main-content">
        <header className="top-bar">
          <div className="status-badge">
            <span className={`status-indicator ${botStatus}`}></span>
            <span className="status-text">
              {botStatus === 'online' ? '🟢 Bot Online' : '🔴 Bot Offline'}
            </span>
          </div>
          <div className="guild-info">
            <input
              type="text"
              placeholder="Enter Guild ID"
              value={guildId}
              onChange={(e) => {
                setGuildId(e.target.value);
                localStorage.setItem('guildId', e.target.value);
              }}
              className="guild-input"
            />
          </div>
        </header>

        <div className="page-content">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
