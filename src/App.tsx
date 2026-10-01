import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  Navbar,
  SidebarNav,
  MobileBottomNav,
  CommandPalette,
  AppView,
  SubViewHint,
} from './components/layout/Navbar';
import { AuthModal } from './components/auth/AuthModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { PartiesView } from './components/parties/PartiesView';
import { InventoryView } from './components/inventory/InventoryView';
import { InvoicesView } from './components/invoices/InvoicesView';
import { PurchasesDashboard } from './components/purchases/PurchasesDashboard';
import { ReportsDashboard } from './components/reports/ReportsDashboard';
import { ReturnsPage } from './pages/ReturnsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { AdminPlatformPage } from './pages/AdminPlatformPage';
import { PublicInvoiceView } from './pages/PublicInvoiceView';
import { TenantSecurityVerification } from './components/tenancy/TenantSecurityVerification';
import { CreateBusinessModal } from './components/tenancy/CreateBusinessModal';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { syncManager, SyncState } from './lib/offline-sync';
import {
  ToastProvider,
  AmbientBackground3D,
  PageLoader,
  OfflineNotificationBanner,
  SyncIndicator,
  FloatingActionButton,
  EmptyState3D,
} from './components/ui/3d-system';

function DashboardContent() {
  const { isAuthenticated, isLoading, activeBusiness, businesses } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [activeHint, setActiveHint] = useState<SubViewHint>(null);
  const [pageTransitioning, setPageTransitioning] = useState(false);
  const [createBusinessOpen, setCreateBusinessOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('ONLINE');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state, count) => {
      setSyncState(state);
      setPendingSyncCount(count);
    });
    return unsubscribe;
  }, []);

  // Global Ctrl+K / Cmd+K Command Palette shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = useCallback(
    (nextView: AppView, hint: SubViewHint = null) => {
      if (nextView === currentView && hint === activeHint) return;
      setActiveHint(hint);
      if (nextView !== currentView) {
        setPageTransitioning(true);
        setCurrentView(nextView);
        const timer = setTimeout(() => setPageTransitioning(false), 180);
        return () => clearTimeout(timer);
      }
    },
    [currentView, activeHint]
  );

  // Check if viewing a public shared invoice link
  const path = window.location.pathname;
  if (path.startsWith('/public/invoice/')) {
    const token = path.replace('/public/invoice/', '').trim();
    return <PublicInvoiceView token={token} />;
  }

  if (isLoading) {
    return (
      <PageLoader
        fullScreen
        label="Initializing BillFlow Commercial Operating System..."
      />
    );
  }

  if (!isAuthenticated) {
    return <AuthModal />;
  }

  // If user has no active businesses, prompt onboarding
  const hasNoBusinesses = businesses.length === 0 && !activeBusiness;

  return (
    <div className="relative min-h-screen bg-[#060913] text-slate-100 flex flex-col">
      <AmbientBackground3D />

      <Navbar
        currentView={currentView}
        activeHint={activeHint}
        onChangeView={handleNavigate}
        onOpenCreateBusiness={() => setCreateBusinessOpen(true)}
        onOpenOnboarding={() => setOnboardingOpen(true)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <div className="relative z-10 flex-1 flex min-h-0">
        {/* Animated Desktop 3D Sidebar */}
        {!hasNoBusinesses && (
          <SidebarNav
            currentView={currentView}
            activeHint={activeHint}
            onSelect={handleNavigate}
          />
        )}

        {/* Main Workspace Viewport */}
        <main className="flex-1 min-w-0 max-w-[1440px] w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10">
          {hasNoBusinesses ? (
            <div className="max-w-xl mx-auto my-12 glass-panel rounded-3xl p-8 border border-indigo-500/25 shadow-2xl">
              <EmptyState3D
                title="No Business Workspace Provisioned"
                description="Welcome to BillFlow! Complete the 5-step guided setup to initialize your GST invoicing series, inventory ledger, and financial dashboard."
                actionLabel="Start Business Onboarding"
                onAction={() => setOnboardingOpen(true)}
                icon="invoice"
              />
            </div>
          ) : pageTransitioning ? (
            <PageLoader label="Loading module..." />
          ) : (
            <div key={`${currentView}-${activeHint || ''}`} className="animate-page-enter">
              {currentView === 'dashboard' ? (
                <DashboardView
                  onOpenOnboarding={() => setOnboardingOpen(true)}
                  onNavigate={handleNavigate}
                />
              ) : currentView === 'invoices' ? (
                <InvoicesView initialHint={activeHint} />
              ) : currentView === 'purchases' ? (
                <PurchasesDashboard initialHint={activeHint} />
              ) : currentView === 'parties' ? (
                <PartiesView initialHint={activeHint} />
              ) : currentView === 'inventory' ? (
                <InventoryView initialHint={activeHint} />
              ) : currentView === 'returns' ? (
                <ReturnsPage />
              ) : currentView === 'reports' ? (
                <ReportsDashboard />
              ) : currentView === 'subscriptions' ? (
                <SubscriptionsPage />
              ) : currentView === 'admin' ? (
                <AdminPlatformPage />
              ) : (
                <TenantSecurityVerification />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Quiet Enterprise Footer */}
      <footer className="relative z-10 border-t border-slate-900/90 bg-[#060913]/90 py-3.5 text-xs text-slate-500 pb-20 lg:pb-3.5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span>
              BillFlow &copy; {new Date().getFullYear()} · Commercial Billing &amp; GST Accounting Platform
            </span>
            <SyncIndicator
              state={syncState}
              pendingCount={pendingSyncCount}
              onRetry={() => syncManager.retryAll()}
            />
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span>Press</span>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-indigo-300 hover:border-indigo-500/40"
            >
              Ctrl + K
            </button>
            <span>for Command Palette</span>
          </div>
        </div>
      </footer>

      {/* Non-Intrusive Offline / Back-Online Notification */}
      <OfflineNotificationBanner
        syncState={syncState}
        pendingCount={pendingSyncCount}
      />

      {/* Mobile Floating Action Button (+ Invoice) & Bottom Nav */}
      {!hasNoBusinesses && (
        <>
          <FloatingActionButton
            onClick={() => handleNavigate('invoices', 'invoices')}
          />
          <MobileBottomNav
            currentView={currentView}
            onSelect={handleNavigate}
          />
        </>
      )}

      {/* Global Ctrl+K Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onOpenOnboarding={() => setOnboardingOpen(true)}
      />

      {/* Create Business Modal */}
      <CreateBusinessModal
        isOpen={createBusinessOpen}
        onClose={() => setCreateBusinessOpen(false)}
      />

      {/* 5-Step Full Onboarding Wizard */}
      <OnboardingWizard
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onSuccess={() => {
          setCurrentView('dashboard');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DashboardContent />
      </ToastProvider>
    </AuthProvider>
  );
}
