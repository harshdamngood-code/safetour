import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PartyType } from '../../types/parties.types';
import { X, UserPlus, Loader2, IndianRupee, CheckCircle2, AlertCircle, Building2, Phone, Mail } from 'lucide-react';

interface CreatePartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: PartyType;
}

const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
];

export const CreatePartyModal: React.FC<CreatePartyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'CUSTOMER',
}) => {
  const { activeBusiness, token } = useAuth();
  const [partyType, setPartyType] = useState<PartyType>(initialType);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('27');
  const [pincode, setPincode] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGstinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setGstin(val);
    if (val.length >= 2) {
      const code = val.slice(0, 2);
      const matched = INDIAN_STATES.find((s) => s.code === code);
      if (matched) {
        setStateCode(code);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Party name is required.');
      return;
    }

    if (gstin.trim()) {
      const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!regex.test(gstin.trim().toUpperCase())) {
        setError('Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 27AAAAA0000A1Z5).');
        return;
      }
    }

    setLoading(true);
    setError(null);

    const matchedState = INDIAN_STATES.find((s) => s.code === stateCode);

    try {
      const data = await api.post('/parties', {
        partyType,
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim() ? gstin.trim().toUpperCase() : undefined,
        pan: pan.trim() ? pan.trim().toUpperCase() : undefined,
        billingAddress: billingAddress.trim() || undefined,
        city: city.trim() || undefined,
        state: matchedState?.name || 'Maharashtra',
        stateCode,
        pincode: pincode.trim() || undefined,
        openingBalance: Number(openingBalance) || 0,
        creditLimit: Number(creditLimit) || 0,
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to create party');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating party');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add New Business Party</h3>
              <p className="text-xs text-slate-400">
                Customer (Receivable) or Supplier (Payable) for <span className="text-indigo-300 font-semibold">{activeBusiness?.business_name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Party Type Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Party Type <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPartyType('CUSTOMER')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                  partyType === 'CUSTOMER'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>🛒 Customer / Buyer (Receivable)</span>
              </button>
              <button
                type="button"
                onClick={() => setPartyType('SUPPLIER')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                  partyType === 'SUPPLIER'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/40'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>🏭 Supplier / Vendor (Payable)</span>
              </button>
            </div>
          </div>

          {/* Name & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Party / Contact Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar / Sharma Traders"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Company / Shop Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sharma Kirana & General Store"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mobile Number (WhatsApp)
              </label>
              <input
                type="tel"
                placeholder="+91 9820123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="party@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* GSTIN & PAN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                15-Digit GSTIN (Optional)
              </label>
              <input
                type="text"
                maxLength={15}
                placeholder="27AABCS1234F1Z8"
                value={gstin}
                onChange={handleGstinChange}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500 transition"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Auto-selects state from first 2 digits</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                10-Digit PAN (Optional)
              </label>
              <input
                type="text"
                maxLength={10}
                placeholder="ABCDE1234F"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Address & City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Street Address
              </label>
              <input
                type="text"
                placeholder="Shop No. 5, Market Yard Road"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                City / Town
              </label>
              <input
                type="text"
                placeholder="Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* State & Pincode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                GST State &amp; Code <span className="text-rose-400">*</span>
              </label>
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code} className="bg-slate-900 text-white">
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Pincode
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="400001"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Financials: Opening Balance & Credit Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-800/40 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Opening Balance (₹)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition font-semibold"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {partyType === 'CUSTOMER'
                  ? 'Existing pending debt to collect from this buyer'
                  : 'Existing pending debt you owe to this vendor'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Credit Limit (₹)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition font-semibold"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Maximum allowed credit udhar before alert
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Party...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save {partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
