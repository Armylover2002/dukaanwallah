import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import axiosInstance from '@core/api/axios';
import Card from '@shared/components/ui/Card';
import {
  ShieldAlert,
  Lock,
  RotateCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  IndianRupee,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SellerPenalty = () => {
  const [sellers, setSellers] = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [penaltySellerId, setPenaltySellerId] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyReason, setPenaltyReason] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setLoadingSellers(true);
    axiosInstance
      .get('/quick-commerce/admin/seller-requests', {
        params: { status: 'approved', limit: 500 },
      })
      .then((res) => {
        const items = res.data.result?.items || res.data.results || [];
        setSellers(
          items.map((s) => {
            const extra = s.sellerId || s.displayId || s.phone || s.ownerPhone || s.name || s._id?.slice(-6) || '';
            return {
              id: s._id || s.id,
              name: s.shopName
                ? `${s.shopName} (${extra})`
                : s.name || s.ownerName || 'Unknown',
            };
          })
        );
      })
      .catch(() => toast.error('Failed to load sellers'))
      .finally(() => setLoadingSellers(false));
  }, []);

  const filteredSellers = sellers.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedSellerName = sellers.find((s) => s.id === penaltySellerId)?.name || '';

  const handleApply = async () => {
    if (!penaltySellerId) { toast.error('Please select a seller'); return; }
    if (!penaltyAmount || Number(penaltyAmount) <= 0) { toast.error('Enter a valid penalty amount'); return; }
    if (!penaltyReason.trim()) { toast.error('Please provide a reason for the penalty'); return; }

    setIsApplying(true);
    try {
      await adminApi.applySellerPenalty({
        sellerId: penaltySellerId,
        amount: Number(penaltyAmount),
        reason: penaltyReason,
      });

      // Add to local history
      setHistory((prev) => [
        {
          id: Date.now(),
          seller: selectedSellerName,
          amount: Number(penaltyAmount),
          reason: penaltyReason,
          time: new Date().toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }),
        },
        ...prev,
      ]);

      toast.success(`Penalty of ₹${penaltyAmount} applied to ${selectedSellerName}`);
      setPenaltySellerId('');
      setPenaltyAmount('');
      setPenaltyReason('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to apply penalty');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="flex flex-col gap-1 px-1 mb-6">
        <h1 className="ds-h1 flex items-center gap-3">
          Seller Penalty
          <div className="p-1.5 bg-red-100 rounded-lg">
            <ShieldAlert className="h-5 w-5 text-red-600" />
          </div>
        </h1>
        <p className="ds-description">
          Apply a financial penalty to a seller. The amount will be deducted from their earnings and recorded in their transaction history.
        </p>
      </div>

      {/* Alert Banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-amber-800 leading-relaxed">
          This action is <strong>irreversible</strong>. The penalty amount will be permanently deducted from the seller's available balance and will appear as a negative adjustment in their transaction history.
        </p>
      </div>

      {/* Main Penalty Form */}
      <Card className="p-6 border-none shadow-sm ring-1 ring-red-100 bg-gradient-to-br from-red-50/40 to-white rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-red-100 rounded-xl">
            <Lock className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Apply New Penalty</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Fill in all fields before submitting</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Seller Dropdown */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Select Seller <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search seller..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-red-300/40 focus:border-red-400 transition-all mb-2"
              />
            </div>
            <select
              value={penaltySellerId}
              onChange={(e) => setPenaltySellerId(e.target.value)}
              disabled={loadingSellers}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 transition-all disabled:opacity-60"
            >
              <option value="">-- Choose Seller --</option>
              {loadingSellers ? (
                <option disabled>Loading sellers...</option>
              ) : (
                filteredSellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
            {penaltySellerId && (
              <p className="text-[10px] font-bold text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3" /> Selected: {selectedSellerName}
              </p>
            )}
          </div>

          {/* Amount & Reason */}
          <div className="flex flex-col gap-4 md:col-span-2">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Penalty Amount (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 500"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 transition-all"
                />
              </div>
              {penaltyAmount && Number(penaltyAmount) > 0 && (
                <p className="text-[11px] font-semibold text-red-600">
                  ₹{Number(penaltyAmount).toLocaleString('en-IN')} will be deducted from seller's earnings
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Describe the reason for this penalty (e.g. Late delivery, customer complaint, policy violation...)"
                value={penaltyReason}
                onChange={(e) => setPenaltyReason(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 transition-all resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end mt-2">
              <button
                onClick={handleApply}
                disabled={isApplying || !penaltySellerId || !penaltyAmount || !penaltyReason.trim()}
                className="flex items-center gap-2 px-8 py-3.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <RotateCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {isApplying ? 'Applying Penalty...' : 'Apply Penalty'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Applied Penalties History (session only) */}
      <AnimatePresence>
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2"
          >
            <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                  Applied This Session
                </h3>
              </div>
              <div className="space-y-3">
                {history.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.seller}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.reason}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{item.time}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-black text-red-600">-₹{item.amount.toLocaleString('en-IN')}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold uppercase">Deducted</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SellerPenalty;
