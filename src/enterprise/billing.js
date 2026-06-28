/**
 * PHASE 19 - BILLING & MONETIZATION
 * Subscription & Payment Management
 * 
 * Features:
 * - Tiered subscriptions
 * - Usage tracking
 * - Invoice management
 * - Payment processing
 * - License management
 */

const Logger = require('../utils/logger');

class BillingSystem {
  constructor(firebaseDb) {
    this.db = firebaseDb;
    this.subscriptions = new Map();
    this.invoices = new Map();
    this.licenses = new Map();
    this.plans = this.initializePlans();
  }

  /**
   * Initialize billing plans
   */
  initializePlans() {
    return {
      'free': {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        billingPeriod: 'free',
        features: {
          maxWorkflows: 3,
          maxPlugins: 5,
          analyticsLevel: 'basic',
          support: 'community',
          customAI: false,
          multiServer: false,
          apiAccess: false,
          dedicatedSupport: false,
        },
      },
      'pro': {
        id: 'pro',
        name: 'Professional',
        price: 29,
        currency: 'USD',
        billingPeriod: 'monthly',
        features: {
          maxWorkflows: 50,
          maxPlugins: 50,
          analyticsLevel: 'advanced',
          support: 'email',
          customAI: true,
          multiServer: false,
          apiAccess: true,
          dedicatedSupport: false,
        },
      },
      'enterprise': {
        id: 'enterprise',
        name: 'Enterprise',
        price: 199,
        currency: 'USD',
        billingPeriod: 'monthly',
        features: {
          maxWorkflows: 999,
          maxPlugins: 999,
          analyticsLevel: 'full',
          support: '24/7',
          customAI: true,
          multiServer: true,
          apiAccess: true,
          dedicatedSupport: true,
        },
      },
    };
  }

  /**
   * Create subscription
   */
  async createSubscription(guildId, planId, config = {}) {
    try {
      const plan = this.plans[planId];
      if (!plan) {
        throw new Error('Plan not found');
      }

      const subscription = {
        id: `sub_${Date.now()}`,
        guildId,
        planId,
        planName: plan.name,
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: this.calculatePeriodEnd(plan.billingPeriod),
        autoRenew: config.autoRenew !== false,
        paymentMethod: config.paymentMethod || 'card',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cancelledAt: null,
      };

      this.subscriptions.set(subscription.id, subscription);
      await this.db.ref(`subscriptions/${subscription.id}`).set(subscription);

      Logger.success(`✅ Subscription created: ${guildId} → ${plan.name}`);
      return subscription;
    } catch (error) {
      Logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Calculate period end date
   */
  calculatePeriodEnd(billingPeriod) {
    const now = new Date();
    if (billingPeriod === 'monthly') {
      now.setMonth(now.getMonth() + 1);
    } else if (billingPeriod === 'yearly') {
      now.setFullYear(now.getFullYear() + 1);
    }
    return now.toISOString();
  }

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(subscriptionId, newPlanId) {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const newPlan = this.plans[newPlanId];
      if (!newPlan) {
        throw new Error('Plan not found');
      }

      const updated = {
        ...subscription,
        planId: newPlanId,
        planName: newPlan.name,
        updatedAt: new Date().toISOString(),
      };

      this.subscriptions.set(subscriptionId, updated);
      await this.db.ref(`subscriptions/${subscriptionId}`).update(updated);

      Logger.success(`⬆️ Subscription upgraded to ${newPlan.name}`);
      return updated;
    } catch (error) {
      Logger.error('Error upgrading subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, immediately = false) {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updated = {
        ...subscription,
        status: immediately ? 'cancelled' : 'cancelling',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.subscriptions.set(subscriptionId, updated);
      await this.db.ref(`subscriptions/${subscriptionId}`).update(updated);

      Logger.info(`❌ Subscription cancelled: ${subscriptionId}`);
      return updated;
    } catch (error) {
      Logger.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Create invoice
   */
  async createInvoice(subscriptionId, amount, details) {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const invoice = {
        id: `inv_${Date.now()}`,
        subscriptionId,
        guildId: subscription.guildId,
        amount,
        currency: 'USD',
        status: 'paid',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paidDate: new Date().toISOString(),
        description: details.description || 'Monthly subscription',
        items: details.items || [],
        createdAt: new Date().toISOString(),
      };

      this.invoices.set(invoice.id, invoice);
      await this.db.ref(`invoices/${invoice.id}`).set(invoice);

      Logger.info(`📄 Invoice created: ${invoice.id}`);
      return invoice;
    } catch (error) {
      Logger.error('Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Get subscription
   */
  async getSubscription(subscriptionId) {
    try {
      return this.subscriptions.get(subscriptionId);
    } catch (error) {
      Logger.error('Error fetching subscription:', error);
      throw error;
    }
  }

  /**
   * Get server subscription
   */
  async getServerSubscription(guildId) {
    try {
      const subs = Array.from(this.subscriptions.values())
        .filter(s => s.guildId === guildId && s.status === 'active');
      return subs.length > 0 ? subs[0] : null;
    } catch (error) {
      Logger.error('Error fetching server subscription:', error);
      throw error;
    }
  }

  /**
   * Get invoices
   */
  async getInvoices(guildId, limit = 10) {
    try {
      const invoices = Array.from(this.invoices.values())
        .filter(i => i.guildId === guildId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
      return invoices;
    } catch (error) {
      Logger.error('Error fetching invoices:', error);
      throw error;
    }
  }

  /**
   * Generate license key
   */
  async generateLicense(guildId, planId, expiryDays = 365) {
    try {
      const plan = this.plans[planId];
      if (!plan) {
        throw new Error('Plan not found');
      }

      const key = `LIC_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;
      const license = {
        key,
        guildId,
        planId,
        planName: plan.name,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        activated: false,
      };

      this.licenses.set(key, license);
      await this.db.ref(`licenses/${key}`).set(license);

      Logger.success(`🔐 License generated: ${key}`);
      return license;
    } catch (error) {
      Logger.error('Error generating license:', error);
      throw error;
    }
  }

  /**
   * Validate license
   */
  async validateLicense(licenseKey) {
    try {
      const license = this.licenses.get(licenseKey);
      if (!license) {
        return { valid: false, error: 'License not found' };
      }

      if (license.status !== 'active') {
        return { valid: false, error: 'License is inactive' };
      }

      if (new Date(license.expiresAt) < new Date()) {
        return { valid: false, error: 'License expired' };
      }

      return {
        valid: true,
        license,
        plan: this.plans[license.planId],
      };
    } catch (error) {
      Logger.error('Error validating license:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Track usage
   */
  async trackUsage(guildId, resource, amount = 1) {
    try {
      const subscription = await this.getServerSubscription(guildId);
      if (!subscription) {
        return;
      }

      const plan = this.plans[subscription.planId];
      const path = `subscriptions/${subscription.id}/usage/${resource}`;
      const current = (await this.db.ref(path).once('value')).val() || 0;
      const limit = plan.features[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}`];

      if (limit && current + amount > limit) {
        Logger.warn(`⚠️ Usage limit exceeded for ${resource}: ${current + amount}/${limit}`);
      }

      await this.db.ref(path).set(current + amount);

      Logger.debug(`📊 Usage tracked: ${resource} = ${current + amount}`);
    } catch (error) {
      Logger.error('Error tracking usage:', error);
    }
  }

  /**
   * Get plans
   */
  getPlans() {
    return Object.values(this.plans);
  }

  /**
   * Get plan
   */
  getPlan(planId) {
    return this.plans[planId];
  }
}

module.exports = BillingSystem;
