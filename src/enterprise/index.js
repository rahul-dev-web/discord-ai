/**
 * PHASE 19 - ENTERPRISE SYSTEMS
 * Central export for all enterprise features
 */

const ServerRegistry = require('./server-registry');
const EnterpriseRBAC = require('./rbac');
const WorkflowBuilder = require('./workflow-builder');
const PluginMarketplace = require('./marketplace');
const AIPersonalitySystem = require('./personalities');
const BillingSystem = require('./billing');

class EnterpriseManager {
  constructor(firebaseDb) {
    this.db = firebaseDb;
    this.serverRegistry = new ServerRegistry(firebaseDb);
    this.rbac = new EnterpriseRBAC(firebaseDb);
    this.workflowBuilder = new WorkflowBuilder(firebaseDb);
    this.marketplace = new PluginMarketplace(firebaseDb);
    this.personalities = new AIPersonalitySystem(firebaseDb);
    this.billing = new BillingSystem(firebaseDb);
  }
}

module.exports = {
  EnterpriseManager,
  ServerRegistry,
  EnterpriseRBAC,
  WorkflowBuilder,
  PluginMarketplace,
  AIPersonalitySystem,
  BillingSystem,
};