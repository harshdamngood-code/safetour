import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PartyListItem } from '../../types/parties.types';
import { X, MessageSquare, Copy, Check, ExternalLink } from 'lucide-react';

interface WhatsAppReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: PartyListItem;
}

export const WhatsAppReminderModal: React.FC<WhatsAppReminderModalProps> = ({
  isOpen,
  onClose,
  party,
}) => {
  const { activeBusiness } = useAuth();
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState<'english' | 'hinglish'>('english');

  if (!isOpen) return null;

  const dueAmount = Number(party.current_balance) || 0;
  const businessName = activeBusiness?.business_name || 'Our Business';
  const cleanPhone = party.phone ? party.phone.replace(/[^0-9]/g, '') : '';
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  // Custom polite templates
  const englishMessage = `Dear ${party.name},\n\nGreetings from *${businessName}*!\n\nThis is a gentle reminder that an outstanding payment of *₹${dueAmount.toLocaleString('en-IN')}* is currently due on your account.\n\nKindly arrange to clear the dues via UPI / Bank Transfer at your earliest convenience.\n\nFor any billing clarification or invoice copies, please feel free to reach out.\n\nThank you for your valued association!\n*${businessName}*`;

  const hinglishMessage = `Namaste ${party.name} ji,\n\n*${businessName}* ki taraf se pranaam!\n\nAapke account mein *₹${dueAmount.toLocaleString('en-IN')}* ka payment balance pending hai.\n\nKripya UPI ya Bank Transfer ke madhyam se jald se jald payment clear kar dijiye.\n\nKisi bhi invoice ya hisaab kitaab ke liye hume turant call karein.\n\nDhanyawad!\n*${businessName}*`;

  const currentMessage = language === 'english' ? englishMessage : hinglishMessage;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(currentMessage);
    const url = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">WhatsApp Payment Reminder</h3>
              <p className="text-xs text-slate-400">
                To: <span className="text-emerald-300 font-semibold">{party.name}</span> ({party.phone || 'No phone'})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Due Info */}
          <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400">Total Outstanding Balance</div>
              <div className="text-xl font-extrabold text-rose-400">₹{dueAmount.toLocaleString('en-IN')}</div>
            </div>
            {/* Language toggle */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLanguage('english')}
                className={`px-3 py-1 rounded-lg transition ${
                  language === 'english' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hinglish')}
                className={`px-3 py-1 rounded-lg transition ${
                  language === 'hinglish' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Hinglish
              </button>
            </div>
          </div>

          {/* Message Preview Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              WhatsApp Message Preview
            </label>
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-200 whitespace-pre-line font-sans leading-relaxed shadow-inner max-h-56 overflow-y-auto">
              {currentMessage}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleCopy}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copy Message</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Send via WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
