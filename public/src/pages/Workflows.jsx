import React, { useState, useEffect } from 'react';
import WorkflowCard from '../components/WorkflowCard';
import '../styles/workflows.css';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      setWorkflows(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      setLoading(false);
    }
  };

  const handleRunWorkflow = async (workflowId) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          guildId: 'your-guild-id',
          context: {}
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Workflow started!');
        fetchWorkflows();
      }
    } catch (error) {
      alert('Failed to run workflow');
    }
  };

  if (loading) return <div className="loading">Loading workflows...</div>;

  return (
    <div className="workflows-page">
      <h1>🔄 Automation Workflows</h1>
      <p className="description">Manage and execute automation workflows</p>
      
      <div className="workflows-grid">
        {workflows.map(workflow => (
          <WorkflowCard 
            key={workflow.id}
            workflow={workflow}
            onRun={() => handleRunWorkflow(workflow.id)}
          />
        ))}
      </div>
    </div>
  );
}