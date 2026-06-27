import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import WorkflowsPage from './pages/Workflows';
import AnalyticsPage from './pages/Analytics';
import LogsPage from './pages/Logs';
import SettingsPage from './pages/Settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState('workflows');
  const [botStatus, setBotStatus] = useState('online');

  useEffect(() => {
    // Check bot health every 30 seconds
    const healthCheck = setInterval(async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setBotStatus(data.status === 'ok' ? 'online' : 'offline');
      } catch (error) {
        setBotStatus('offline');
      }
    }, 30000);

    return () => clearInterval(healthCheck);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'workflows':
        return <WorkflowsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'logs':
        return <LogsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <WorkflowsPage />;
    }
  };

  return (
    <div className="app">
      <Sidebar 
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        botStatus={botStatus}
      />
      <div className="main-content">
        {renderPage()}
      </div>
    </div>
  );
}