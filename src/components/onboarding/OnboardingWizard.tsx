import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Store,
  Laptop,
  Shirt,
  Pill,
  Wrench,
  Car,
  UtensilsCrossed,
  Briefcase,
  Factory,
  Package,
  FileText,
  IndianRupee,
  AlertCircle,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBusinessId?: string) => void;
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

const CATEGORIES = [
  { id: 'Grocery / FMCG', name: 'Grocery & FMCG', icon: Store, desc: 'Kirana stores, supermarkets, food items' },
  { id: 'Electronics & IT', name: 'Electronics & IT', icon: Laptop, desc: 'Mobiles, laptops, computer accessories' },
  { id: 'Clothing & Apparel', name: 'Clothing & Textiles', icon: Shirt, desc: 'Fashion garments, fabrics, footwear' },
  { id: 'Pharmacy & Health', name: 'Pharmacy & Medical', icon: Pill, desc: 'Chemist, surgicals, pharmaceutical goods' },
  { id: 'Hardware & Sanitary', name: 'Hardware & Electrical', icon: Wrench, desc: 'Tools, paints, sanitary, electricals' },
  { id: 'Automobile & Parts', name: 'Auto Spares & Garage', icon: Car, desc: 'Automotive spares, lubricants, repair services' },
  { id: 'Restaurant & Bakery', name: 'Restaurant & Cafe', icon: UtensilsCrossed, desc: 'Food outlets, bakeries, sweet shops' },
  { id: 'Professional Services', name: 'Services & Consulting', icon: Briefcase, desc: 'IT services, agencies, freelancers' },
  { id: 'Manufacturing', name: 'Manufacturing Unit', icon: Factory, desc: 'Factories, fabrication, production' },
  { id: 'Wholesale & Distribution', name: 'Wholesale & Trade', icon: Package, desc: 'Bulk distributors, stockists, traders' },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, token, refreshUserData, switchBusiness } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Business Identity
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [businessType, setBusinessType] = useState('Retail & Wholesale');
  const [phone, setPhone] = useState(user?.phone || '+91 ');
  const [email, setEmail] = useState(user?.email || '');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [selectedStateCode, setSelectedStateCode] = useState('27'); // Maharashtra default
  const [pincode, setPincode] = useState('');

  // Step 2: Category
  const [businessCategory, setBusinessCategory] = useState(CATEGORIES[0].id);

  // Step 3: Invoicing
  const [invoicePrefix, setInvoicePrefix] = useState('INV-26');
  const [startingNumber, setStartingNumber] = useState('1');
  const [termsAndConditions, setTermsAndConditions] = useState(
    '1. Goods once sold will not be taken back or exchanged.\n2. Subject to local jurisdiction.\n3. Payment due within specified credit terms.'
  );
  const [initialCashFloat, setInitialCashFloat] = useState('10000');

  // Step 4: Starter Data
  const [addStarterProduct, setAddStarterProduct] = useState(true);
  const [starterProductName, setStarterProductName] = useState('');
  const [starterProductUnit, setStarterProductUnit] = useState('PCS');
  const [starterProductBuy, setStarterProductBuy] = useState('');
  const [starterProductSell, setStarterProductSell] = useState('');
  const [starterProductStock, setStarterProductStock] = useState('20');
  const [starterProductTax, setStarterProductTax] = useState(18);

  const [addStarterCustomer, setAddStarterCustomer] = useState(true);
  const [starterCustomerName, setStarterCustomerName] = useState('');
  const [starterCustomerPhone, setStarterCustomerPhone] = useState('');
  const [starterCustomerBalance, setStarterCustomerBalance] = useState('0');

  if (!isOpen) return null;

  // Auto-generate invoice prefix when business name changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBusinessName(val);
    if (!legalName || legalName === businessName) {
      setLegalName(val);
    }
    if (val.trim()) {
      const code = val.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
      if (code) {
        setInvoicePrefix(`${code}-26`);
      }
    }
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedStateCode(code);
    if (gstin && gstin.length >= 2) {
      // Suggest matching GSTIN state code prefix
      setGstin(`${code}${gstin.slice(2)}`);
    }
  };

  const validateStep1 = () => {
    if (!businessName.trim()) return 'Please enter business name.';
    if (!phone.trim() || phone.trim().length < 10) return 'Please enter a valid phone number.';
    if (!addressLine1.trim()) return 'Please enter street address.';
    if (!city.trim()) return 'Please enter city.';
    if (!pincode.trim() || pincode.trim().length < 6) return 'Please enter a valid 6-digit Indian pincode.';
    if (gstin.trim()) {
      const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!regex.test(gstin.trim().toUpperCase())) {
        return 'GSTIN format is invalid. Must be 15 alphanumeric characters (e.g. 27AAAAA0000A1Z5).';
      }
    }
    if (pan.trim()) {
      const regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!regex.test(pan.trim().toUpperCase())) {
        return 'PAN format is invalid. Must be 10 characters (e.g. ABCDE1234F).';
      }
    }
    return null;
  };

  const handleNext = () => {
    setError(null);
    if (currentStep === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);

    const selectedState = INDIAN_STATES.find((s) => s.code === selectedStateCode);

    const payload = {
      businessName: businessName.trim(),
      legalName: legalName.trim() || businessName.trim(),
      businessType,
      phone: phone.trim(),
      email: email.trim(),
      gstin: gstin.trim() ? gstin.trim().toUpperCase() : undefined,
      pan: pan.trim() ? pan.trim().toUpperCase() : undefined,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      state: selectedState?.name || 'Maharashtra',
      stateCode: selectedStateCode,
      pincode: pincode.trim(),
      businessCategory,
      invoicePrefix: invoicePrefix.trim().toUpperCase(),
      startingInvoiceNumber: Number(startingNumber) || 1,
      termsAndConditions,
      initialCashFloat: Number(initialCashFloat) || 0,
      firstProduct: addStarterProduct && starterProductName.trim() ? {
        name: starterProductName.trim(),
        category: businessCategory,
        unit: starterProductUnit,
        purchasePrice: Number(starterProductBuy) || 0,
        sellingPrice: Number(starterProductSell) || 0,
        taxRate: Number(starterProductTax) || 18,
        openingStock: Number(starterProductStock) || 0,
        minStockAlert: 10,
      } : undefined,
      firstCustomer: addStarterCustomer && starterCustomerName.trim() ? {
        name: starterCustomerName.trim(),
        phone: starterCustomerPhone.trim() || undefined,
        city: city.trim(),
        state: selectedState?.name || 'Maharashtra',
        stateCode: selectedStateCode,
        openingBalance: Number(starterCustomerBalance) || 0,
      } : undefined,
    };

    try {
      const data = await api.post('/onboarding/complete', payload);
      if (!data.success) {
        throw new Error(data.message || 'Onboarding submission failed');
      }

      await refreshUserData();
      if (data.business?.id) {
        switchBusiness(data.business.id);
      }
      onSuccess(data.business?.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete business setup');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStateObj = INDIAN_STATES.find((s) => s.code === selectedStateCode);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        
        {/* WIZARD HEADER & STEP PROGRESS */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center text-white font-bold shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                Business Onboarding &amp; Setup
              </h2>
              <p className="text-xs text-slate-400">
                Configure your Indian GST billing tenant in 5 simple steps
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

        {/* STEP PROGRESS BAR */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          {[
            { step: 1, label: '1. Identity' },
            { step: 2, label: '2. Category' },
            { step: 3, label: '3. Invoicing' },
            { step: 4, label: '4. First Items' },
            { step: 5, label: '5. Launch' },
          ].map((s) => {
            const isCompleted = s.step < currentStep;
            const isCurrent = s.step === currentStep;
            return (
              <div
                key={s.step}
                className={`flex items-center gap-1.5 font-semibold transition ${
                  isCurrent
                    ? 'text-indigo-400'
                    : isCompleted
                    ? 'text-emerald-400'
                    : 'text-slate-600'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-500/40'
                      : isCompleted
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isCompleted ? '✓' : s.step}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* ERROR NOTIFICATION */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP CONTENT BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* STEP 1: BUSINESS IDENTITY & TAX */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Step 1: Business Identity &amp; Location</h3>
                <p className="text-xs text-slate-400">Enter your trade name, state, and tax credentials for GST invoices.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Business / Trade Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mahavir Supermarket / Shree Ganesh Electricals"
                    value={businessName}
                    onChange={handleNameChange}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Legal / Registered Entity Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mahavir Retailers Pvt Ltd"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Business Structure Type
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="Retail & Wholesale">Retail &amp; Wholesale</option>
                    <option value="Retailer">Retail Store / Counter</option>
                    <option value="Wholesaler">Wholesale / Trader</option>
                    <option value="Distributor">Distributor / C&amp;F</option>
                    <option value="Manufacturer">Manufacturing</option>
                    <option value="Services">Services &amp; Contracting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Primary Mobile Phone <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Business Email
                  </label>
                  <input
                    type="email"
                    placeholder="contact@business.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    15-digit GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="27ABCDE1234F1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500 transition"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Leave blank if unregistered composition or small trader</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    10-digit PAN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="ABCDE1234F"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Shop / Office Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Shop No. 14, Main Market, Station Road"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    City <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mumbai, Pune, Bengaluru"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GST State &amp; Code <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={selectedStateCode}
                    onChange={handleStateChange}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
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
                    Pincode <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="400001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Financial Year &amp; Currency
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono">
                      FY 2026-27 (Apr - Mar)
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold font-mono">
                      INR (₹)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS CATEGORY */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Step 2: Choose Business Category</h3>
                <p className="text-xs text-slate-400">
                  Select your primary industry to optimize invoice templates, units, and tax presets.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = businessCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setBusinessCategory(cat.id)}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/50'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate flex items-center justify-between">
                          <span>{cat.name}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{cat.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: INVOICE CONFIGURATION & CASH FLOAT */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Step 3: Configure Invoicing Series &amp; Cash Float</h3>
                <p className="text-xs text-slate-400">
                  Define your unique invoice sequence numbers and initial store cash balance.
                </p>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Invoice Number Live Preview
                </div>
                <div className="text-xl font-mono font-black text-emerald-400">
                  {invoicePrefix}-{String(startingNumber).padStart(4, '0')}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Your first printed invoice will be assigned this official sequential serial.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Invoice Prefix Series <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OST-26 / BILL-01"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Starting Sequence Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={startingNumber}
                    onChange={(e) => setStartingNumber(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Starting Cash Drawer Float (₹)
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="number"
                      placeholder="10000"
                      value={initialCashFloat}
                      onChange={(e) => setInitialCashFloat(e.target.value)}
                      className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Cash in hand currently available in the counter cash drawer
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Default Invoice Terms &amp; Conditions
                  </label>
                  <textarea
                    rows={3}
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: STARTER INVENTORY & CUSTOMER */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Step 4: Add Starter Product &amp; Customer</h3>
                <p className="text-xs text-slate-400">
                  Optionally seed your first inventory item and customer account to test live dashboard stats immediately.
                </p>
              </div>

              {/* Starter Product Card */}
              <div className="bg-slate-800/40 border border-slate-700/70 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">First Product (Starter Inventory)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={addStarterProduct}
                      onChange={(e) => setAddStarterProduct(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Add now</span>
                  </label>
                </div>

                {addStarterProduct && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Product Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Basmati Rice 25kg / Wireless Mouse"
                        value={starterProductName}
                        onChange={(e) => setStarterProductName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Unit</label>
                      <select
                        value={starterProductUnit}
                        onChange={(e) => setStarterProductUnit(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      >
                        <option value="PCS">PCS</option>
                        <option value="KG">KG</option>
                        <option value="BAG">BAG</option>
                        <option value="BOX">BOX</option>
                        <option value="LTR">LTR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Purchase Price (₹)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={starterProductBuy}
                        onChange={(e) => setStarterProductBuy(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Selling Price (₹)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={starterProductSell}
                        onChange={(e) => setStarterProductSell(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Opening Stock</label>
                      <input
                        type="number"
                        placeholder="20"
                        value={starterProductStock}
                        onChange={(e) => setStarterProductStock(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Starter Customer Card */}
              <div className="bg-slate-800/40 border border-slate-700/70 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">First Customer / Buyer</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={addStarterCustomer}
                      onChange={(e) => setAddStarterCustomer(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Add now</span>
                  </label>
                </div>

                {addStarterCustomer && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Customer / Store Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Supermarket"
                        value={starterCustomerName}
                        onChange={(e) => setStarterCustomerName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        placeholder="+91 9820123456"
                        value={starterCustomerPhone}
                        onChange={(e) => setStarterCustomerPhone(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Opening Balance Due (₹)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={starterCustomerBalance}
                        onChange={(e) => setStarterCustomerBalance(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & CONFIRM */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2 shadow-lg">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-white">Review &amp; Launch Workspace</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Your multi-tenant relational workspace is ready to be provisioned with instant isolation.
                </p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 space-y-3 divide-y divide-slate-800 text-xs">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400">Business Name:</span>
                  <span className="font-bold text-white">{businessName}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Type &amp; Category:</span>
                  <span className="text-slate-200">{businessType} • {businessCategory}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Location:</span>
                  <span className="text-slate-200">{city}, {selectedStateObj?.name} (GST Code: {selectedStateCode})</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">GSTIN / PAN:</span>
                  <span className="font-mono text-slate-200">{gstin || 'Unregistered'} • {pan || 'None'}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">First Invoice Number:</span>
                  <span className="font-mono font-bold text-emerald-400">{invoicePrefix}-{String(startingNumber).padStart(4, '0')}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Cash Float:</span>
                  <span className="font-semibold text-teal-400">₹{Number(initialCashFloat || 0).toLocaleString('en-IN')}</span>
                </div>
                {addStarterProduct && starterProductName && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-400">Starter Product:</span>
                    <span className="text-emerald-300 font-semibold">{starterProductName} ({starterProductStock} {starterProductUnit})</span>
                  </div>
                )}
                {addStarterCustomer && starterCustomerName && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-slate-400">Starter Customer:</span>
                    <span className="text-indigo-300 font-semibold">{starterCustomerName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 ml-auto"
            >
              Next Step
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition flex items-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50 ml-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Provisioning Workspace...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Complete Setup &amp; Open Dashboard
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
