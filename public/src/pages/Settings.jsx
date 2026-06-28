import React, { useState, useEffect } from 'react';
import '../styles/settings.css';

export default function SettingsPage({ guildId }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [guildId]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/settings/${guildId}`);
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/settings/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      alert('Failed to save settings');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="settings-page">
        <div className="error">Failed to load settings</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>⚙️ Settings & Configuration</h1>
        <p>Manage bot and dashboard configuration</p>
      </div>

      <div className="settings-grid">
        <section className="settings-section">
          <h2>🤖 Bot Information</h2>
          <div className="settings-group">
            <label>Bot Name</label>
            <input
              type="text"
              value={settings.botName}
              onChange={(e) => setSettings({ ...settings, botName: e.target.value })}
              readOnly
            />
          </div>

          <div className="settings-group">
            <label>Version</label>
            <input
              type="text"
              value={settings.version}
              readOnly
            />
          </div>

          <div className="settings-group">
            <label>Guild ID</label>
            <input
              type="text"
              value={settings.guildId}
              readOnly
            />
          </div>

          <div className="settings-group">
            <label>Environment</label>
            <input
              type="text"
              value={settings.environment}
              readOnly
            />
          </div>
        </section>

        <section className="settings-section">
          <h2>⚡ Features</h2>
          <div className="settings-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoDeployCommands}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  autoDeployCommands: e.target.checked 
                })}
              />
              Auto Deploy Commands
            </label>
            <p className="hint">Automatically deploy new commands on startup</p>
          </div>

          <div className="settings-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.dashboardEnabled}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  dashboardEnabled: e.target.checked 
                })}
              />
              Dashboard Enabled
            </label>
            <p className="hint">Enable the web dashboard interface</p>
          </div>

          <div className="settings-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.workflowsEnabled}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  workflowsEnabled: e.target.checked 
                })}
              />
              Workflows Enabled
            </label>
            <p className="hint">Enable automation workflows</p>
          </div>
        </section>

        <section className="settings-section">
          <h2>🔍 Logging</h2>
          <div className="settings-group">
            <label>Logging Level</label>
            <select 
              value={settings.loggingLevel}
              onChange={(e) => setSettings({ 
                ...settings, 
                loggingLevel: e.target.value 
              })}
            >
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>
            <p className="hint">Set the verbosity of system logs</p>
          </div>
        </section>
      </div>

      <div className="settings-actions">
        <button onClick={handleSave} className="btn-primary">
          💾 Save Settings
        </button>
        <button onClick={fetchSettings} className="btn-secondary">
          🔄 Reset
        </button>
      </div>

      {saved && (
        <div className="success-message">
          ✅ Settings saved successfully!
        </div>
      )}
    </div>
  );
}
