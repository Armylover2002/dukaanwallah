import React, { useState } from 'react';
import axiosInstance from '@core/api/axios';
import { customerApi } from '../services/customerApi';
import {
  X,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wallet,
  Building2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReturnOrderModal({ orderId, paymentMethod, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('wallet');
  
  // Removed Bank Details form state
  const isOnlinePayment = paymentMethod && ['razorpay', 'razorpay_qr', 'online'].includes(paymentMethod.toLowerCase());

  // Upload state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Handle image file selection
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setErrorMsg('');

    // Proactively upload to the server
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'quick-commerce/returns/proof');

      const response = await axiosInstance.post('/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response?.data?.success && response?.data?.data?.url) {
        setProofImageUrl(response.data.data.url);
      } else if (response?.data?.url) {
        setProofImageUrl(response.data.url);
      } else {
        setErrorMsg('Uploaded file response format unrecognized.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err?.response?.data?.message || 'Failed to upload image. Please try again.');
      setImagePreview(null);
      setImageFile(null);
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle Bank field change
  const handleBankFieldChange = (e) => {
    const { name, value } = e.target;
    setBankDetails(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Submit return order request
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!reason.trim()) {
      setErrorMsg('Please specify a return reason.');
      return;
    }

    if (!proofImageUrl) {
      if (uploadingImage) {
        setErrorMsg('Please wait for the proof photo to finish uploading.');
      } else {
        setErrorMsg('Please upload a product proof photo.');
      }
      return;
    }

    // Validations removed for bank account

    setSubmitting(true);
    try {
      const payload = {
        orderId,
        reason,
        proofImageUrl,
        refundMethod,
      };

      const response = await customerApi.submitReturnRequest(payload);
      if (response?.data?.success || response?.status === 200 || response?.status === 212) {
        onSuccess();
      } else {
        setErrorMsg(response?.data?.message || 'Failed to submit return request.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err?.response?.data?.message || 'Failed to request return. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-slate-100 max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-black text-slate-800 tracking-tight">Request Return</h3>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Order ID: {orderId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all border border-slate-100"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Form scroll wrapper */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
          
          {/* Reason Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reason for Return *</label>
            <textarea
              required
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you want to return these items..."
              className="w-full px-3.5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50/15 transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Proof Photo Upload */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Proof Photo (Mandatory) *</label>
            
            {imagePreview ? (
              <div className="relative group max-w-xs rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                <img src={imagePreview} alt="Proof Preview" className="w-full h-40 object-cover" />
                
                {uploadingImage ? (
                  <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-white text-xs gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                    <span className="font-bold">Uploading proof photo...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                      setProofImageUrl('');
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg transition-colors shadow-md"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-200 hover:border-rose-300 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-rose-50/10 transition-all group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <UploadCloud className="h-8 w-8 text-slate-300 group-hover:text-rose-400 transition-colors mb-2" />
                <span className="text-xs font-black text-slate-600 group-hover:text-slate-800 transition-colors">Upload Product Photo</span>
                <span className="text-[9px] text-slate-400 font-semibold mt-1">PNG, JPG or JPEG up to 5MB</span>
              </label>
            )}
          </div>

          {/* Refund Method Section */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Refund Destination</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Wallet Option */}
              <button
                type="button"
                onClick={() => setRefundMethod('wallet')}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-2xl border text-left transition-all",
                  refundMethod === 'wallet'
                    ? "border-rose-200 bg-rose-50/20 text-rose-950 shadow-sm"
                    : "border-slate-100 bg-white text-slate-700 hover:border-slate-200"
                )}
              >
                <div className={cn(
                  "p-2.5 rounded-xl shrink-0",
                  refundMethod === 'wallet' ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-400"
                )}>
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black">App Wallet</h4>
                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Instant refund on approval</p>
                </div>
              </button>

              {/* Original Payment Source Option */}
              {isOnlinePayment && (
                <button
                  type="button"
                  onClick={() => setRefundMethod('original_source')}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-2xl border text-left transition-all",
                    refundMethod === 'original_source'
                      ? "border-rose-200 bg-rose-50/20 text-rose-950 shadow-sm"
                      : "border-slate-100 bg-white text-slate-700 hover:border-slate-200"
                  )}
                >
                  <div className={cn(
                    "p-2.5 rounded-xl shrink-0",
                    refundMethod === 'original_source' ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-400"
                  )}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black">Original Source</h4>
                    <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Refund to original payment method</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Bank details form removed */}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs animate-in shake duration-300 text-left">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-semibold leading-normal">{errorMsg}</p>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploadingImage}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting Request...
              </>
            ) : (
              <>
                Submit Return Request <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
