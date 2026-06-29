import React, { useState, useEffect } from 'react';
import WorkflowCard from '../components/WorkflowCard';
import '../styles/workflows.css';

export default function WorkflowsPage({ guildId, executorId }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetchWorkflows();
    const interval = setInterval(fetchWorkflows, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      if (data.success) {
        setWorkflows(data.workflows);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      setLoading(false);
    }
  };

  const handleRunWorkflow = async (workflowId) => {
    if (executing) return;
    if (!executorId) {
      alert('Executor User ID is required to run workflows.');
      return;
    }

    setExecuting(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, executorId }),
      });

      const data = await res.json();
      if (data.success) {
        alert(`✅ Workflow started! Execution ID: ${data.execution.id}`);
        setSelectedWorkflow(data.execution.id);
        // Poll for status
        pollExecutionStatus(data.execution.id);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert('❌ Failed to run workflow');
      console.error(error);
    } finally {
      setExecuting(false);
    }
  };

  const pollExecutionStatus = async (executionId) => {
    // Poll every 2 seconds for 60 seconds
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      fetchWorkflows();
    }
  };

  if (loading) {
    return (
      <div className="workflows-page">
        <div className="loading">Loading workflows...</div>
      </div>
    );
  }

  return (
    <div className="workflows-page">
      <div className="page-header">
        <h1>🔄 Automation Workflows</h1>
        <p>Manage and execute automation workflows for your server</p>
      </div>

      <div className="workflows-stats">
        <div className="stat">
          <span className="stat-label">Total Workflows</span>
          <span className="stat-value">{workflows.length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Guild ID</span>
          <span className="stat-value monospace">{guildId.slice(0, 8)}...</span>
        </div>
      </div>

      <div className="workflows-grid">
        {workflows.length === 0 ? (
          <div className="empty-state">
            <p>No workflows found</p>
          </div>
        ) : (
          workflows.map(workflow => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onRun={() => handleRunWorkflow(workflow.id)}
              isExecuting={executing}
            />
          ))
        )}
      </div>

      {selectedWorkflow && (
        <div className="execution-panel">
          <h3>Execution Status</h3>
          <p>ID: <code>{selectedWorkflow}</code></p>
          <button onClick={() => setSelectedWorkflow(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
