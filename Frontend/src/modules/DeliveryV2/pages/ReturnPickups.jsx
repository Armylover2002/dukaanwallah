import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MapPin, Phone, ShieldCheck, CheckCircle2, Loader2, 
  ArrowRight, Lock, AlertCircle, UploadCloud, RotateCcw, 
  Package, Clock, X, ChevronRight, Navigation2, Compass, Map,
  IndianRupee, Ruler, TrendingUp, Target, Plus, Minus, Play
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { openCamera } from '@food/utils/imageUploadUtils';
import { useDeliveryStore } from '../store/useDeliveryStore';
import { GoogleMap, useJsApiLoader, DirectionsService, DirectionsRenderer, Marker } from '@react-google-maps/api';

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
  const riderLocation = useDeliveryStore((state) => state.riderLocation);
  const [navPickup, setNavPickup] = useState(null);

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

  const handleStartNavigation = (pickup) => {
    setNavPickup(pickup);
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
                  <div className="flex items-center gap-2">
                    {['pickup_assigned', 'picked_up'].includes(status) && (
                      <button
                        onClick={() => handleStartNavigation(pickup)}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-800 bg-blue-50/80 px-2.5 py-1.5 rounded-full border border-blue-100 transition-all hover:bg-blue-100 active:scale-95 shrink-0"
                      >
                        <Navigation2 className="w-3.5 h-3.5" /> Navigate
                      </button>
                    )}
                    {getStatusBadge(status, otpVerified)}
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-5 space-y-5">

                  {/* Estimated Earning Banner — shown before task is complete */}
                  {['pickup_assigned', 'picked_up', 'delivered_to_seller'].includes(status) && pickup.riderEarning > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center text-green-700 shrink-0 border border-green-200">
                          <IndianRupee className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-green-700 font-black uppercase tracking-widest block leading-none">Your Earning</span>
                          <span className="text-xl font-black text-green-800 leading-tight">₹{pickup.riderEarning}</span>
                        </div>
                      </div>
                      {pickup.customerAddress?.location?.lat && pickup.sellerAddress?.location?.lat && (() => {
                        const R = 6371;
                        const toRad = (x) => (x * Math.PI) / 180;
                        const dLat = toRad(pickup.sellerAddress.location.lat - pickup.customerAddress.location.lat);
                        const dLon = toRad(pickup.sellerAddress.location.lng - pickup.customerAddress.location.lng);
                        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(pickup.customerAddress.location.lat)) * Math.cos(toRad(pickup.sellerAddress.location.lat)) * Math.sin(dLon/2)**2;
                        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        return (
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-green-600 font-black uppercase tracking-widest block leading-none">Distance</span>
                            <span className="text-sm font-black text-green-800">{dist.toFixed(1)} km</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Completed earning — shown when task is done */}
                  {status === 'refund_processed' && pickup.riderEarning > 0 && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-2.5">
                      <TrendingUp className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest block leading-none">Earning Credited</span>
                        <span className="text-sm font-black text-blue-800">₹{pickup.riderEarning} added to your wallet</span>
                      </div>
                    </div>
                  )}

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
                        <button
                          type="button"
                          onClick={() => {
                            openCamera({
                              onSelectFile: (file) => handleImageUpload(id, file),
                              fileNamePrefix: `return-pickup-${id}`,
                            });
                          }}
                          className="w-full border-2 border-dashed border-gray-200 hover:border-[#ff8100] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 hover:bg-orange-50/5 transition-all group"
                        >
                          <UploadCloud className="h-8 w-8 text-gray-300 group-hover:text-[#ff8100] transition-colors mb-2" />
                          <span className="text-xs font-bold text-gray-600 group-hover:text-gray-800 transition-colors">Upload Pickup Photo proof</span>
                          <span className="text-[9px] text-gray-400 font-semibold mt-1">Photo of the item collected</span>
                        </button>
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
                          className="px-6 bg-green-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-green-600 active:scale-95 transition-all shadow-md shadow-green-500/10 disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {completingTask[id] ? (
                            <Loader2 className="w-5 h-5 animate-spin animate-duration-1000" />
                          ) : (
                            'Verify'
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

      {/* Navigation Modal */}
      {navPickup && (
        <ReturnNavigationModal
          pickup={navPickup}
          riderLocation={riderLocation}
          onClose={() => setNavPickup(null)}
        />
      )}
    </div>
  );
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  fullscreenControl: false,
};

function ReturnNavigationModal({ pickup, riderLocation, onClose }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'geometry'],
  });

  const [directions, setDirections] = useState(null);
  const [distanceText, setDistanceText] = useState('');
  const [durationText, setDurationText] = useState('');
  const [isSimMode, setIsSimMode] = useState(false);
  const [simPath, setSimPath] = useState([]);
  const [simIndex, setSimIndex] = useState(0);
  const [simPos, setSimPos] = useState(null);
  const mapRef = useRef(null);

  const status = pickup.status;

  const origin = useMemo(() => {
    if (riderLocation?.lat && riderLocation?.lng) {
      return { lat: Number(riderLocation.lat), lng: Number(riderLocation.lng) };
    }
    return null;
  }, [riderLocation]);

  const destination = useMemo(() => {
    if (status === 'pickup_assigned') {
      const lat = Number(pickup.customerAddress?.location?.lat);
      const lng = Number(pickup.customerAddress?.location?.lng);
      return { lat, lng };
    } else {
      const lat = Number(pickup.sellerAddress?.location?.lat);
      const lng = Number(pickup.sellerAddress?.location?.lng);
      return { lat, lng };
    }
  }, [pickup, status]);

  const phaseTitle = status === 'pickup_assigned' ? 'Phase 1: Customer Pickup' : 'Phase 2: Handover to Seller';
  const targetName = status === 'pickup_assigned' ? (pickup.userId?.name || 'Customer') : (pickup.sellerAddress?.shopName || 'Seller Store');
  const targetAddress = status === 'pickup_assigned' 
    ? `${pickup.customerAddress?.street || ''}, ${pickup.customerAddress?.city || ''}` 
    : (pickup.sellerAddress?.address || '');

  const directionsCallback = React.useCallback((result, status) => {
    if (status === 'OK' && result) {
      setDirections(result);
      const leg = result.routes[0]?.legs[0];
      if (leg) {
        setDistanceText(leg.distance?.text || '');
        setDurationText(leg.duration?.text || '');
        
        const path = [];
        leg.steps.forEach(step => {
          step.path.forEach(p => path.push({ lat: p.lat(), lng: p.lng() }));
        });
        setSimPath(path);
      }
    }
  }, []);

  const [fallbackPos, setFallbackPos] = useState(null);
  useEffect(() => {
    if (!origin) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFallbackPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.log('Geolocation fallback failed', err),
        { enableHighAccuracy: true }
      );
    }
  }, [origin]);

  useEffect(() => {
    let interval;
    if (isSimMode && simPath.length > 1 && simIndex < simPath.length - 1) {
      interval = setInterval(() => {
        setSimPos(prevPos => {
          const nextProgress = 0.08;
          const currentPoint = simPath[simIndex];
          const nextPoint = simPath[simIndex + 1];
          if (currentPoint && nextPoint) {
            const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * nextProgress;
            const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * nextProgress;
            
            // Advance index occasionally
            if (Math.random() > 0.8) {
               setSimIndex(idx => idx + 1);
            }
            
            if (mapRef.current) {
               mapRef.current.panTo({ lat, lng });
            }
            return { lat, lng };
          }
          return prevPos;
        });
      }, 100);
    } else if (isSimMode && simIndex >= simPath.length - 1) {
      setIsSimMode(false);
    }
    return () => clearInterval(interval);
  }, [isSimMode, simPath, simIndex]);

  const activeOrigin = isSimMode && simPos ? simPos : (origin || fallbackPos);

  if (loadError) {
    return (
      <div className="fixed inset-0 z-[1000] bg-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="font-bold text-gray-900">Map Load Error</h3>
        <p className="text-xs text-gray-500 mt-1">Failed to load Google Maps interface.</p>
        <button onClick={onClose} className="mt-4 px-6 py-2.5 bg-gray-900 text-white font-bold rounded-2xl text-xs uppercase tracking-wider">Close</button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 z-[1000] bg-white flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff8100]" />
        <span className="text-xs text-gray-500 mt-2 font-semibold">Loading Navigation...</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-gray-100 flex flex-col font-poppins text-gray-900 safe-top safe-bottom">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
            <Compass className="w-4 h-4 animate-spin animate-duration-1000" />
          </div>
          <div>
            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest block leading-none">{phaseTitle}</span>
            <span className="text-xs font-black text-gray-950 mt-1 block">QC-RET-{String(pickup._id).slice(-6).toUpperCase()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 border border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Google Map area */}
      <div className="flex-1 relative bg-gray-200">
        {activeOrigin && destination ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={activeOrigin}
            zoom={15}
            options={mapOptions}
            onLoad={(map) => { mapRef.current = map; }}
          >
            {!directions && (
              <DirectionsService
                options={{
                  origin: isSimMode && simPath.length > 0 ? simPath[0] : activeOrigin,
                  destination: destination,
                  travelMode: 'DRIVING'
                }}
                callback={directionsCallback}
              />
            )}

            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: '#3b82f6',
                    strokeWeight: 6,
                    strokeOpacity: 0.8
                  }
                }}
              />
            )}

            <Marker 
              position={activeOrigin} 
              icon={{
                url: '/MapRider.png',
                scaledSize: new window.google.maps.Size(48, 48),
                anchor: new window.google.maps.Point(24, 24)
              }}
              zIndex={100}
            />
            <Marker 
              position={destination} 
              label={{ text: status === 'pickup_assigned' ? "Customer" : "Seller", color: "#ffffff", fontSize: "10px", fontWeight: "bold" }}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                fillColor: status === 'pickup_assigned' ? "#ff8100" : "#22c55e",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
                scale: 10,
              }}
            />

            <div className="absolute right-4 bottom-24 flex flex-col gap-4 z-[120]">
              <div className="flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                 <button onClick={() => mapRef.current?.setZoom(mapRef.current?.getZoom() + 1)} className="p-3 hover:bg-gray-50 border-b border-gray-100 text-gray-900 active:scale-90 transition-all"><Plus className="w-5 h-5 stroke-[2.75]" /></button>
                 <button onClick={() => mapRef.current?.setZoom(mapRef.current?.getZoom() - 1)} className="p-3 hover:bg-gray-50 text-gray-900 active:scale-90 transition-all"><Minus className="w-5 h-5 stroke-[2.75]" /></button>
              </div>
              <button 
                onClick={() => {
                  const nextSim = !isSimMode;
                  setIsSimMode(nextSim);
                  if (nextSim && simPath.length > 0) {
                    setSimIndex(0);
                    setSimPos(simPath[0]);
                  }
                }}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border transition-all ${isSimMode ? 'bg-[#ff8100] border-[#ff8100] text-white' : 'bg-white border-gray-100 text-[#ff8100]'}`}
              >
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isSimMode ? 'border-white' : 'border-[#ff8100]'}`}>
                  <Play className={`w-4 h-4 fill-current ml-0.5 ${isSimMode ? 'animate-pulse' : ''}`} />
                </div>
              </button>
              <button 
                 onClick={() => mapRef.current?.panTo(activeOrigin)} 
                 className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-blue-600 border border-gray-100 active:scale-90 transition-all"
              >
                <div className="w-8 h-8 rounded-full border-2 border-blue-600 flex items-center justify-center"><Navigation2 className="w-4 h-4" /></div>
              </button>
              <button 
                onClick={() => mapRef.current?.panTo(destination)}
                className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-gray-900 border border-gray-100 group active:scale-90 transition-all"
              >
                <Target className="w-7 h-7" />
              </button>
            </div>
          </GoogleMap>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500 font-semibold mt-2">Waiting for rider GPS signal...</span>
          </div>
        )}
      </div>

      {/* Info & details panel */}
      <div className="bg-white border-t border-gray-100 p-5 shadow-2xl shrink-0 rounded-t-3xl relative z-10 space-y-4">
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-gray-950">{durationText || '-- min'}</span>
            <span className="text-xs text-gray-400 font-bold uppercase">ETA</span>
          </div>
          <div className="flex items-baseline gap-1 text-right">
            <span className="text-xl font-bold text-gray-800">{distanceText || '-- km'}</span>
            <span className="text-xs text-gray-400 font-bold uppercase">Distance</span>
          </div>
        </div>

        <div className="border-t border-gray-50 pt-4 flex gap-3.5 items-start">
          <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest block leading-none mb-1">
              {status === 'pickup_assigned' ? 'Customer Pickup Point' : 'Seller Drop-off Point'}
            </span>
            <h4 className="text-sm font-bold text-gray-950 truncate">{targetName}</h4>
            <p className="text-xs text-gray-500 leading-relaxed mt-1">{targetAddress}</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-4 bg-gray-950 hover:bg-gray-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Map className="w-4 h-4" /> View List Screen
        </button>
      </div>
    </div>
  );
}
