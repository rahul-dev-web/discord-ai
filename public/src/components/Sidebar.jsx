import React from 'react';

export default function Sidebar({ currentPage, onPageChange, botStatus, guildId, onGuildChange }) {
  const menuItems = [
    { id: 'workflows', label: '🔄 Workflows', icon: '⚙️' },
    { id: 'analytics', label: '📊 Analytics', icon: '📈' },
    { id: 'logs', label: '📋 Logs', icon: '📝' },
    { id: 'settings', label: '⚙️ Settings', icon: '🔧' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>🤖 IGL Bot</h1>
        <p className="version">v1.0.0</p>
      </div>

      <div className="bot-status">
        <div className={`status-circle ${botStatus}`}></div>
        <span className="status-label">
          {botStatus === 'online' ? 'Online' : 'Offline'}
        </span>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`menu-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onPageChange(item.id)}
          >
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="footer-info">
          <p className="footer-label">Dashboard</p>
          <p className="footer-version">Phase 18 • v1.0</p>
        </div>
        <button className="refresh-btn" title="Refresh" onClick={() => window.location.reload()}>
          🔄
        </button>
      </div>
    </aside>
  );
}
