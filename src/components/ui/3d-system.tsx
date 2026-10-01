import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useCallback,
} from 'react';
import {
  Check,
  AlertTriangle,
  Info,
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  Sparkles,
  FileText,
  Package,
  Users,
  BarChart3,
} from 'lucide-react';
import { SyncState } from '../../lib/offline-sync';

/* ============================================================================
   1. REDUCED MOTION & PERFORMANCE HOOK
   ============================================================================ */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/* ============================================================================
   2. 3D TILT CARD (5-7 deg max cursor-responsive perspective tilt + spotlight)
   ============================================================================ */
interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glowColor?: 'indigo' | 'emerald' | 'cyan' | 'amber' | 'rose' | 'violet';
  onClick?: () => void;
  disableTilt?: boolean;
}

const GLOW_MAP: Record<string, string> = {
  indigo: 'rgba(99, 102, 241, 0.16)',
  emerald: 'rgba(16, 185, 129, 0.16)',
  cyan: 'rgba(6, 182, 212, 0.16)',
  amber: 'rgba(245, 158, 11, 0.16)',
  rose: 'rgba(244, 63, 94, 0.16)',
  violet: 'rgba(139, 92, 246, 0.16)',
};

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  maxTilt = 6,
  glowColor = 'indigo',
  onClick,
  disableTilt = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [transformStyle, setTransformStyle] = useState(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  );
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || disableTilt || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Subtle rotation clamped between -maxTilt and +maxTilt degrees
    const rotateX = Math.max(
      -maxTilt,
      Math.min(maxTilt, ((centerY - y) / centerY) * maxTilt)
    );
    const rotateY = Math.max(
      -maxTilt,
      Math.min(maxTilt, ((x - centerX) / centerX) * maxTilt)
    );

    setTransformStyle(
      `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-3px) scale3d(1.01, 1.01, 1.01)`
    );
    setSpotlight({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100),
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setTransformStyle(
      'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1, 1, 1)'
    );
    setSpotlight((prev) => ({ ...prev, opacity: 0 }));
  };

  const glowRgba = GLOW_MAP[glowColor] || GLOW_MAP.indigo;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: transformStyle,
        transition:
          spotlight.opacity > 0
            ? 'transform 90ms ease-out'
            : 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform',
      }}
      className={`relative overflow-hidden rounded-2xl glass-panel-interactive ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Dynamic Cursor Light Reflection */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: spotlight.opacity,
          background: `radial-gradient(360px circle at ${spotlight.x}% ${spotlight.y}%, ${glowRgba}, transparent 75%)`,
        }}
      />
      {/* Top Rim Highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export const ThreeDCard = TiltCard;

/* ============================================================================
   3. GLASS CARD
   ============================================================================ */
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  interactive = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl ${
        interactive
          ? 'glass-panel-interactive hover:-translate-y-0.5 cursor-pointer'
          : 'glass-panel'
      } ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />
      {children}
    </div>
  );
};

/* ============================================================================
   4. ANIMATED NUMBER COUNTER (Animates ONCE when entering viewport)
   ============================================================================ */
interface AnimatedNumberProps {
  value: number;
  currency?: string;
  isCurrency?: boolean;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  currency = 'INR',
  isCurrency = false,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 750,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const elementRef = useRef<HTMLSpanElement>(null);
  const hasAnimatedRef = useRef(false);
  const prevTargetRef = useRef<number>(value);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const safeVal = Number.isFinite(value) ? value : 0;
    if (reducedMotion) {
      setDisplayValue(safeVal);
      return;
    }

    // Animate on initial viewport intersection or when value changes after load
    const animateValue = (from: number, to: number) => {
      if (from === to) {
        setDisplayValue(to);
        return;
      }
      const startTime = performance.now();
      let rafId: number;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Cubic ease-out
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + (to - from) * eased;
        setDisplayValue(current);
        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          setDisplayValue(to);
        }
      };

      rafId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(rafId);
    };

    if (!hasAnimatedRef.current) {
      const el = elementRef.current;
      if (!el || typeof IntersectionObserver === 'undefined') {
        hasAnimatedRef.current = true;
        prevTargetRef.current = safeVal;
        return animateValue(0, safeVal);
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            prevTargetRef.current = safeVal;
            animateValue(0, safeVal);
            observer.disconnect();
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(el);
      return () => observer.disconnect();
    } else if (prevTargetRef.current !== safeVal) {
      const from = prevTargetRef.current;
      prevTargetRef.current = safeVal;
      return animateValue(from, safeVal);
    }
  }, [value, duration, reducedMotion]);

  const formatted = React.useMemo(() => {
    const num = Number.isFinite(displayValue) ? displayValue : 0;
    if (isCurrency) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      }).format(num);
    }
    return num.toLocaleString('en-IN', {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    });
  }, [displayValue, isCurrency, currency, decimals]);

  return (
    <span ref={elementRef} className={`tabular-nums font-mono ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

/* ============================================================================
   5. 3D GEOMETRIC CUBE LOADER & PAGE LOADER
   ============================================================================ */
interface Cube3DLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const Cube3DLoader: React.FC<Cube3DLoaderProps> = ({
  size = 'md',
  label,
}) => {
  const px = size === 'sm' ? 22 : size === 'lg' ? 44 : 32;
  const half = px / 2;

  return (
    <div
      className="inline-flex flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <div
        className="perspective-1000 relative flex items-center justify-center"
        style={{ width: px * 1.5, height: px * 1.5 }}
      >
        {/* Ambient Glow Behind Cube */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-indigo-500/25 blur-md"
        />
        <div
          className="animate-cube-3d relative"
          style={{ width: px, height: px }}
        >
          {/* 6 Translucent 3D Faces */}
          <div
            className="absolute inset-0 border border-indigo-400/60 bg-indigo-500/20 backdrop-blur-xs"
            style={{ transform: `rotateY(0deg) translateZ(${half}px)` }}
          />
          <div
            className="absolute inset-0 border border-cyan-400/60 bg-cyan-500/20 backdrop-blur-xs"
            style={{ transform: `rotateY(180deg) translateZ(${half}px)` }}
          />
          <div
            className="absolute inset-0 border border-emerald-400/60 bg-emerald-500/20 backdrop-blur-xs"
            style={{ transform: `rotateY(90deg) translateZ(${half}px)` }}
          />
          <div
            className="absolute inset-0 border border-violet-400/60 bg-violet-500/20 backdrop-blur-xs"
            style={{ transform: `rotateY(-90deg) translateZ(${half}px)` }}
          />
          <div
            className="absolute inset-0 border border-indigo-300/60 bg-indigo-400/25"
            style={{ transform: `rotateX(90deg) translateZ(${half}px)` }}
          />
          <div
            className="absolute inset-0 border border-slate-400/40 bg-slate-800/40"
            style={{ transform: `rotateX(-90deg) translateZ(${half}px)` }}
          />
        </div>
      </div>
      {label && (
        <span className="text-xs font-medium tracking-wide text-slate-300">
          {label}
        </span>
      )}
    </div>
  );
};

export const PageLoader: React.FC<{ label?: string; fullScreen?: boolean }> = ({
  label = 'Synchronizing Workspace...',
  fullScreen = false,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center ${
        fullScreen ? 'min-h-screen bg-[#060913]' : 'py-16'
      } animate-page-enter`}
    >
      <div className="glass-panel px-8 py-6 rounded-3xl flex flex-col items-center gap-3 border border-indigo-500/20 shadow-2xl">
        <Cube3DLoader size="md" />
        <p className="text-xs font-semibold text-slate-300 tracking-wide mt-1">
          {label}
        </p>
      </div>
    </div>
  );
};

export const ButtonLoader: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <span
    className={`relative inline-flex items-center justify-center w-4 h-4 ${className}`}
    aria-hidden="true"
  >
    <span className="absolute inset-0 rounded-full border-2 border-current opacity-25" />
    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
  </span>
);

/* ============================================================================
   6. ANIMATED ASYNC BUTTON (Idle -> 3D Spinner -> ✓ Success -> Idle)
   ============================================================================ */
interface AnimatedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  success?: boolean;
  successText?: string;
  variant?: 'primary' | 'emerald' | 'amber' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  loading = false,
  loadingText = 'Processing...',
  success = false,
  successText = 'Completed',
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  className = '',
  ...rest
}) => {
  const variantClasses: Record<string, string> = {
    primary:
      'bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30',
    emerald:
      'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 border border-emerald-400/30',
    amber:
      'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-600/25 border border-amber-400/30',
    secondary:
      'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80',
    danger:
      'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30',
  };

  const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-xl',
    md: 'px-4 py-2 text-xs rounded-xl',
    lg: 'px-5 py-2.5 text-sm rounded-xl',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <>
          <ButtonLoader />
          <span>{loadingText}</span>
        </>
      ) : success ? (
        <>
          <svg
            className="w-4 h-4 text-emerald-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              className="animate-check-draw"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>{successText}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};

/* ============================================================================
   7. INVOICE STAGED PROGRESS OVERLAY
   ============================================================================ */
export const INVOICE_STAGES = [
  'Preparing invoice',
  'Calculating taxes',
  'Updating inventory',
  'Saving invoice',
  'Generating PDF',
  'Complete',
] as const;

export const InvoiceProgressOverlay: React.FC<{
  active: boolean;
  currentStageIndex: number;
}> = ({ active, currentStageIndex }) => {
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-page-enter">
      <div className="glass-panel max-w-md w-full rounded-3xl p-6 border border-indigo-500/30 shadow-2xl space-y-5">
        <div className="flex items-center gap-4">
          <Cube3DLoader size="sm" />
          <div>
            <h3 className="text-sm font-bold text-white">
              Processing Commercial Document
            </h3>
            <p className="text-xs text-slate-400">
              Executing atomic ledger &amp; inventory transactions
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {INVOICE_STAGES.map((stage, idx) => {
            const isDone = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            return (
              <div
                key={stage}
                className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-xs transition-all ${
                  isCurrent
                    ? 'bg-indigo-500/15 border border-indigo-500/40 text-white font-bold'
                    : isDone
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-slate-900/40 text-slate-500'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {isDone ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-black">
                      ✓
                    </span>
                  ) : isCurrent ? (
                    <ButtonLoader className="text-indigo-400" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                  )}
                  {stage}
                </span>
                {isDone && (
                  <span className="text-[10px] font-mono text-emerald-400">
                    Verified
                  </span>
                )}
                {isCurrent && (
                  <span className="text-[10px] font-mono text-indigo-300">
                    In Progress
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   8. 3D SYNC INDICATOR & OFFLINE NOTIFICATION BANNER
   ============================================================================ */
export const SyncIndicator: React.FC<{
  state: SyncState;
  pendingCount?: number;
  onRetry?: () => void;
}> = ({ state, pendingCount = 0, onRetry }) => {
  return (
    <div
      onClick={state === 'SYNC_ERROR' && onRetry ? onRetry : undefined}
      title={
        state === 'OFFLINE'
          ? `Offline Mode (${pendingCount} queued changes)`
          : state === 'SYNCING'
          ? 'Synchronizing changes with cloud...'
          : state === 'SYNC_ERROR'
          ? 'Sync error — click to retry'
          : 'All business ledgers synchronized'
      }
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all whitespace-nowrap ${
        state === 'OFFLINE'
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          : state === 'SYNCING'
          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
          : state === 'SYNC_ERROR'
          ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 cursor-pointer hover:bg-rose-500/25'
          : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
      }`}
    >
      {state === 'OFFLINE' ? (
        <>
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Offline{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </span>
        </>
      ) : state === 'SYNCING' ? (
        <>
          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
            <span className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-indigo-400 border-t-transparent" />
          </span>
          <span>Syncing...</span>
        </>
      ) : state === 'SYNC_ERROR' ? (
        <>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>Sync Error</span>
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span>Synced</span>
        </>
      )}
    </div>
  );
};

export const OfflineNotificationBanner: React.FC<{
  syncState: SyncState;
  pendingCount: number;
}> = ({ syncState, pendingCount }) => {
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerType, setBannerType] = useState<'offline' | 'syncing' | 'synced'>(
    'offline'
  );
  const prevSyncRef = useRef<SyncState>(syncState);

  useEffect(() => {
    const prev = prevSyncRef.current;
    prevSyncRef.current = syncState;

    if (syncState === 'OFFLINE') {
      setBannerType('offline');
      setBannerMessage("You're offline — changes will sync automatically.");
      return;
    }

    if (prev === 'OFFLINE' && (syncState === 'ONLINE' || syncState === 'SYNCING')) {
      setBannerType('syncing');
      setBannerMessage(
        pendingCount > 0 ? 'Back online — Syncing changes...' : 'Back online'
      );
      const timer = setTimeout(() => {
        setBannerType('synced');
        setBannerMessage('All changes synced');
        setTimeout(() => setBannerMessage(null), 2500);
      }, 1500);
      return () => clearTimeout(timer);
    }

    if (prev === 'SYNCING' && syncState === 'SYNCED') {
      setBannerType('synced');
      setBannerMessage('All changes synced');
      const timer = setTimeout(() => setBannerMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [syncState, pendingCount]);

  if (!bannerMessage) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-page-enter">
      <div
        className={`pointer-events-auto px-4 py-2.5 rounded-2xl glass-panel border shadow-2xl flex items-center gap-2.5 text-xs font-semibold ${
          bannerType === 'offline'
            ? 'border-amber-500/40 text-amber-200'
            : bannerType === 'syncing'
            ? 'border-indigo-500/40 text-indigo-200'
            : 'border-emerald-500/40 text-emerald-200'
        }`}
      >
        {bannerType === 'offline' ? (
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
        ) : bannerType === 'syncing' ? (
          <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
        ) : (
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
        <span>{bannerMessage}</span>
      </div>
    </div>
  );
};

/* ============================================================================
   9. TOAST NOTIFICATION SYSTEM
   ============================================================================ */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (type: ToastType, title: string, description?: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed top-20 right-4 z-[80] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto glass-panel p-3.5 rounded-2xl border shadow-2xl flex items-start gap-3 animate-page-enter ${
              t.type === 'success'
                ? 'border-emerald-500/35'
                : t.type === 'error'
                ? 'border-rose-500/40'
                : t.type === 'warning'
                ? 'border-amber-500/40'
                : 'border-indigo-500/35'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                t.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : t.type === 'error'
                  ? 'bg-rose-500/20 text-rose-400'
                  : t.type === 'warning'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-indigo-500/20 text-indigo-400'
              }`}
            >
              {t.type === 'success' ? (
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    className="animate-check-draw"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : t.type === 'error' || t.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Info className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white">{t.title}</div>
              {t.description && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {t.description}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-500 hover:text-slate-300 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/* ============================================================================
   10. SKELETON LOADERS (KPI, Table, Chart)
   ============================================================================ */
export const SkeletonLoader: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className = '', style }) => (
  <div
    style={style}
    className={`relative overflow-hidden bg-slate-800/60 rounded-xl ${className}`}
  >
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
  </div>
);

export const KPISkeletonGrid: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="glass-panel rounded-2xl p-5 space-y-3 border border-slate-800/80"
      >
        <div className="flex items-center justify-between">
          <SkeletonLoader className="h-3.5 w-24" />
          <SkeletonLoader className="h-9 w-9 rounded-xl" />
        </div>
        <SkeletonLoader className="h-7 w-36" />
        <SkeletonLoader className="h-3 w-44" />
      </div>
    ))}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 6,
}) => (
  <div className="space-y-2.5 p-4">
    {Array.from({ length: rows }).map((_, r) => (
      <div
        key={r}
        className="grid gap-3 items-center py-2 border-b border-slate-800/40"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((__, c) => (
          <SkeletonLoader key={c} className="h-4 w-full" />
        ))}
      </div>
    ))}
  </div>
);

export const ChartSkeleton: React.FC<{ height?: string }> = ({
  height = 'h-64',
}) => (
  <div
    className={`w-full ${height} flex items-end gap-3 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50`}
  >
    {[45, 70, 55, 85, 60, 95, 75, 65].map((pct, i) => (
      <div key={i} className="flex-1 flex flex-col justify-end h-full">
        <SkeletonLoader
          className="w-full rounded-t-lg"
          style={{ height: `${pct}%` } as any}
        />
      </div>
    ))}
  </div>
);

/* ============================================================================
   11. 3D EMPTY STATE ILLUSTRATION
   ============================================================================ */
interface EmptyState3DProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: 'invoice' | 'product' | 'customer' | 'report';
}

export const EmptyState3D: React.FC<EmptyState3DProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'invoice',
}) => {
  const IconComp =
    icon === 'product'
      ? Package
      : icon === 'customer'
      ? Users
      : icon === 'report'
      ? BarChart3
      : FileText;

  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
      <div className="perspective-1000 mb-5">
        <div className="animate-float-subtle relative w-20 h-20 rounded-3xl glass-panel border border-indigo-500/30 flex items-center justify-center shadow-2xl shadow-indigo-950/60">
          <div
            aria-hidden="true"
            className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-cyan-500/10 to-emerald-500/20 blur-xl -z-10"
          />
          <IconComp className="w-9 h-9 text-indigo-400" />
          <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-lg">
            +
          </div>
        </div>
      </div>
      <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <AnimatedButton
          onClick={onAction}
          variant="primary"
          size="md"
          icon={<Plus className="w-3.5 h-3.5" />}
          className="mt-4"
        >
          {actionLabel}
        </AnimatedButton>
      )}
    </div>
  );
};

/* ============================================================================
   12. 3D LAYERED PROFIT VISUALIZATION
   ============================================================================ */
interface ProfitVisualization3DProps {
  revenue: number;
  purchases: number;
  expenses: number;
  netProfit: number;
  marginPct: number;
  formatCurrency: (val: number) => string;
}

export const ProfitVisualization3D: React.FC<ProfitVisualization3DProps> = ({
  revenue,
  purchases,
  expenses,
  netProfit,
  marginPct,
  formatCurrency,
}) => {
  const maxVal = Math.max(revenue, purchases + expenses, Math.abs(netProfit), 1);
  const revPct = Math.min(100, Math.max(6, Math.round((revenue / maxVal) * 100)));
  const purPct = Math.min(
    100,
    Math.max(6, Math.round((purchases / maxVal) * 100))
  );
  const expPct = Math.min(
    100,
    Math.max(6, Math.round((expenses / maxVal) * 100))
  );
  const profPct = Math.min(
    100,
    Math.max(6, Math.round((Math.abs(netProfit) / maxVal) * 100))
  );

  const layers = [
    {
      label: 'Gross Revenue',
      amount: revenue,
      pct: revPct,
      barClass: 'from-emerald-500 via-teal-400 to-cyan-400',
      glowClass: 'shadow-emerald-500/25',
      textClass: 'text-emerald-400',
    },
    {
      label: 'Inward Purchases',
      amount: purchases,
      pct: purPct,
      barClass: 'from-blue-500 via-indigo-500 to-violet-500',
      glowClass: 'shadow-blue-500/25',
      textClass: 'text-blue-400',
    },
    {
      label: 'Operating Expenses',
      amount: expenses,
      pct: expPct,
      barClass: 'from-amber-500 to-orange-500',
      glowClass: 'shadow-amber-500/25',
      textClass: 'text-amber-400',
    },
    {
      label: netProfit >= 0 ? 'Net Profit Retained' : 'Net Deficit',
      amount: netProfit,
      pct: profPct,
      barClass:
        netProfit >= 0
          ? 'from-indigo-500 via-violet-500 to-emerald-400'
          : 'from-rose-500 to-orange-500',
      glowClass:
        netProfit >= 0 ? 'shadow-indigo-500/25' : 'shadow-rose-500/25',
      textClass: netProfit >= 0 ? 'text-indigo-300' : 'text-rose-400',
    },
  ];

  return (
    <GlassCard className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            3D Capital Flow &amp; Profit Architecture
          </h2>
          <p className="text-xs text-slate-400">
            Layered depth breakdown of revenue inflow vs cost structure
          </p>
        </div>
        <div className="text-xs font-mono text-slate-300">
          Net Margin:{' '}
          <span
            className={`font-bold ${
              marginPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {marginPct >= 0 ? '+' : ''}
            {marginPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {layers.map((layer) => (
          <div key={layer.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">{layer.label}</span>
              <span className={`font-mono font-bold tabular-nums ${layer.textClass}`}>
                {formatCurrency(layer.amount)}
              </span>
            </div>
            {/* 3D Depth Track */}
            <div className="relative h-3.5 w-full rounded-xl bg-slate-950/90 border border-slate-800/80 p-0.5 overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-lg bg-gradient-to-r ${layer.barClass} shadow-lg ${layer.glowClass} transition-all duration-700 ease-out relative`}
                style={{ width: `${layer.pct}%` }}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-white/25 rounded-t-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

/* ============================================================================
   13. AMBIENT 3D BACKGROUND
   ============================================================================ */
export const AmbientBackground3D: React.FC = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
  >
    {/* Top Left Electric Blue / Indigo Soft Light Orb */}
    <div className="absolute -top-48 -left-48 w-[520px] h-[520px] rounded-full bg-indigo-600/[0.07] blur-[130px]" />
    {/* Top Right Cyan / Emerald Soft Light Orb */}
    <div className="absolute top-1/4 -right-48 w-[460px] h-[460px] rounded-full bg-emerald-500/[0.05] blur-[130px]" />
    {/* Bottom Violet Depth Orb */}
    <div className="absolute -bottom-64 left-1/3 w-[560px] h-[560px] rounded-full bg-violet-600/[0.05] blur-[140px]" />
    {/* Subtle Perspective Grid */}
    <div
      className="absolute inset-0 opacity-[0.025]"
      style={{
        backgroundImage:
          'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
        backgroundSize: '56px 56px',
      }}
    />
  </div>
);

/* ============================================================================
   14. MOBILE BOTTOM SHEET & FLOATING ACTION BUTTON
   ============================================================================ */
export const BottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[75] flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-page-enter">
      <div className="flex-1" onClick={onClose} />
      <div className="glass-panel rounded-t-3xl border-t border-slate-700/80 p-5 max-h-[82vh] overflow-y-auto shadow-2xl space-y-4">
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto" />
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export const FloatingActionButton: React.FC<{
  onClick: () => void;
  label?: string;
}> = ({ onClick, label = 'Create Invoice' }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className="md:hidden fixed right-4 bottom-20 z-40 h-12 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/40 border border-white/20 flex items-center gap-2 active:scale-95 transition-transform"
  >
    <Plus className="w-4 h-4 stroke-[2.5]" />
    <span>Invoice</span>
  </button>
);
