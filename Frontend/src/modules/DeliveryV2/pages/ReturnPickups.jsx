import React, { useState, useEffect } from 'react';
import { 
  MapPin, Phone, ShieldCheck, CheckCircle2, Loader2, 
  ArrowRight, Lock, AlertCircle, UploadCloud, RotateCcw, 
  Package, Clock, X, ChevronRight 
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';

export default function ReturnPickups() {
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [otpInputs, setOtpInputs] = useState({});
  const [verifyingOtp, setVerifyingOtp] = useState({});
  const [uploadingImage, setUploadingImage] = useState({});
  const [uploadedProofs, setUploadedProofs] = useState({});
  const [confirmingPickup, setConfirmingPickup] = useState({});
  const [completingTask, setCompletingTask] = useState({});
  const [sellerOtpInputs, setSellerOtpInputs] = useState({});

  const fetchPickups = async () => {
    try {
      setLoading(true);
      const res = await deliveryAPI.getReturnPickups();
      if (res?.data?.success && Array.isArray(res?.data?.result)) {
        setPickups(res.data.result);
      } else if (Array.isArray(res?.data)) {
        setPickups(res.data);
      } else if (res?.data?.result) {
        setPickups(res.data.result);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch return pickups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPickups();
  }, []);

  const handleOtpChange = (id, val) => {
    setOtpInputs(prev => ({
      ...prev,
      [id]: val.replace(/\D/g, '').slice(0, 4) // 4-digit OTP
    }));
  };

  const handleSellerOtpChange = (id, val) => {
    setSellerOtpInputs(prev => ({
      ...prev,
      [id]: val.replace(/\D/g, '').slice(0, 4) // 4-digit OTP
    }));
  };

  const handleVerifyOtp = async (id) => {
    const otp = otpInputs[id];
    if (!otp || otp.length !== 4) {
      toast.error('Please enter a valid 4-digit OTP.');
      return;
    }

    setVerifyingOtp(prev => ({ ...prev, [id]: true }));
    try {
      const res = await deliveryAPI.verifyReturnOtp(id, otp);
      if (res?.data?.success || res?.status === 200) {
        toast.success('OTP verified successfully!');
        // Refresh pickups
        await fetchPickups();
      } else {
        toast.error(res?.data?.message || 'Invalid OTP.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to verify OTP.');
    } finally {
      setVerifyingOtp(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleImageUpload = async (id, file) => {
    if (!file) return;

    setUploadingImage(prev => ({ ...prev, [id]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'quick-commerce/returns/pickup-proof');

      const res = await axiosInstance.post('/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res?.data?.success && res?.data?.data?.url) {
        setUploadedProofs(prev => ({ ...prev, [id]: res.data.data.url }));
        toast.success('Pickup proof uploaded.');
      } else if (res?.data?.url) {
        setUploadedProofs(prev => ({ ...prev, [id]: res.data.url }));
        toast.success('Pickup proof uploaded.');
      } else {
        toast.error('Failed to parse uploaded image URL.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setUploadingImage(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleConfirmPickup = async (id) => {
    const proofUrl = uploadedProofs[id];
    if (!proofUrl) {
      toast.error('Please upload a proof photo first.');
      return;
    }

    setConfirmingPickup(prev => ({ ...prev, [id]: true }));
    try {
      const res = await deliveryAPI.confirmReturnPickup(id, proofUrl);
      if (res?.data?.success || res?.status === 200) {
        toast.success('Pickup confirmed! Proceed to seller.');
        await fetchPickups();
      } else {
        toast.error(res?.data?.message || 'Failed to confirm pickup.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to confirm pickup.');
    } finally {
      setConfirmingPickup(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDeliverToSeller = async (id) => {
    const sellerOtp = sellerOtpInputs[id];
    if (!sellerOtp || sellerOtp.length !== 4) {
      toast.error('Please enter the 4-digit Seller OTP.');
      return;
    }

    setCompletingTask(prev => ({ ...prev, [id]: true }));
    try {
      const res = await deliveryAPI.deliverReturnToSeller(id, sellerOtp);
      if (res?.data?.success || res?.status === 200) {
        toast.success('Delivered to seller successfully!');
        await fetchPickups();
      } else {
        toast.error(res?.data?.message || 'Failed to complete delivery.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to complete delivery.');
    } finally {
      setCompletingTask(prev => ({ ...prev, [id]: false }));
    }
  };

  const getStatusBadge = (status, otpVerified) => {
    switch (status) {
      case 'pickup_assigned':
        return otpVerified ? (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase rounded-full tracking-wider flex items-center gap-1 shrink-0">
            <Clock className="w-3.5 h-3.5" /> Awaiting Proof
          </span>
        ) : (
          <span className="px-3 py-1 bg-orange-100 text-orange-800 text-[10px] font-bold uppercase rounded-full tracking-wider flex items-center gap-1 shrink-0">
            <Lock className="w-3.5 h-3.5" /> OTP Pending
          </span>
        );
      case 'picked_up':
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded-full tracking-wider flex items-center gap-1 shrink-0">
            <ArrowRight className="w-3.5 h-3.5" /> Out to Seller
          </span>
        );
      case 'delivered_to_seller':
        return (
          <span className="px-3 py-1 bg-purple-100 text-purple-800 text-[10px] font-bold uppercase rounded-full tracking-wider flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Delivered to Seller
          </span>
        );
      case 'refund_processed':
        return (
          <span className="px-3 py-1 bg-green-100 text-green-800 text-[10px] font-bold uppercase rounded-full tracking-wider flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-gray-100 text-gray-800 text-[10px] font-bold uppercase rounded-full tracking-wider shrink-0">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center font-poppins gap-3">
        <Loader2 className="w-10 h-10 border-4 border-[#ff8100] border-t-transparent rounded-full animate-spin text-[#ff8100]" />
        <p className="text-xs font-semibold text-gray-500">Loading Return Tasks...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-poppins pb-24 text-gray-900">
      {/* 0. Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-[100] safe-top shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-[#ff8100] border border-orange-100">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-950 uppercase tracking-tighter">Return Tasks</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Assigned Return Pickups</p>
          </div>
        </div>
        <button 
          onClick={fetchPickups} 
          className="text-xs text-[#ff8100] font-black uppercase tracking-wider hover:underline"
        >
          Refresh
        </button>
      </div>

      <div className="px-4 py-6 max-w-md mx-auto space-y-4">
        {pickups.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 border border-gray-100">
              <Package className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-950">No Return Tasks</h3>
              <p className="text-xs text-gray-500 mt-1">You have no active return order pickup tasks assigned at this time.</p>
            </div>
          </div>
        ) : (
          pickups.map((pickup) => {
            const id = pickup._id;
            const status = pickup.status;
            const otpVerified = pickup.otpVerified;
            const otpVal = otpInputs[id] || '';
            const previewUrl = uploadedProofs[id] || pickup.pickupProofImageUrl;

            return (
              <div key={id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in-50 duration-300">
                {/* Header row */}
                <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center gap-3">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Return ID</span>
                    <span className="text-xs font-black text-gray-950">QC-RET-{String(id).slice(-6).toUpperCase()}</span>
                  </div>
                  {getStatusBadge(status, otpVerified)}
                </div>

                {/* Body Details */}
                <div className="p-5 space-y-5">
                  
                  {/* Customer Details */}
                  <div className="flex gap-4 items-start">
                    <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center text-[#ff8100] shrink-0 border border-orange-100">
                      <MapPin className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest block leading-none mb-1">Pick up from customer</span>
                      <h4 className="text-sm font-bold text-gray-950 truncate">{pickup.userId?.name || 'Customer'}</h4>
                      <p className="text-xs text-gray-600 font-medium leading-relaxed mt-1">
                        {pickup.customerAddress?.street}, {pickup.customerAddress?.city}
                      </p>
                      {pickup.customerAddress?.phone && (
                        <a 
                          href={`tel:${pickup.customerAddress.phone}`}
                          className="inline-flex items-center gap-1.5 text-xs text-[#ff8100] font-bold mt-2.5 bg-orange-50/50 px-3 py-1 rounded-lg border border-orange-100 hover:bg-orange-50"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call Customer
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Seller Details */}
                  <div className="flex gap-4 items-start border-t border-gray-50 pt-4">
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0 border border-blue-100">
                      <Package className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest block leading-none mb-1">Deliver to Store</span>
                      <h4 className="text-sm font-bold text-gray-950 truncate">{pickup.sellerAddress?.shopName || 'Seller'}</h4>
                      <p className="text-xs text-gray-600 font-medium leading-relaxed mt-1">
                        {pickup.sellerAddress?.address}
                      </p>
                    </div>
                  </div>

                  {/* Return Items */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2">
                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-wider block">Items to return</span>
                    {pickup.returnItems?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-gray-900 truncate pr-4">{item.name}</span>
                        <span className="text-gray-500 shrink-0">x{item.quantity}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200/50 pt-2 flex justify-between text-xs font-bold text-gray-950 mt-1">
                      <span>Reason:</span>
                      <span className="text-gray-600 font-medium italic truncate max-w-[200px] text-right">"{pickup.reason}"</span>
                    </div>
                  </div>

                  {/* Actions according to state */}
                  {status === 'pickup_assigned' && !otpVerified && (
                    <div className="border-t border-gray-50 pt-4 space-y-3">
                      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 flex gap-2.5 items-start text-xs text-orange-800">
                        <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Verification Code Required</span>
                          <p className="text-[11px] text-orange-700 mt-0.5">Please verify the 4-digit code provided by the customer to collect the package.</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          value={otpVal}
                          onChange={(e) => handleOtpChange(id, e.target.value)}
                          placeholder="Enter 4-digit OTP"
                          disabled={verifyingOtp[id]}
                          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono tracking-[0.2em] font-black outline-none focus:bg-white focus:border-[#ff8100] transition-colors disabled:opacity-60 text-center"
                        />
                        <button
                          onClick={() => handleVerifyOtp(id)}
                          disabled={verifyingOtp[id] || otpVal.length !== 4}
                          className="px-6 bg-[#ff8100] text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-orange-600 active:scale-95 transition-all shadow-md shadow-orange-500/10 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {verifyingOtp[id] ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {status === 'pickup_assigned' && otpVerified && (
                    <div className="border-t border-gray-50 pt-4 space-y-4">
                      <div className="bg-green-50 border border-green-100 rounded-2xl p-3 flex gap-2.5 items-center text-xs text-green-800">
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-600 shrink-0" />
                        <span className="font-bold">OTP Verified! Please collect the item.</span>
                      </div>

                      {previewUrl ? (
                        <div className="relative group max-w-xs rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 mx-auto">
                          <img src={previewUrl} alt="Pickup Proof" className="w-full h-36 object-cover" />
                          {uploadingImage[id] ? (
                            <div className="absolute inset-0 bg-gray-950/60 flex flex-col items-center justify-center text-white text-xs font-bold gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-[#ff8100]" />
                              <span>Uploading...</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setUploadedProofs(prev => ({ ...prev, [id]: null }))}
                              className="absolute top-2 right-2 p-1.5 bg-gray-900/80 hover:bg-gray-900 text-white rounded-lg transition-colors shadow-md"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-gray-200 hover:border-[#ff8100] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 hover:bg-orange-50/5 transition-all group">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(id, e.target.files[0])}
                            className="hidden"
                          />
                          <UploadCloud className="h-8 w-8 text-gray-300 group-hover:text-[#ff8100] transition-colors mb-2" />
                          <span className="text-xs font-bold text-gray-600 group-hover:text-gray-800 transition-colors">Upload Pickup Photo proof</span>
                          <span className="text-[9px] text-gray-400 font-semibold mt-1">Photo of the item collected</span>
                        </label>
                      )}

                      <button
                        onClick={() => handleConfirmPickup(id)}
                        disabled={confirmingPickup[id] || !previewUrl || uploadingImage[id]}
                        className="w-full py-4 bg-[#ff8100] hover:bg-orange-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {confirmingPickup[id] ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>Confirm Pickup <ArrowRight className="w-4 h-4" /></>
                        )}
                      </button>
                    </div>
                  )}

                  {status === 'picked_up' && (
                    <div className="border-t border-gray-50 pt-4 space-y-3">
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex gap-2.5 items-start text-xs text-blue-800">
                        <ShieldCheck className="w-4.5 h-4.5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Seller Handover OTP Required</span>
                          <p className="text-[11px] text-blue-700 mt-0.5">Please ask the store representative/seller for the delivery OTP to complete the handover.</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          value={sellerOtpInputs[id] || ''}
                          onChange={(e) => handleSellerOtpChange(id, e.target.value)}
                          placeholder="Seller OTP"
                          disabled={completingTask[id]}
                          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono tracking-[0.2em] font-black outline-none focus:bg-white focus:border-green-500 transition-colors disabled:opacity-60 text-center"
                        />
                        <button
                          onClick={() => handleDeliverToSeller(id)}
                          disabled={completingTask[id] || (sellerOtpInputs[id] || '').length !== 4}
                          className="px-6 bg-green-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-green-600 active:scale-95 transition-all shadow-md shadow-green-500/10 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                        >
                          {completingTask[id] ? (
                            <Loader2 className="w-5 h-5 animate-spin animate-duration-1000" />
                          ) : (
                            'Verify & Handover'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {status === 'delivered_to_seller' && (
                    <div className="border-t border-gray-50 pt-4">
                      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex gap-2.5 items-start text-xs text-purple-800">
                        <CheckCircle2 className="w-4.5 h-4.5 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Awaiting Seller Confirmation</span>
                          <p className="text-[11px] text-purple-700 mt-0.5">You have delivered the items to the seller. The seller will verify and confirm receipt to process the refund.</p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
