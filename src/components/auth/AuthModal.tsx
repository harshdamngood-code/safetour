import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  TiltCard,
  AnimatedButton,
  AmbientBackground3D,
} from '../ui/3d-system';
import {
  Mail,
  User,
  Lock,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Package,
  FileText,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { login, register, error, clearError, isLoading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('demo@billflow.in');
  const [loginPassword, setLoginPassword] = useState('Demo@12345');

  // Register Form State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBizName, setRegBizName] = useState('');
  const [regBizType, setRegBizType] = useState('Retail');
  const [regState, setRegState] = useState('Maharashtra');

  const triggerError = (msg: string) => {
    setFormError(msg);
    setShakeKey((k) => k + 1);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();
    try {
      await login(loginIdentifier, loginPassword);
    } catch (err: any) {
      triggerError(err.message || 'Login failed');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!regFullName.trim()) {
      triggerError('Full name is required');
      return;
    }
    if (!regEmail.trim()) {
      triggerError('Email is required');
      return;
    }
    if (regPassword.length < 6) {
      triggerError('Password must be at least 6 characters');
      return;
    }

    try {
      await register({
        fullName: regFullName,
        email: regEmail,
        phone: regPhone || undefined,
        password: regPassword,
        businessName: regBizName || undefined,
        businessType: regBizType,
        state: regState,
      });
    } catch (err: any) {
      triggerError(err.message || 'Registration failed');
    }
  };

  const applyDemoCredentials = (email: string) => {
    setLoginIdentifier(email);
    setLoginPassword('Demo@12345');
    setFormError(null);
    clearError();
  };

  const activeError = formError || error;

  return (
    <div className="relative min-h-screen bg-[#060913] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-hidden">
      <AmbientBackground3D />

      <div className="relative z-10 max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* LEFT COLUMN: LOGIN / REGISTER GLASS FORM */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          {/* Brand Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-emerald-500 flex items-center justify-center font-extrabold text-lg text-white shadow-xl shadow-indigo-600/30">
              BF
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                BillFlow
              </h1>
              <p className="text-xs text-slate-400">
                Commercial Billing, Inventory &amp; GST Operating System
              </p>
            </div>
          </div>

          <div
            key={shakeKey}
            className={`glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800/90 shadow-2xl ${
              activeError ? 'animate-shake' : ''
            }`}
          >
            {/* Segmented Mode Switcher */}
            <div className="flex rounded-2xl bg-slate-950/80 p-1 mb-6 border border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setFormError(null);
                  clearError();
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  !isRegister
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setFormError(null);
                  clearError();
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  isRegister
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error Banner */}
            {activeError && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{activeError}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {!isRegister ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email or Registered Phone
                  </label>
                  <div className="relative group">
                    <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 absolute left-3.5 top-3 transition-colors" />
                    <input
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="demo@billflow.in"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative group">
                    <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 absolute left-3.5 top-3 transition-colors" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>

                <AnimatedButton
                  type="submit"
                  loading={isLoading}
                  loadingText="Authenticating Workspace..."
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                >
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </AnimatedButton>

                {/* DEMO ACCOUNTS QUICK-FILL */}
                <div className="pt-5 border-t border-slate-800/80 mt-6">
                  <div className="text-[11px] font-semibold text-slate-400 mb-2.5 flex items-center justify-between">
                    <span>Instant Demo Workspaces</span>
                    <span className="font-mono text-[10px] text-indigo-400">
                      1-Click Fill
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => applyDemoCredentials('demo@billflow.in')}
                      className="px-3.5 py-2.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/90 hover:border-indigo-500/40 rounded-xl text-left transition-all flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <span>Harsh Patel</span>
                          <span className="text-[10px] font-mono text-emerald-400">
                            · Owner
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          demo@billflow.in · 2 Multi-Tenant Businesses
                        </div>
                      </div>
                      <span className="text-xs text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                        Select &rarr;
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyDemoCredentials('staff@billflow.in')}
                      className="px-3.5 py-2.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/90 hover:border-indigo-500/40 rounded-xl text-left transition-all flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <span>Rahul Verma</span>
                          <span className="text-[10px] font-mono text-amber-400">
                            · Staff
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          staff@billflow.in · Salesperson Access
                        </div>
                      </div>
                      <span className="text-xs text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                        Select &rarr;
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* REGISTER FORM */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g. Ramesh Sharma"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="ramesh@sharmastore.in"
                      className="w-full px-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Phone (+91)
                    </label>
                    <input
                      type="text"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full px-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password (min 6 characters) *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 mb-2">
                    Initial Business Profile
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={regBizName}
                        onChange={(e) => setRegBizName(e.target.value)}
                        placeholder="e.g. Sharma Kirana & General Stores"
                        className="w-full px-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Business Type
                        </label>
                        <select
                          value={regBizType}
                          onChange={(e) => setRegBizType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Retail">Retail</option>
                          <option value="Wholesale">Wholesale</option>
                          <option value="Distributor">Distributor</option>
                          <option value="Services">Services</option>
                          <option value="Manufacturing">Manufacturing</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          State
                        </label>
                        <select
                          value={regState}
                          onChange={(e) => setRegState(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Maharashtra">Maharashtra (27)</option>
                          <option value="Karnataka">Karnataka (29)</option>
                          <option value="Delhi">Delhi (07)</option>
                          <option value="Gujarat">Gujarat (24)</option>
                          <option value="Tamil Nadu">Tamil Nadu (33)</option>
                          <option value="Uttar Pradesh">
                            Uttar Pradesh (09)
                          </option>
                          <option value="West Bengal">West Bengal (19)</option>
                          <option value="Rajasthan">Rajasthan (08)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatedButton
                  type="submit"
                  loading={isLoading}
                  loadingText="Provisioning Workspace..."
                  variant="emerald"
                  size="lg"
                  className="w-full mt-3"
                >
                  <span>Create Business Account</span>
                  <CheckCircle2 className="w-4 h-4" />
                </AnimatedButton>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: FLOATING 3D BUSINESS COMMAND VISUALIZATION (Desktop Only) */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-center perspective-1200">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Multi-Tenant Indian GST &amp; ERP Architecture</span>
              </div>
              <h2
                className="text-3xl font-extrabold text-white tracking-tight leading-tight"
                style={{ textWrap: 'balance' } as any}
              >
                Precision Financial Control for Modern Indian Enterprises.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Issue GST-compliant tax invoices, track real-time inventory
                valuation, reconcile party khata ledgers, and generate GSTR-1
                &amp; GSTR-3B returns from a unified command workspace.
              </p>
            </div>

            {/* 2x2 Floating 3D Perspective Cards */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <TiltCard glowColor="emerald" className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400">
                    Sales Velocity
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                  ₹14,82,450
                </div>
                <div className="text-[11px] text-emerald-400 mt-1.5 font-mono">
                  +24.8% vs Preceding Month
                </div>
              </TiltCard>

              <TiltCard glowColor="indigo" className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400">
                    GST Invoicing
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                  CGST · SGST · IGST
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  Automated HSN &amp; Place of Supply tax split
                </div>
              </TiltCard>

              <TiltCard glowColor="cyan" className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400">
                    Inventory Ledger
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                  Real-Time Stock
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  Barcode POS, batch alerts &amp; audit trail
                </div>
              </TiltCard>

              <TiltCard glowColor="violet" className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400">
                    Analytics &amp; Filing
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
                  GSTR-1 &amp; 3B
                </div>
                <div className="text-[11px] text-slate-400 mt-1.5">
                  Instant P&amp;L, Daybook &amp; ITC reconciliation
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
