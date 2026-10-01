import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { X, Printer, Download } from 'lucide-react';

interface BarcodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  barcodeValue: string;
  price?: number;
  sku?: string;
}

export const BarcodeGeneratorModal: React.FC<BarcodeGeneratorModalProps> = ({
  isOpen,
  onClose,
  productName,
  barcodeValue,
  price,
  sku,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (isOpen && svgRef.current && barcodeValue) {
      try {
        JsBarcode(svgRef.current, barcodeValue, {
          format: 'CODE128',
          lineColor: '#0f172a',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
        });
      } catch (err) {
        console.error('[JsBarcode generation error]:', err);
      }
    }
  }, [isOpen, barcodeValue]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svgHtml = svgRef.current?.outerHTML || '';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode - ${productName}</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
            .label-card { border: 1px dashed #94a3b8; padding: 12px; border-radius: 8px; text-align: center; width: 220px; }
            .prod-title { font-size: 12px; font-weight: bold; margin-bottom: 4px; }
            .prod-meta { font-size: 11px; margin-top: 4px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="prod-title">${productName}</div>
            ${svgHtml}
            ${price ? `<div class="prod-meta">MRP: ₹${price.toFixed(2)}</div>` : ''}
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div id="barcode-generator-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">Product Barcode Label</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 text-center">
          <div className="mx-auto flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6">
            <p className="font-semibold text-slate-900 text-sm">{productName}</p>
            {sku && <p className="text-xs text-slate-500 mb-2">SKU: {sku}</p>}
            <svg ref={svgRef} className="max-w-full my-2" />
            {price && <p className="text-sm font-bold text-slate-900 mt-1">MRP: ₹{price.toFixed(2)}</p>}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Print Label
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
