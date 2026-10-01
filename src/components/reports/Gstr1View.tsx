import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  Table,
  Layers,
  ArrowDownToLine,
  Hash,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Gstr1Response } from '../../types/reports.types';

interface Gstr1ViewProps {
  selectedMonth: string;
}

export const Gstr1View: React.FC<Gstr1ViewProps> = ({ selectedMonth }) => {
  const { activeBusiness } = useAuth();

  const [data, setData] = useState<Gstr1Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'b2b' | 'b2cs' | 'hsn' | 'docs'>('b2b');

  useEffect(() => {
    if (!activeBusiness) return;

    const fetchGstr1 = async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await api.get<Gstr1Response>(`/reports/gstr-1?month=${selectedMonth}`);
        if (!json.success) {
          throw new Error(json.message || 'Failed to generate GSTR-1');
        }

        setData(json.data);
      } catch (err: any) {
        setError(err.message || 'Error loading GSTR-1');
      } finally {
        setLoading(false);
      }
    };

    fetchGstr1();
  }, [activeBusiness, selectedMonth]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Compiling Government-compliant GSTR-1 outward returns...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span>{error || 'Failed to load return'}</span>
      </div>
    );
  }

  const exportGstr1Json = () => {
    // Government GST Portal standard payload
    const exportPayload = {
      gstin: data.business.gstin || activeBusiness?.gstin || '',
      fp: selectedMonth.replace('-', ''), // e.g. "092026"
      version: 'GSTR1_3.0',
      cur_gt: data.summary.total_invoice_value,
      b2b: data.tables.b2b.map((inv) => ({
        ctin: inv.customer_gstin,
        inv: [
          {
            inum: inv.invoice_number,
            idt: inv.invoice_date.split('-').reverse().join('-'), // DD-MM-YYYY
            val: inv.invoice_value,
            pos: inv.place_of_supply,
            rchrg: 'N',
            inv_typ: 'R',
            itms: [
              {
                num: 1,
                itm_det: {
                  txval: inv.taxable_value,
                  rt: inv.total_tax > 0 ? (inv.total_tax / inv.taxable_value) * 100 : 0,
                  iamt: inv.igst,
                  camt: inv.cgst,
                  samt: inv.sgst,
                  csamt: 0,
                },
              },
            ],
          },
        ],
      })),
      hsn: {
        data: data.tables.hsn.map((h, idx) => ({
          num: idx + 1,
          hsn_sc: h.hsn_code,
          desc: h.description,
          uqc: h.unit,
          qty: h.total_quantity,
          val: h.total_value,
          txval: h.taxable_value,
          iamt: h.igst,
          camt: h.cgst,
          samt: h.sgst,
          csamt: 0,
        })),
      },
      doc_issue: {
        doc_det: [
          {
            doc_num: 1,
            docs: data.tables.doc_issued.map((d) => ({
              num: 1,
              from: d.from_serial_no,
              to: d.to_serial_no,
              totnum: d.total_number,
              canc: d.cancelled_number,
              net_issue: d.net_issued,
            })),
          },
        ],
      },
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${data.business.gstin || 'BUSINESS'}_${selectedMonth}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Action and Legal Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">GSTR-1: Outward Supplies Return</h3>
            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded font-mono font-bold text-[10px]">
              Period: {selectedMonth}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            GSTIN: <span className="font-mono text-slate-200">{data.business.gstin || 'Not Configured'}</span> • State:{' '}
            <span className="text-slate-200">{data.business.state} ({data.business.state_code})</span>
          </p>
        </div>

        <button
          onClick={exportGstr1Json}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20 text-xs self-start sm:self-auto"
        >
          <ArrowDownToLine className="w-4 h-4" />
          Export GST Portal JSON
        </button>
      </div>

      {/* Overview Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Total Invoices</span>
          <p className="text-xl font-bold text-white mt-1 font-mono">{data.summary.total_invoices}</p>
          <span className="text-[10px] text-slate-500">
            {data.summary.b2b_count} B2B + {data.summary.b2c_small_count} B2C
          </span>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Total Taxable Value</span>
          <p className="text-xl font-bold text-slate-200 mt-1 font-mono">
            ₹{data.summary.total_taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Total Output GST</span>
          <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">
            ₹{data.summary.total_tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-500">
            C: ₹{data.summary.total_cgst.toFixed(0)} | S: ₹{data.summary.total_sgst.toFixed(0)} | I: ₹{data.summary.total_igst.toFixed(0)}
          </span>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Total Invoice Value</span>
          <p className="text-xl font-bold text-indigo-400 mt-1 font-mono">
            ₹{data.summary.total_invoice_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Table Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('b2b')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeSubTab === 'b2b' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          Table 4: B2B Invoices ({data.tables.b2b.length})
        </button>

        <button
          onClick={() => setActiveSubTab('b2cs')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeSubTab === 'b2cs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Table 7: B2C Small ({data.tables.b2c_small.length})
        </button>

        <button
          onClick={() => setActiveSubTab('hsn')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeSubTab === 'hsn' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          Table 12: HSN Summary ({data.tables.hsn.length})
        </button>

        <button
          onClick={() => setActiveSubTab('docs')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
            activeSubTab === 'docs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Table 13: Documents Issued
        </button>
      </div>

      {/* Subtab Contents */}
      {activeSubTab === 'b2b' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-slate-200">
              4A, 4B, 6B, 6C - B2B Invoices (Registered Customer Supplies)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-2.5">GSTIN of Buyer</th>
                  <th className="p-2.5">Buyer Name</th>
                  <th className="p-2.5">Invoice No</th>
                  <th className="p-2.5">Invoice Date</th>
                  <th className="p-2.5">POS</th>
                  <th className="p-2.5 text-right">Taxable Value (₹)</th>
                  <th className="p-2.5 text-right">CGST (₹)</th>
                  <th className="p-2.5 text-right">SGST (₹)</th>
                  <th className="p-2.5 text-right">IGST (₹)</th>
                  <th className="p-2.5 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {data.tables.b2b.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-500 font-sans">
                      No B2B invoices recorded in this period.
                    </td>
                  </tr>
                ) : (
                  data.tables.b2b.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-indigo-400 font-bold">{inv.customer_gstin}</td>
                      <td className="p-2.5 font-sans text-slate-200">{inv.customer_name}</td>
                      <td className="p-2.5 text-white font-bold">{inv.invoice_number}</td>
                      <td className="p-2.5 text-slate-400 font-sans">{inv.invoice_date}</td>
                      <td className="p-2.5 text-slate-300 font-sans">{inv.place_of_supply}</td>
                      <td className="p-2.5 text-right text-slate-200">₹{inv.taxable_value.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-emerald-400">₹{inv.cgst.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-emerald-400">₹{inv.sgst.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-amber-400">₹{inv.igst.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-white font-bold">₹{inv.invoice_value.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'b2cs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-3 bg-slate-950/60 border-b border-slate-800">
            <span className="font-bold text-slate-200">
              7 - B2C (Small) Details (Grouped by Place of Supply &amp; GST Rate)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-2.5">Place of Supply (State)</th>
                  <th className="p-2.5 text-center">Rate (%)</th>
                  <th className="p-2.5 text-right">Taxable Value (₹)</th>
                  <th className="p-2.5 text-right">Central Tax (CGST)</th>
                  <th className="p-2.5 text-right">State Tax (SGST)</th>
                  <th className="p-2.5 text-right">Integrated Tax (IGST)</th>
                  <th className="p-2.5 text-right">Total Invoice Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {data.tables.b2c_small.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500 font-sans">
                      No B2C small transactions in this period.
                    </td>
                  </tr>
                ) : (
                  data.tables.b2c_small.map((grp, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-sans font-semibold text-slate-200">{grp.pos}</td>
                      <td className="p-2.5 text-center text-slate-300">{grp.tax_rate}%</td>
                      <td className="p-2.5 text-right text-slate-200">₹{grp.taxable_value.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-emerald-400">₹{grp.cgst.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-emerald-400">₹{grp.sgst.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-amber-400">₹{grp.igst.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-white font-bold">₹{grp.total.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'hsn' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-3 bg-slate-950/60 border-b border-slate-800">
            <span className="font-bold text-slate-200">12 - HSN-wise Summary of Outward Supplies</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-2.5">HSN Code</th>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5 text-center">UQC</th>
                  <th className="p-2.5 text-center">Total Qty</th>
                  <th className="p-2.5 text-right">Taxable Value (₹)</th>
                  <th className="p-2.5 text-right">CGST (₹)</th>
                  <th className="p-2.5 text-right">SGST (₹)</th>
                  <th className="p-2.5 text-right">IGST (₹)</th>
                  <th className="p-2.5 text-right">Total Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {data.tables.hsn.map((h, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="p-2.5 text-indigo-400 font-bold">{h.hsn_code}</td>
                    <td className="p-2.5 font-sans text-slate-200">{h.description}</td>
                    <td className="p-2.5 text-center text-slate-400">{h.unit}</td>
                    <td className="p-2.5 text-center text-slate-200 font-bold">{h.total_quantity}</td>
                    <td className="p-2.5 text-right text-slate-200">₹{h.taxable_value.toFixed(2)}</td>
                    <td className="p-2.5 text-right text-emerald-400">₹{h.cgst.toFixed(2)}</td>
                    <td className="p-2.5 text-right text-emerald-400">₹{h.sgst.toFixed(2)}</td>
                    <td className="p-2.5 text-right text-amber-400">₹{h.igst.toFixed(2)}</td>
                    <td className="p-2.5 text-right text-white font-bold">₹{h.total_value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'docs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-3 bg-slate-950/60 border-b border-slate-800">
            <span className="font-bold text-slate-200">13 - Documents Issued During Tax Period</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-2.5">Nature of Document</th>
                  <th className="p-2.5">From Serial No</th>
                  <th className="p-2.5">To Serial No</th>
                  <th className="p-2.5 text-center">Total Number</th>
                  <th className="p-2.5 text-center">Cancelled</th>
                  <th className="p-2.5 text-center font-bold text-white">Net Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {data.tables.doc_issued.map((d, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-sans font-semibold text-slate-200">{d.nature_of_document}</td>
                    <td className="p-2.5 text-slate-300">{d.from_serial_no}</td>
                    <td className="p-2.5 text-slate-300">{d.to_serial_no}</td>
                    <td className="p-2.5 text-center text-slate-200">{d.total_number}</td>
                    <td className="p-2.5 text-center text-rose-400">{d.cancelled_number}</td>
                    <td className="p-2.5 text-center font-bold text-emerald-400">{d.net_issued}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
