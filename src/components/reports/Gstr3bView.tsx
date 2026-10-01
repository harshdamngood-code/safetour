import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  CheckCircle2,
  Building2,
  AlertCircle,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Gstr3bResponse } from '../../types/reports.types';

interface Gstr3bViewProps {
  selectedMonth: string;
}

export const Gstr3bView: React.FC<Gstr3bViewProps> = ({ selectedMonth }) => {
  const { activeBusiness } = useAuth();

  const [data, setData] = useState<Gstr3bResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBusiness) return;

    const fetchGstr3b = async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await api.get<Gstr3bResponse>(`/reports/gstr-3b?month=${selectedMonth}`);
        if (!json.success) {
          throw new Error(json.message || 'Failed to generate GSTR-3B');
        }

        setData(json.data);
      } catch (err: any) {
        setError(err.message || 'Error loading GSTR-3B');
      } finally {
        setLoading(false);
      }
    };

    fetchGstr3b();
  }, [activeBusiness, selectedMonth]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Calculating GSTR-3B Tax Liabilities &amp; ITC Set-off...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span>{error || 'Failed to load GSTR-3B return'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
      {/* Header Banner */}
      <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">GSTR-3B: Monthly Summary Return</h3>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-mono font-bold text-[10px]">
              Tax Period: {selectedMonth}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Output GST Liability vs. Input Tax Credit (ITC) Auto Set-Off Computation
          </p>
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-right">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block font-sans">
            Net GST Cash Payable to Govt
          </span>
          <span className="text-xl font-bold text-emerald-400">
            ₹{data.table5_1_net_payable.total_cash_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Table 3.1 Outward Supplies */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <span className="font-bold text-slate-200">
            3.1 Details of Outward Supplies and inward supplies liable to reverse charge
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3">Nature of Supplies</th>
                <th className="p-3 text-right">Total Taxable Value (₹)</th>
                <th className="p-3 text-right">Integrated Tax (₹)</th>
                <th className="p-3 text-right">Central Tax (₹)</th>
                <th className="p-3 text-right">State/UT Tax (₹)</th>
                <th className="p-3 text-right">Cess (₹)</th>
              </tr>
            </thead>
            <tbody className="font-mono divide-y divide-slate-800/60">
              <tr className="hover:bg-slate-800/40">
                <td className="p-3 font-sans font-semibold text-slate-200">
                  {data.table3_1.nature_of_supplies}
                </td>
                <td className="p-3 text-right text-slate-200">₹{data.table3_1.taxable_value.toFixed(2)}</td>
                <td className="p-3 text-right text-amber-400">₹{data.table3_1.integrated_tax.toFixed(2)}</td>
                <td className="p-3 text-right text-emerald-400">₹{data.table3_1.central_tax.toFixed(2)}</td>
                <td className="p-3 text-right text-emerald-400">₹{data.table3_1.state_tax.toFixed(2)}</td>
                <td className="p-3 text-right text-slate-400">₹0.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 4 Eligible ITC */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <span className="font-bold text-slate-200">
            4. Eligible Input Tax Credit (ITC) Available from Purchases &amp; Expenses
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Auto-calculated from Inward Register
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3">Details</th>
                <th className="p-3 text-right">Taxable Inward (₹)</th>
                <th className="p-3 text-right">Integrated Tax (₹)</th>
                <th className="p-3 text-right">Central Tax (₹)</th>
                <th className="p-3 text-right">State/UT Tax (₹)</th>
                <th className="p-3 text-right font-bold text-white">Total Available ITC (₹)</th>
              </tr>
            </thead>
            <tbody className="font-mono divide-y divide-slate-800/60">
              <tr className="hover:bg-slate-800/40">
                <td className="p-3 font-sans font-semibold text-slate-200">{data.table4_itc.nature}</td>
                <td className="p-3 text-right text-slate-200">₹{data.table4_itc.taxable_value.toFixed(2)}</td>
                <td className="p-3 text-right text-amber-400">₹{data.table4_itc.integrated_tax.toFixed(2)}</td>
                <td className="p-3 text-right text-emerald-400">₹{data.table4_itc.central_tax.toFixed(2)}</td>
                <td className="p-3 text-right text-emerald-400">₹{data.table4_itc.state_tax.toFixed(2)}</td>
                <td className="p-3 text-right text-emerald-400 font-bold text-sm">
                  ₹{data.table4_itc.total_itc.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 5.1 Payment of Tax (Net Settlement) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-3.5 bg-slate-950/60 border-b border-slate-800">
          <span className="font-bold text-slate-200">
            5.1 Net Tax Payable &amp; Set-off (Output Liability minus Available ITC)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3">Tax Head</th>
                <th className="p-3 text-right">Output Tax Liability</th>
                <th className="p-3 text-right">Paid Through ITC</th>
                <th className="p-3 text-right">Net Tax Payable (Cash)</th>
                <th className="p-3 text-right">Balance ITC Carried Forward</th>
              </tr>
            </thead>
            <tbody className="font-mono divide-y divide-slate-800/60">
              <tr className="hover:bg-slate-800/40">
                <td className="p-3 font-sans font-bold text-amber-400">Integrated Tax (IGST)</td>
                <td className="p-3 text-right text-slate-200">₹{data.table3_1.integrated_tax.toFixed(2)}</td>
                <td className="p-3 text-right text-slate-400">₹{data.table4_itc.integrated_tax.toFixed(2)}</td>
                <td className="p-3 text-right font-bold text-white">
                  ₹{data.table5_1_net_payable.integrated_tax.toFixed(2)}
                </td>
                <td className="p-3 text-right text-emerald-400">
                  ₹{data.itc_carried_forward.integrated_tax.toFixed(2)}
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="p-3 font-sans font-bold text-emerald-400">Central Tax (CGST)</td>
                <td className="p-3 text-right text-slate-200">₹{data.table3_1.central_tax.toFixed(2)}</td>
                <td className="p-3 text-right text-slate-400">₹{data.table4_itc.central_tax.toFixed(2)}</td>
                <td className="p-3 text-right font-bold text-white">
                  ₹{data.table5_1_net_payable.central_tax.toFixed(2)}
                </td>
                <td className="p-3 text-right text-emerald-400">
                  ₹{data.itc_carried_forward.central_tax.toFixed(2)}
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="p-3 font-sans font-bold text-emerald-400">State/UT Tax (SGST)</td>
                <td className="p-3 text-right text-slate-200">₹{data.table3_1.state_tax.toFixed(2)}</td>
                <td className="p-3 text-right text-slate-400">₹{data.table4_itc.state_tax.toFixed(2)}</td>
                <td className="p-3 text-right font-bold text-white">
                  ₹{data.table5_1_net_payable.state_tax.toFixed(2)}
                </td>
                <td className="p-3 text-right text-emerald-400">
                  ₹{data.itc_carried_forward.state_tax.toFixed(2)}
                </td>
              </tr>

              <tr className="bg-slate-950/80 font-bold border-t border-slate-700">
                <td className="p-3 font-sans text-white uppercase text-xs">Total Net Cash To Pay</td>
                <td className="p-3 text-right text-slate-200">
                  ₹{(data.table3_1.integrated_tax + data.table3_1.central_tax + data.table3_1.state_tax).toFixed(2)}
                </td>
                <td className="p-3 text-right text-slate-400">₹{data.table4_itc.total_itc.toFixed(2)}</td>
                <td className="p-3 text-right text-emerald-400 text-sm">
                  ₹{data.table5_1_net_payable.total_cash_payable.toFixed(2)}
                </td>
                <td className="p-3 text-right text-emerald-400 text-sm">
                  ₹{data.itc_carried_forward.total_credit.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
