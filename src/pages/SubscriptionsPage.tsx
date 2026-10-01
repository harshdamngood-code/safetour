import React, { useEffect, useState } from 'react';
import { Check, ShieldCheck, Zap, Sparkles, Building2, CreditCard, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, tokenStorage } from '../lib/api';

export const SubscriptionsPage: React.FC = () => {
  const { activeBusiness } = useAuth();
  const token = tokenStorage.getToken();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [upgrading, setUpgrading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSubscription = async () => {
    if (!activeBusiness?.id || !token) return;
    try {
      setLoading(true);
      const json = await api.get('/subscriptions');
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [activeBusiness?.id, token]);

  const handleSelectPlan = async (planId: string) => {
    if (!activeBusiness?.id || !token) return;
    try {
      setUpgrading(true);
      const json = await api.post('/subscriptions/change-plan', {
        plan_id: planId,
        billing_cycle: billingCycle,
      });
      if (json.success) {
        setSuccessMsg(`Your subscription has been switched to ${planId} plan successfully!`);
        fetchSubscription();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error('Error updating plan:', err);
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading subscription details...</div>;
  }

  const sub = data?.subscription || {};
  const currentPlan = data?.plan || {};
  const usage = data?.usage || {};
  const allPlans = data?.all_plans || [];

  return (
    <div id="subscription-page-container" className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          <Sparkles className="h-3.5 w-3.5" /> Commercial SaaS Plans
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900 tracking-tight">Flexible Plans for Every Stage of Business</h1>
        <p className="mt-2 text-sm text-slate-600">
          Scale your billing, GST compliance, inventory operations, and multi-branch teams without interruption.
        </p>

        {/* Billing toggle */}
        <div className="mt-6 inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            onClick={() => setBillingCycle('MONTHLY')}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              billingCycle === 'MONTHLY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('ANNUAL')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              billingCycle === 'ANNUAL' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Annual Billing
            <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] font-extrabold text-slate-950">Save 20%</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Current Quota Status */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Active Subscription</p>
            <h2 className="text-xl font-black text-slate-900">{currentPlan.name || 'Pro Plan'}</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {sub.status || 'ACTIVE'} ({sub.billing_cycle || 'MONTHLY'})
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span>Invoices Generated This Month</span>
              <span className="font-bold text-slate-900">{usage.invoices_this_month} / {usage.max_invoices_per_month}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, (usage.invoices_this_month / (usage.max_invoices_per_month || 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span>Active Catalog Products</span>
              <span className="font-bold text-slate-900">{usage.products_count} / {usage.max_products}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, (usage.products_count / (usage.max_products || 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span>Staff / Cashier Accounts</span>
              <span className="font-bold text-slate-900">{usage.users_count} / {usage.max_users}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-purple-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, (usage.users_count / (usage.max_users || 1)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Plans Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {allPlans.map((plan: any) => {
          const isCurrent = sub.plan_id === plan.id;
          const price = billingCycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly;

          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-3xl p-6 transition-all relative ${
                isCurrent
                  ? 'border-2 border-indigo-600 bg-white shadow-xl ring-4 ring-indigo-50'
                  : 'border border-slate-200 bg-white shadow-xs hover:shadow-md'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-[11px] font-extrabold text-white">
                  CURRENT PLAN
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-xs text-slate-500">Up to {plan.maxInvoices.toLocaleString()} invoices/mo</p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">₹{price}</span>
                  <span className="text-xs text-slate-500">/{billingCycle === 'ANNUAL' ? 'yr' : 'mo'}</span>
                </div>
              </div>

              <div className="mt-6 flex-1 border-t border-slate-100 pt-6">
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">Included Capabilities</p>
                <ul className="space-y-2.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>{plan.maxProducts.toLocaleString()}</strong> Products catalog</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong>{plan.maxUsers}</strong> Team login credentials</span>
                  </li>
                  {plan.features?.map((f: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  disabled={isCurrent || upgrading}
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full rounded-xl py-2.5 text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : 'bg-slate-900 text-white hover:bg-indigo-600'
                  }`}
                >
                  {isCurrent ? 'Active Plan' : `Switch to ${plan.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
