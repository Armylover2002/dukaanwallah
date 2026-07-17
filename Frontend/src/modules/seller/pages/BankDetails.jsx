import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import { BlurFade } from "@/components/ui/blur-fade";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import { Building2, Upload } from 'lucide-react';

const BankDetails = () => {
    const [bankInfo, setBankInfo] = useState({
        bankName: '',
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        upiId: '',
        upiQrImage: ''
    });
    const [upiQrFile, setUpiQrFile] = useState(null);
    const [isUpdatingBank, setIsUpdatingBank] = useState(false);
    const [isFetchingProfile, setIsFetchingProfile] = useState(true);

    const loadProfile = async () => {
        try {
            const response = await sellerApi.getProfile();
            const profile = response?.data?.result || response?.data?.data || response?.data || {};
            if (profile.bankInfo) {
                setBankInfo({
                    bankName: profile.bankInfo.bankName || '',
                    accountHolderName: profile.bankInfo.accountHolderName || '',
                    accountNumber: profile.bankInfo.accountNumber || '',
                    ifscCode: profile.bankInfo.ifscCode || '',
                    upiId: profile.bankInfo.upiId || '',
                    upiQrImage: profile.bankInfo.upiQrImage || ''
                });
            }
        } catch (error) {
            console.error('Failed to load profile for bank details', error);
        } finally {
            setIsFetchingProfile(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, []);

    // Field-wise character limits (used for maxLength + validation)
    const FIELD_LIMITS = {
        bankName: 50,
        accountHolderName: 40,
        accountNumber: 18,
        ifscCode: 11,
        upiId: 50,
    };

    // Field-wise input filters -> strips out characters that shouldn't be typed at all
    const sanitizeValue = (name, rawValue) => {
        let value = rawValue;

        switch (name) {
            case 'bankName':
            case 'accountHolderName':
                // Only letters and spaces allowed, numbers/symbols blocked
                value = value.replace(/[^a-zA-Z\s]/g, '');
                break;
            case 'accountNumber':
                // Only digits allowed, no letters/symbols
                value = value.replace(/[^0-9]/g, '');
                break;
            case 'ifscCode':
                // Only letters and numbers allowed, auto-uppercase
                value = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                break;
            case 'upiId':
                // Letters, numbers and the standard UPI-id symbols only
                value = value.replace(/[^a-zA-Z0-9@._-]/g, '');
                break;
            default:
                break;
        }

        // Enforce max length in-place while typing
        const limit = FIELD_LIMITS[name];
        if (limit && value.length > limit) {
            value = value.slice(0, limit);
        }

        return value;
    };

    const handleBankInfoChange = (e) => {
        const { name, value } = e.target;
        const sanitized = sanitizeValue(name, value);
        setBankInfo(prev => ({ ...prev, [name]: sanitized }));
    };

    const handleUpdateBankInfo = async (e) => {
        e.preventDefault();

        if (bankInfo.bankName && !/^[a-zA-Z\s]+$/.test(bankInfo.bankName)) {
            toast.error("Bank Name can only contain letters and spaces.");
            return;
        }
        if (bankInfo.accountHolderName && !/^[a-zA-Z\s]+$/.test(bankInfo.accountHolderName)) {
            toast.error("Account Holder Name can only contain letters and spaces.");
            return;
        }
        if (bankInfo.accountNumber && !/^[0-9]+$/.test(bankInfo.accountNumber)) {
            toast.error("Account Number can only contain digits.");
            return;
        }
        if (bankInfo.accountNumber && (bankInfo.accountNumber.length < 8 || bankInfo.accountNumber.length > 18)) {
            toast.error("Account Number must be between 8 and 18 digits.");
            return;
        }
        if (bankInfo.ifscCode && bankInfo.ifscCode.length !== 11) {
            toast.error("IFSC Code must be exactly 11 characters.");
            return;
        }

        setIsUpdatingBank(true);
        try {
            const formData = new FormData();
            if (bankInfo.bankName) formData.append('bankName', bankInfo.bankName);
            if (bankInfo.accountHolderName) formData.append('accountHolderName', bankInfo.accountHolderName);
            if (bankInfo.accountNumber) formData.append('accountNumber', bankInfo.accountNumber);
            if (bankInfo.ifscCode) formData.append('ifscCode', bankInfo.ifscCode);
            if (bankInfo.upiId) formData.append('upiId', bankInfo.upiId);

            if (upiQrFile) {
                formData.append('upiQrImage', upiQrFile);
            }

            await sellerApi.updateProfile(formData);
            toast.success("Bank details updated successfully");
            setUpiQrFile(null);
            loadProfile();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to update bank details");
        } finally {
            setIsUpdatingBank(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bank Details</h1>
                <p className="text-slate-500 font-medium">Manage your payout destination and UPI information</p>
            </div>

            <BlurFade delay={0.1}>
                <Card className="p-0 overflow-hidden border-none shadow-xl ring-1 ring-slate-100 bg-white">
                    <div className="p-5 sm:p-6 lg:p-8 border-b border-slate-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-slate-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Bank & UPI Details</h3>
                                <p className="text-sm font-semibold text-slate-500">Update your payout destination</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleUpdateBankInfo} className="p-5 sm:p-6 lg:p-8 space-y-6">
                        {isFetchingProfile ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="h-8 w-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Bank Name</label>
                                        <input
                                            type="text"
                                            name="bankName"
                                            value={bankInfo.bankName}
                                            onChange={handleBankInfoChange}
                                            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-semibold text-sm outline-none transition-all"
                                            placeholder="e.g. HDFC Bank"
                                            maxLength={FIELD_LIMITS.bankName}
                                            inputMode="text"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Account Holder Name</label>
                                        <input
                                            type="text"
                                            name="accountHolderName"
                                            value={bankInfo.accountHolderName}
                                            onChange={handleBankInfoChange}
                                            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-semibold text-sm outline-none transition-all"
                                            placeholder="e.g. Rahul Kumar"
                                            maxLength={FIELD_LIMITS.accountHolderName}
                                            inputMode="text"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Account Number</label>
                                        <input
                                            type="text"
                                            name="accountNumber"
                                            value={bankInfo.accountNumber}
                                            onChange={handleBankInfoChange}
                                            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-semibold text-sm outline-none transition-all"
                                            placeholder="8-18 digits"
                                            minLength={8}
                                            maxLength={FIELD_LIMITS.accountNumber}
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">IFSC Code</label>
                                        <input
                                            type="text"
                                            name="ifscCode"
                                            value={bankInfo.ifscCode}
                                            onChange={handleBankInfoChange}
                                            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-semibold text-sm outline-none transition-all uppercase"
                                            placeholder="11 chars (e.g. HDFC0001234)"
                                            minLength={11}
                                            maxLength={FIELD_LIMITS.ifscCode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">UPI ID</label>
                                        <input
                                            type="text"
                                            name="upiId"
                                            value={bankInfo.upiId}
                                            onChange={handleBankInfoChange}
                                            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-semibold text-sm outline-none transition-all"
                                            placeholder="e.g. rahul@upi"
                                            maxLength={FIELD_LIMITS.upiId}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">UPI QR Image</label>
                                        <div className="flex items-center gap-4">
                                            <label className="flex-1 cursor-pointer">
                                                <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed rounded-xl transition-colors">
                                                    <Upload className="h-4 w-4 text-slate-400" />
                                                    <span className="text-sm font-semibold text-slate-600">
                                                        {upiQrFile ? upiQrFile.name : 'Upload New QR'}
                                                    </span>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => setUpiQrFile(e.target.files[0])}
                                                    className="hidden"
                                                />
                                            </label>
                                            {bankInfo.upiQrImage && !upiQrFile && (
                                                <a href={bankInfo.upiQrImage} target="_blank" rel="noopener noreferrer" className="shrink-0 h-11 w-11 rounded-xl overflow-hidden border border-slate-200">
                                                    <img src={bankInfo.upiQrImage} alt="QR" className="h-full w-full object-cover" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button
                                        type="submit"
                                        disabled={isUpdatingBank}
                                        className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        {isUpdatingBank ? <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Save Bank Details'}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                </Card>
            </BlurFade>
        </div>
    );
};

export default BankDetails;