import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PwaInstallButton } from '../pwa/PwaInstallButton';
import { SyncIndicator, BottomSheet } from '../ui/3d-system';
import { syncManager, SyncState } from '../../lib/offline-sync';
import {
  Building2,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Check,
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Sparkles,
  ShoppingBag,
  FileSpreadsheet,
  RotateCcw,
  CreditCard,
  ShieldAlert,
  Search,
  Bell,
  Command,
  Plus,
  Receipt,
  Wallet,
  TrendingUp,
  Boxes,
  Settings,
  UserCheck,
  Truck,
  ArrowRight,
  X,
  MoreHorizontal,
} from 'lucide-react';

export type AppView =
  | 'dashboard'
  | 'invoices'
  | 'purchases'
  | 'parties'
  | 'inventory'
  | 'reports'
  | 'returns'
  | 'subscriptions'
  | 'admin'
  | 'security';

export type SubViewHint =
  | 'sales'
  | 'invoices'
  | 'purchases'
  | 'expenses'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'payments'
  | null;

interface NavbarProps {
  currentView: AppView;
  onChangeView: (view: AppView, hint?: SubViewHint) => void;
  onOpenCreateBusiness: () => void;
  onOpenOnboarding: () => void;
  onOpenCommandPalette?: () => void;
  activeHint?: SubViewHint;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onChangeView,
  onOpenOnboarding,
  onOpenCommandPalette,
}) => {
  const { user, businesses, activeBusiness, switchBusiness, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [switchingBiz, setSwitchingBiz] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('ONLINE');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    return syncManager.subscribe((state, count) => {
      setSyncState(state);
      setPendingCount(count);
    });
  }, []);

  const handleBusinessSwitch = (bizId: string) => {
    if (bizId === activeBusiness?.id) {
      setDropdownOpen(false);
      return;
    }
    setSwitchingBiz(true);
    setTimeout(() => {
      switchBusiness(bizId);
      setDropdownOpen(false);
      setSwitchingBiz(false);
    }, 220);
  };

  const viewLabels: Record<AppView, string> = {
    dashboard: 'Executive Command Center',
    invoices: 'Sales & GST Invoicing',
    purchases: 'Purchases & Operating Expenses',
    parties: 'Customers, Suppliers & Khata',
    inventory: 'Products & Inventory Valuation',
    returns: 'Sales & Purchase Returns',
    reports: 'Analytics & GST Filings',
    subscriptions: 'Workspace Plans & Billing',
    admin: 'Staff & Multi-Tenant Governance',
    security: 'Tenant Security & Isolation',
  };

  return (
    <header className="sticky top-0 z-30 glass-header h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Zone 1: Brand & Contextual Workspace Title */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={() => onChangeView('dashboard')}
          className="flex items-center gap-2.5 text-left group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-emerald-500 flex items-center justify-center font-extrabold text-white shadow-lg shadow-indigo-500/25 text-sm tracking-wider group-hover:scale-105 transition-transform">
            BF
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">
            BillFlow
          </span>
        </button>

        <span aria-hidden="true" className="text-slate-700 hidden sm:inline">
          /
        </span>

        <span className="hidden sm:inline-block text-xs font-semibold text-slate-300 truncate">
          {viewLabels[currentView]}
        </span>
      </div>

      {/* Zone 2: Global Command Search Bar (Ctrl + K) */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/40 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-between transition-all shadow-inner group"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
            <span>Search invoices, products, parties or jump to...</span>
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-950/90 border border-slate-800 rounded-md shrink-0">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Sync Indicator, Notifications, Business Switcher & Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Mobile Search Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Open Command Search"
          className="md:hidden p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Live 3D Sync Indicator */}
        <div className="hidden sm:block">
          <SyncIndicator
            state={syncState}
            pendingCount={pendingCount}
            onRetry={() => syncManager.retryAll()}
          />
        </div>

        <PwaInstallButton />

        {/* Notifications Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen(!notifOpen);
              setDropdownOpen(false);
              setUserDropdownOpen(false);
            }}
            aria-label="Workspace Notifications"
            className="relative p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 glass-panel rounded-2xl border border-slate-700/80 py-3 px-4 z-50 shadow-2xl animate-page-enter space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white">
                  Workspace Alerts &amp; Telemetry
                </span>
                <button
                  onClick={() => setNotifOpen(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <button
                  onClick={() => {
                    setNotifOpen(false);
                    onChangeView('inventory');
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 text-left flex items-start gap-2.5 transition"
                >
                  <Package className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-200">
                      Inventory Stock Monitor
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Review reorder thresholds &amp; stock valuation
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setNotifOpen(false);
                    onChangeView('reports');
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 text-left flex items-start gap-2.5 transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-200">
                      GSTR-1 &amp; GSTR-3B Ready
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Real-time CGST, SGST &amp; IGST tax computation active
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Active Business Switcher */}
        {activeBusiness && (
          <div className="relative">
            <button
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setUserDropdownOpen(false);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/30 transition text-left text-xs"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 font-bold text-[11px]">
                {switchingBiz ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                ) : (
                  <Building2 className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="hidden sm:block">
                <div className="font-bold text-slate-100 text-xs truncate max-w-[135px]">
                  {activeBusiness.business_name}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>{activeBusiness.role}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{activeBusiness.state}</span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 glass-panel rounded-2xl shadow-2xl border border-slate-700/80 py-2 z-50 animate-page-enter">
                <div className="px-3.5 py-2 border-b border-slate-800 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                  <span>Switch Business Workspace</span>
                  <span className="font-mono text-slate-300">
                    {businesses.length} Active
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
                  {businesses.map((biz) => {
                    const isSelected = biz.id === activeBusiness.id;
                    return (
                      <button
                        key={biz.id}
                        onClick={() => handleBusinessSwitch(biz.id)}
                        className={`w-full px-3.5 py-2.5 flex items-start gap-2.5 text-left transition ${
                          isSelected
                            ? 'bg-indigo-600/15 text-white'
                            : 'hover:bg-slate-800/60 text-slate-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-300 shrink-0 mt-0.5">
                          {biz.business_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate flex items-center justify-between">
                            <span>{biz.business_name}</span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            GST: {biz.gstin || 'Unregistered'} · {biz.role}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenOnboarding();
                    }}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 transition shadow-lg shadow-indigo-600/25"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Onboard New Business
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Profile Dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setDropdownOpen(false);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-xs text-white uppercase shadow-md">
                {user.fullName.slice(0, 2)}
              </div>
              <div className="hidden xl:block text-left text-xs">
                <div className="font-bold text-slate-200 leading-tight truncate max-w-[110px]">
                  {user.fullName}
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
                  {user.email}
                </div>
              </div>
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 glass-panel rounded-2xl shadow-2xl border border-slate-700/80 py-2 z-50 animate-page-enter">
                <div className="px-3.5 py-2.5 border-b border-slate-800">
                  <div className="text-xs font-bold text-white">
                    {user.fullName}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {user.email}
                  </div>
                  {user.phone && (
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {user.phone}
                    </div>
                  )}
                </div>

                <div className="py-1 text-xs">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenOnboarding();
                    }}
                    className="w-full px-3.5 py-2 text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition"
                  >
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    Business Setup
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onChangeView('subscriptions');
                    }}
                    className="w-full px-3.5 py-2 text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    Subscription &amp; Plans
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onChangeView('security');
                    }}
                    className="w-full px-3.5 py-2 text-slate-300 hover:text-white hover:bg-slate-800/60 flex items-center gap-2.5 transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    Security &amp; Isolation
                  </button>
                </div>

                <div className="border-t border-slate-800 pt-1">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

/* ============================================================================
   ANIMATED PREMIUM 3D SIDEBAR NAVIGATION (All 13+ Core Business Modules)
   ============================================================================ */
interface SidebarNavItem {
  id: string;
  label: string;
  view: AppView;
  hint?: SubViewHint;
  icon: React.ComponentType<{ className?: string }>;
  group: 'core' | 'ledger' | 'system';
}

export const SIDEBAR_ITEMS: SidebarNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    view: 'dashboard',
    icon: LayoutDashboard,
    group: 'core',
  },
  {
    id: 'sales',
    label: 'Sales',
    view: 'invoices',
    hint: 'sales',
    icon: TrendingUp,
    group: 'core',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    view: 'invoices',
    hint: 'invoices',
    icon: FileText,
    group: 'core',
  },
  {
    id: 'purchases',
    label: 'Purchases',
    view: 'purchases',
    hint: 'purchases',
    icon: ShoppingBag,
    group: 'core',
  },
  {
    id: 'products',
    label: 'Products',
    view: 'inventory',
    hint: 'products',
    icon: Package,
    group: 'core',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    view: 'inventory',
    hint: 'inventory',
    icon: Boxes,
    group: 'core',
  },
  {
    id: 'customers',
    label: 'Customers',
    view: 'parties',
    hint: 'customers',
    icon: UserCheck,
    group: 'ledger',
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    view: 'parties',
    hint: 'suppliers',
    icon: Truck,
    group: 'ledger',
  },
  {
    id: 'payments',
    label: 'Payments',
    view: 'parties',
    hint: 'payments',
    icon: Wallet,
    group: 'ledger',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    view: 'purchases',
    hint: 'expenses',
    icon: Receipt,
    group: 'ledger',
  },
  {
    id: 'returns',
    label: 'Returns / Notes',
    view: 'returns',
    icon: RotateCcw,
    group: 'ledger',
  },
  {
    id: 'reports',
    label: 'Reports & GST',
    view: 'reports',
    icon: FileSpreadsheet,
    group: 'system',
  },
  {
    id: 'staff',
    label: 'Staff & Admin',
    view: 'admin',
    icon: ShieldAlert,
    group: 'system',
  },
  {
    id: 'settings',
    label: 'Plans & Settings',
    view: 'subscriptions',
    icon: Settings,
    group: 'system',
  },
];

export const SidebarNav: React.FC<{
  currentView: AppView;
  activeHint: SubViewHint;
  onSelect: (view: AppView, hint?: SubViewHint) => void;
}> = ({ currentView, activeHint, onSelect }) => {
  const isItemActive = (item: SidebarNavItem) => {
    if (currentView !== item.view) return false;
    if (!item.hint) return true;
    if (!activeHint) {
      // Default primary item for each view
      return (
        (item.view === 'invoices' && item.id === 'invoices') ||
        (item.view === 'purchases' && item.id === 'purchases') ||
        (item.view === 'inventory' && item.id === 'inventory') ||
        (item.view === 'parties' && item.id === 'customers')
      );
    }
    return activeHint === item.hint;
  };

  const renderGroup = (title: string, groupKey: SidebarNavItem['group']) => {
    const items = SIDEBAR_ITEMS.filter((i) => i.group === groupKey);
    return (
      <div className="space-y-1">
        <div className="px-3 pb-1 text-[11px] font-semibold text-slate-500">
          {title}
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.view, item.hint || null)}
              className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                active
                  ? 'glass-panel text-white border-indigo-500/40 shadow-lg shadow-indigo-950/50 translate-x-0.5'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
              }`}
            >
              {/* Active Left Accent Indicator */}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-indigo-400 to-emerald-400"
                />
              )}
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:-translate-y-0.5 ${
                  active
                    ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 group-hover:text-indigo-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-slate-800/80 bg-[#060913]/90 backdrop-blur-xl px-3 py-5 space-y-6 select-none">
      {renderGroup('Commercial Core', 'core')}
      {renderGroup('Ledgers & Khata', 'ledger')}
      {renderGroup('Intelligence & Control', 'system')}

      {/* Security Isolation Quick Link */}
      <div className="mt-auto pt-4 border-t border-slate-800/80">
        <button
          onClick={() => onSelect('security', null)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
            currentView === 'security'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-left min-w-0">
            <div className="truncate">Tenant Isolation</div>
            <div className="text-[10px] text-slate-500 truncate">
              Verified RBAC Boundary
            </div>
          </div>
        </button>
      </div>
    </aside>
  );
};

/* ============================================================================
   MOBILE ANIMATED BOTTOM NAVIGATION + "MORE" SHEET
   ============================================================================ */
export const MobileBottomNav: React.FC<{
  currentView: AppView;
  onSelect: (view: AppView, hint?: SubViewHint) => void;
}> = ({ currentView, onSelect }) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryTabs: {
    id: string;
    label: string;
    view: AppView;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', view: 'dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Sales', view: 'invoices', icon: FileText },
    { id: 'inventory', label: 'Inventory', view: 'inventory', icon: Package },
    { id: 'reports', label: 'Reports', view: 'reports', icon: FileSpreadsheet },
  ];

  return (
    <>
      <nav
        aria-label="Mobile Primary Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 glass-header border-t border-slate-800/90 px-2 flex items-center justify-around"
      >
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const active = currentView === tab.view;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.view, null)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                active ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-transform ${
                  active
                    ? 'bg-indigo-500/20 border border-indigo-500/30 -translate-y-0.5'
                    : ''
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-semibold mt-0.5">
                {tab.label}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-400 hover:text-slate-200"
        >
          <div className="p-1.5 rounded-xl">
            <MoreHorizontal className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-semibold mt-0.5">More</span>
        </button>
      </nav>

      <BottomSheet
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="All BillFlow Modules"
      >
        <div className="grid grid-cols-2 gap-2.5 pb-4">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.view;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.view, item.hint || null);
                  setMoreOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
};

/* ============================================================================
   GLOBAL COMMAND PALETTE (Ctrl + K / Cmd + K)
   ============================================================================ */
interface CommandAction {
  id: string;
  label: string;
  subtitle: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  onExecute: () => void;
}

export const CommandPalette: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: AppView, hint?: SubViewHint) => void;
  onOpenOnboarding: () => void;
}> = ({ isOpen, onClose, onNavigate, onOpenOnboarding }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions: CommandAction[] = [
    {
      id: 'create-invoice',
      label: 'Create GST Tax Invoice',
      subtitle: 'Open sales & invoicing workspace',
      category: 'Quick Actions',
      icon: FileText,
      onExecute: () => onNavigate('invoices', 'invoices'),
    },
    {
      id: 'add-customer',
      label: 'Add Customer / Buyer',
      subtitle: 'Manage receivables & customer khata',
      category: 'Quick Actions',
      icon: UserCheck,
      onExecute: () => onNavigate('parties', 'customers'),
    },
    {
      id: 'add-product',
      label: 'Add Product / Inventory Item',
      subtitle: 'Catalog SKU, HSN, GST & opening stock',
      category: 'Quick Actions',
      icon: Package,
      onExecute: () => onNavigate('inventory', 'products'),
    },
    {
      id: 'create-purchase',
      label: 'Record Purchase Bill',
      subtitle: 'Inward supply & Input Tax Credit (ITC)',
      category: 'Quick Actions',
      icon: ShoppingBag,
      onExecute: () => onNavigate('purchases', 'purchases'),
    },
    {
      id: 'record-expense',
      label: 'Log Operating Expense',
      subtitle: 'Track rent, utilities, salaries & overheads',
      category: 'Quick Actions',
      icon: Receipt,
      onExecute: () => onNavigate('purchases', 'expenses'),
    },
    {
      id: 'open-reports',
      label: 'Open GST & Financial Reports',
      subtitle: 'GSTR-1, GSTR-3B, Profit & Loss, Daybook',
      category: 'Navigation',
      icon: FileSpreadsheet,
      onExecute: () => onNavigate('reports', null),
    },
    {
      id: 'open-dashboard',
      label: 'Go to Executive Dashboard',
      subtitle: '3D KPI command center & live cashflow',
      category: 'Navigation',
      icon: LayoutDashboard,
      onExecute: () => onNavigate('dashboard', null),
    },
    {
      id: 'open-settings',
      label: 'Open Plans & Workspace Settings',
      subtitle: 'Subscription tiers & business onboarding',
      category: 'Navigation',
      icon: Settings,
      onExecute: () => onNavigate('subscriptions', null),
    },
    {
      id: 'onboard-business',
      label: 'Onboard New Business Tenant',
      subtitle: 'Launch 5-step multi-tenant setup wizard',
      category: 'System',
      icon: Sparkles,
      onExecute: () => onOpenOnboarding(),
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filtered.length > 0 ? (prev + 1) % filtered.length : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filtered.length > 0
            ? (prev - 1 + filtered.length) % filtered.length
            : 0
        );
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].onExecute();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-md flex items-start justify-center pt-20 px-4 animate-page-enter"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-xl rounded-3xl border border-indigo-500/30 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center gap-3">
          <Command className="w-4 h-4 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search modules (e.g. Create Invoice, GSTR-1, Inventory)..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No matching commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const active = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    item.onExecute();
                    onClose();
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition ${
                    active
                      ? 'bg-indigo-600/25 border border-indigo-500/40 text-white'
                      : 'text-slate-300 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        active
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] font-mono text-slate-500">
                      {item.category}
                    </span>
                    <ArrowRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        active
                          ? 'text-indigo-400 translate-x-0.5'
                          : 'text-slate-600'
                      }`}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-slate-300 font-mono">↑↓</strong> Navigate
            </span>
            <span>
              <strong className="text-slate-300 font-mono">↵</strong> Execute
            </span>
            <span>
              <strong className="text-slate-300 font-mono">Esc</strong> Close
            </span>
          </div>
          <span>BillFlow Command OS</span>
        </div>
      </div>
    </div>
  );
};
