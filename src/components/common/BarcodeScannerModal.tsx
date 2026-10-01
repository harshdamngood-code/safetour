import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Product Barcode / QR',
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          'qr-code-reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 160 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
          },
          false
        );

        scanner.render(
          (decodedText) => {
            onScanSuccess(decodedText);
            onClose();
          },
          (errorMessage) => {
            // Ignore benign frame recognition skips
          }
        );

        scannerRef.current = scanner;
      } catch (err: any) {
        setCameraError('Camera access not granted or not supported on this device.');
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScanSuccess, onClose]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanSuccess(manualCode.trim());
      onClose();
    }
  };

  return (
    <div id="barcode-scanner-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            id="close-scanner-btn"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {cameraError ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 border border-amber-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Camera Unavailable</p>
                <p className="mt-0.5 text-xs text-amber-700">{cameraError}</p>
                <p className="mt-1 text-xs">You can still enter or scan the barcode manually below.</p>
              </div>
            </div>
          ) : (
            <div id="qr-code-reader" className="w-full overflow-hidden rounded-xl border border-slate-200" />
          )}

          <form onSubmit={handleManualSubmit} className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Or Type / USB Barcode Input</label>
            <div className="flex gap-2">
              <input
                id="manual-barcode-input"
                type="text"
                autoFocus
                placeholder="e.g. 8901234567890"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                id="submit-manual-barcode"
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Apply
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
