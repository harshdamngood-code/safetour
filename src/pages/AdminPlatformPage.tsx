import React, { useEffect, useState } from 'react';
import { Shield, Users, Building, FileText, Database, Activity, RefreshCw } from 'lucide-react';
import { api, tokenStorage } from '../lib/api';

export const AdminPlatformPage: React.FC = () => {
  const token = tokenStorage.getToken();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const json = await api.get('/admin/overview');
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading SaaS Platform Telemetry...</div>;
  }

  const kpis = data?.kpis || {};
  const tenants = data?.tenants || [];
  const logs = data?.audit_logs || [];

  return (
    <div id="admin-platform-container" className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-black text-slate-900">SaaS Super-Admin Console</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Global tenant provisioning, telemetry metrics, and platform-wide security audit stream.
          </p>
        </div>

        <button
          onClick={fetchOverview}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Telemetry
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Tenants</span>
            <Building className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{kpis.total_tenants}</p>
          <p className="mt-1 text-xs text-slate-500">Isolated business databases</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total SaaS Users</span>
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{kpis.total_users}</p>
          <p className="mt-1 text-xs text-slate-500">Across all business workspaces</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Platform Gross Volume</span>
            <FileText className="h-5 w-5 text-purple-600" />
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">₹{Number(kpis.total_gross_volume).toLocaleString('en-IN')}</p>
          <p className="mt-1 text-xs text-slate-500">{kpis.total_invoices} tax invoices issued</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Storage Engine</span>
            <Database className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-3 text-base font-bold text-slate-900 truncate">{kpis.engine}</p>
          <p className="mt-1 text-xs text-emerald-600 font-semibold">Uptime: {Math.floor(kpis.uptime / 60)} mins</p>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">Registered SaaS Business Tenants</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="py-3.5 pl-6 pr-3">Business Name</th>
                <th className="py-3.5 px-3">Owner Contact</th>
                <th className="py-3.5 px-3">Location</th>
                <th className="py-3.5 px-3">Active Plan</th>
                <th className="py-3.5 px-3 text-center">Invoices</th>
                <th className="py-3.5 px-3 text-center">Products</th>
                <th className="py-3.5 pr-6 pl-3 text-center">Seats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((b: any) => (
                <tr key={b.id} className="hover:bg-slate-50/50">
                  <td className="py-4 pl-6 pr-3 font-semibold text-slate-900">
                    <div>{b.business_name}</div>
                    <span className="text-[11px] font-normal text-slate-500">{b.business_type}</span>
                  </td>
                  <td className="py-4 px-3 text-slate-600">
                    <div>{b.owner_name}</div>
                    <span className="text-xs text-slate-400">{b.owner_email}</span>
                  </td>
                  <td className="py-4 px-3 text-slate-600">{b.city}, {b.state}</td>
                  <td className="py-4 px-3">
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                      {b.plan_id || 'FREE'}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-center font-semibold text-slate-800">{b.invoice_count}</td>
                  <td className="py-4 px-3 text-center font-semibold text-slate-800">{b.product_count}</td>
                  <td className="py-4 pr-6 pl-3 text-center font-semibold text-slate-800">{b.user_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Audit Stream */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Live Platform Audit Logs</h2>
          </div>
          <span className="text-xs text-slate-400">Showing last 50 system operations</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {logs.map((log: any) => (
            <div key={log.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-mono font-bold text-slate-700">
                  {log.action}
                </span>
                <span className="text-slate-600">
                  Entity: <strong className="text-slate-900">{log.entity_name}</strong> {log.business_name ? `(${log.business_name})` : ''}
                </span>
              </div>
              <span className="text-slate-400 font-mono">{log.created_at}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
