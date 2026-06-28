import React from 'react';

export default function WorkflowCard({ workflow, onRun, isExecuting }) {
  const getWorkflowIcon = (name) => {
    const icons = {
      'tournament-setup': '🏆',
      'staff-onboarding': '👤',
      'raid-response': '🛡️',
      'server-backup': '💾',
      'event-creation': '🎉',
      'match-day': '⚔️',
    };
    return icons[workflow.id] || '🔄';
  };

  return (
    <div className="workflow-card">
      <div className="workflow-header">
        <span className="workflow-icon">{getWorkflowIcon(workflow.name)}</span>
        <div className="workflow-title">
          <h3>{workflow.name}</h3>
          <p className="workflow-id">ID: {workflow.id.slice(0, 12)}...</p>
        </div>
      </div>

      <p className="workflow-description">
        {workflow.description}
      </p>

      <div className="workflow-meta">
        <div className="meta-item">
          <span className="meta-label">Steps</span>
          <span className="meta-value">{workflow.steps}</span>
        </div>
        {workflow.autoTrigger && (
          <div className="meta-item">
            <span className="auto-trigger">🤖 Auto</span>
          </div>
        )}
      </div>

      <button
        className="workflow-run-btn"
        onClick={onRun}
        disabled={isExecuting}
      >
        {isExecuting ? '⏳ Running...' : '▶️ Execute'}
      </button>
    </div>
  );
}
