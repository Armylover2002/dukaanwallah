import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import { sellerApi } from "../services/sellerApi";
import { useToast } from "@shared/components/ui/Toast";
import {
    HiOutlineArrowPath,
    HiOutlineInboxStack,
    HiOutlineEye,
    HiOutlineCalendarDays,
    HiOutlineCheck,
} from "react-icons/hi2";
import { BlurFade } from "@/components/ui/blur-fade";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function ReturnOrders() {
    const { showToast } = useToast();
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("All");
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [confirmingReceiptId, setConfirmingReceiptId] = useState(null);

    const tabs = ["All", "Awaiting Pickup", "Picked Up", "Received", "Refunded"];

    const mapReturnStatusLabel = (status) => {
        switch (status) {
            case "pending_review":
                return "Pending Admin Review";
            case "approved":
            case "pickup_assigned":
                return "Awaiting Pickup";
            case "picked_up":
                return "Picked Up";
            case "delivered_to_seller":
                return "Received (Pending Confirmation)";
            case "refund_processed":
                return "Refunded (Completed)";
            case "rejected":
                return "Rejected";
            default:
                return String(status || "Unknown").replace(/_/g, " ");
        }
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case "pending_review":
                return "warning";
            case "approved":
            case "pickup_assigned":
                return "info";
            case "picked_up":
                return "secondary";
            case "delivered_to_seller":
                return "warning";
            case "refund_processed":
                return "success";
            case "rejected":
                return "error";
            default:
                return "secondary";
        }
    };

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const res = await sellerApi.getQuickCommerceReturns();
            const payload = res?.data?.result || {};
            const items = Array.isArray(payload.items)
                ? payload.items
                : (Array.isArray(res?.data?.results) ? res.data.results : []);
            setReturns(items);
        } catch (error) {
            console.error("Failed to fetch QC returns", error);
            showToast("Failed to fetch return requests", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReturns();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredReturns = useMemo(() => {
        if (activeTab === "All") return returns;
        return returns.filter((r) => {
            if (activeTab === "Awaiting Pickup") {
                return r.status === "approved" || r.status === "pickup_assigned";
            }
            if (activeTab === "Picked Up") {
                return r.status === "picked_up";
            }
            if (activeTab === "Received") {
                return r.status === "delivered_to_seller";
            }
            if (activeTab === "Refunded") {
                return r.status === "refund_processed";
            }
            return false;
        });
    }, [returns, activeTab]);

    const handleConfirmReceipt = async (id, e) => {
        if (e) e.stopPropagation();
        setConfirmingReceiptId(id);
        try {
            const res = await sellerApi.confirmQuickCommerceReturnReceipt(id);
            if (res?.data?.success || res?.status === 200) {
                showToast("Receipt confirmed and refund triggered successfully!", "success");
                await fetchReturns();
                if (selectedReturn && selectedReturn._id === id) {
                    setIsDetailsOpen(false);
                }
            } else {
                showToast(res?.data?.message || "Failed to confirm receipt", "error");
            }
        } catch (error) {
            console.error(error);
            showToast(error?.response?.data?.message || "Failed to confirm receipt. Please try again.", "error");
        } finally {
            setConfirmingReceiptId(null);
        }
    };

    const openDetails = (ret) => {
        setSelectedReturn(ret);
        setIsDetailsOpen(true);
    };

    const getStatsCount = (tabName) => {
        if (tabName === "All") return returns.length;
        if (tabName === "Awaiting Pickup") {
            return returns.filter(r => r.status === "approved" || r.status === "pickup_assigned").length;
        }
        if (tabName === "Picked Up") {
            return returns.filter(r => r.status === "picked_up").length;
        }
        if (tabName === "Received") {
            return returns.filter(r => r.status === "delivered_to_seller").length;
        }
        if (tabName === "Refunded") {
            return returns.filter(r => r.status === "refund_processed").length;
        }
        return 0;
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        Quick Commerce Returns
                    </h1>
                    <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
                        Track and process Quick Commerce customer return orders
                    </p>
                </div>
                <button
                    onClick={fetchReturns}
                    disabled={loading}
                    className="self-start sm:self-auto flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
                >
                    <HiOutlineArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex h-[50vh] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : (
                <>
                    {/* Stats overview cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                        {tabs.map((tab) => {
                            const count = getStatsCount(tab);
                            return (
                                <BlurFade key={tab} delay={0.05} duration={0.3}>
                                    <div 
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "cursor-pointer p-4 rounded-2xl border transition-all duration-300 bg-white",
                                            activeTab === tab 
                                                ? "border-orange-500 shadow-md ring-1 ring-orange-500/20" 
                                                : "border-slate-100 hover:border-slate-200 shadow-sm"
                                        )}
                                    >
                                        <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest truncate">
                                            {tab}
                                        </p>
                                        <h4 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-1.5">
                                            {count}
                                        </h4>
                                    </div>
                                </BlurFade>
                            );
                        })}
                    </div>

                    {/* Returns List Container */}
                    <BlurFade delay={0.15}>
                        <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl bg-white overflow-hidden">
                            {/* Tabs Navbar */}
                            <div className="border-b border-slate-100 bg-slate-50/30 overflow-x-auto scrollbar-hide">
                                <div className="flex px-4 sm:px-6 items-center min-w-max">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={cn(
                                                "relative py-4 px-3 sm:px-5 text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 outline-none",
                                                activeTab === tab
                                                    ? "text-orange-500 scale-105"
                                                    : "text-slate-600 hover:text-slate-700"
                                            )}
                                        >
                                            {tab}
                                            {activeTab === tab && (
                                                <motion.div
                                                    layoutId="qc-returns-tab-underline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-full mx-3 sm:mx-5"
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* List Content */}
                            <div className="p-4 sm:p-6">
                                {filteredReturns.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 px-4">
                                        <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 mb-4">
                                            <HiOutlineInboxStack className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900">
                                            No return orders found
                                        </h3>
                                        <p className="text-xs text-slate-600 font-semibold text-center mt-1">
                                            Return tasks matching tab "{activeTab}" will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredReturns.map((ret) => (
                                            <div
                                                key={ret._id}
                                                onClick={() => openDetails(ret)}
                                                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4 cursor-pointer"
                                            >
                                                <div className="min-w-0 flex-1 space-y-1.5">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-xs font-black text-slate-900">
                                                            Return ID: QC-RET-{String(ret._id).slice(-6).toUpperCase()}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">• Order #{ret.orderId}</span>
                                                    </div>

                                                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                                                        <HiOutlineCalendarDays className="h-3.5 w-3.5 shrink-0" />
                                                        <span>
                                                            Requested: {new Date(ret.createdAt).toLocaleString("en-IN", {
                                                                day: "2-digit",
                                                                month: "short",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs font-bold text-slate-800">
                                                        Customer: {ret.userId?.name || "Guest User"}
                                                    </p>

                                                    <div className="text-xs text-slate-500 line-clamp-1 leading-relaxed bg-slate-50 rounded-lg p-2.5 max-w-xl">
                                                        <span className="font-bold text-slate-600">Reason:</span> "{ret.reason}"
                                                    </div>

                                                    {["approved", "pickup_assigned", "picked_up"].includes(ret.status) && ret.sellerDeliveryOtp && (
                                                        <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1 rounded-lg border border-orange-100 text-xs font-bold w-fit mt-1">
                                                            <span>Delivery OTP:</span>
                                                            <span className="font-mono tracking-wider bg-white px-1.5 py-0.5 rounded border border-orange-200">{ret.sellerDeliveryOtp}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between md:flex-col md:items-end gap-3 shrink-0 pt-3 md:pt-0 border-t border-slate-50 md:border-none">
                                                    <div className="flex flex-col md:items-end gap-1">
                                                        <Badge
                                                            variant={getStatusVariant(ret.status)}
                                                            className="text-[9px] font-black uppercase px-2 py-0.5 tracking-wider shrink-0"
                                                        >
                                                            {mapReturnStatusLabel(ret.status)}
                                                        </Badge>
                                                        <span className="text-xs text-slate-400 font-bold mt-1 text-right block">
                                                            {String(ret.refundMethod).toUpperCase()} REFUND
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <span className="text-base font-black text-slate-950">
                                                            ₹{Number(ret.refundAmount || 0).toFixed(2)}
                                                        </span>

                                                        {ret.status === "delivered_to_seller" && (
                                                            <button
                                                                onClick={(e) => handleConfirmReceipt(ret._id, e)}
                                                                disabled={confirmingReceiptId === ret._id}
                                                                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-green-500/10 active:scale-95 transition-all disabled:opacity-50"
                                                            >
                                                                {confirmingReceiptId === ret._id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <HiOutlineCheck className="w-3.5 h-3.5" />
                                                                )}
                                                                Confirm Receipt
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDetails(ret);
                                                            }}
                                                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-colors border border-slate-100"
                                                        >
                                                            <HiOutlineEye className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    </BlurFade>
                </>
            )}

            {/* Details Modal */}
            <AnimatePresence>
                {isDetailsOpen && selectedReturn && (
                    <div className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center p-3 sm:p-6 lg:p-12">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/40 backdrop-blur-md"
                            onClick={() => setIsDetailsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="w-full max-w-lg sm:max-w-2xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        Return Request Details
                                    </h3>
                                    <div className="flex items-center space-x-2 mt-0.5">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                                            Return ID: QC-RET-{String(selectedReturn._id).slice(-6).toUpperCase()}
                                        </span>
                                        <Badge
                                            variant={getStatusVariant(selectedReturn.status)}
                                            className="text-[9px] font-black uppercase px-1.5 py-0"
                                        >
                                            {mapReturnStatusLabel(selectedReturn.status)}
                                        </Badge>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors border border-slate-100"
                                >
                                    <HiOutlineCheck className="hidden" />
                                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                                
                                {/* Status Alert Banner */}
                                {selectedReturn.status === "delivered_to_seller" && (
                                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-orange-950">
                                        <div>
                                            <span className="font-bold block">Action Required</span>
                                            <p className="text-[11px] text-orange-800 mt-0.5">Please confirm that you have received the items. Once confirmed, the refund process will be completed.</p>
                                        </div>
                                        <button
                                            onClick={() => handleConfirmReceipt(selectedReturn._id)}
                                            disabled={confirmingReceiptId === selectedReturn._id}
                                            className="sm:shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-green-500/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        >
                                            {confirmingReceiptId === selectedReturn._id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <HiOutlineCheck className="w-3.5 h-3.5" />
                                            )}
                                            Confirm Receipt
                                        </button>
                                    </div>
                                )}

                                {/* Delivery OTP for Seller */}
                                {["approved", "pickup_assigned", "picked_up"].includes(selectedReturn.status) && selectedReturn.sellerDeliveryOtp && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs text-blue-950">
                                        <div>
                                            <span className="font-bold text-blue-900 block">Seller Return Delivery OTP</span>
                                            <p className="text-[11px] text-blue-700 mt-0.5">Provide this code to the delivery rider when they arrive to return the items.</p>
                                        </div>
                                        <div className="shrink-0 bg-white border border-blue-200 px-4 py-2 rounded-2xl shadow-sm text-center">
                                            <span className="text-lg font-black tracking-widest text-blue-900 font-mono">
                                                {selectedReturn.sellerDeliveryOtp}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Customer Info */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Customer Details</span>
                                        <h4 className="text-sm font-bold text-slate-900 mt-1.5">{selectedReturn.userId?.name || "Guest User"}</h4>
                                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{selectedReturn.userId?.email || ""}</p>
                                        {selectedReturn.userId?.phone && (
                                            <p className="text-xs text-slate-500 font-mono mt-1">{selectedReturn.userId.phone}</p>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Refund Details</span>
                                        <h4 className="text-sm font-bold text-slate-900 mt-1.5">Amount: ₹{Number(selectedReturn.refundAmount || 0).toFixed(2)}</h4>
                                        <p className="text-xs text-slate-600 mt-1">Method: {String(selectedReturn.refundMethod).toUpperCase()}</p>
                                        <p className="text-[10px] text-slate-500 font-semibold mt-1">Status: {mapReturnStatusLabel(selectedReturn.status)}</p>
                                    </div>
                                </div>

                                {/* Address snapshot */}
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Pick up Address</span>
                                    <p className="text-xs text-slate-700 font-semibold mt-1.5 leading-relaxed">
                                        {selectedReturn.customerAddress?.street}, {selectedReturn.customerAddress?.city}, {selectedReturn.customerAddress?.state}
                                    </p>
                                </div>

                                {/* Return Items List */}
                                <div className="space-y-2.5">
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Returned Items</span>
                                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                                        <table className="w-full border-collapse text-left text-xs">
                                            <thead>
                                                <tr className="bg-slate-100/80 font-black text-slate-500 uppercase tracking-widest text-[9px] border-b border-slate-100">
                                                    <th className="px-4 py-3">Item</th>
                                                    <th className="px-4 py-3 text-center">Qty</th>
                                                    <th className="px-4 py-3 text-right">Price</th>
                                                    <th className="px-4 py-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold">
                                                {selectedReturn.returnItems?.map((item, index) => (
                                                    <tr key={index} className="text-slate-700 bg-white">
                                                        <td className="px-4 py-3 truncate max-w-[200px]">{item.name}</td>
                                                        <td className="px-4 py-3 text-center font-mono">{item.quantity}</td>
                                                        <td className="px-4 py-3 text-right font-mono">₹{Number(item.price).toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-right font-mono text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Proof Photo and Rejection details */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Customer Proof Photo */}
                                    {selectedReturn.proofImageUrl && (
                                        <div className="space-y-2">
                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Customer Proof Photo</span>
                                            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50 shadow-sm max-w-xs">
                                                <img 
                                                    src={selectedReturn.proofImageUrl} 
                                                    alt="Customer Proof" 
                                                    className="w-full h-44 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => window.open(selectedReturn.proofImageUrl, "_blank")}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Pickup Proof Photo */}
                                    {selectedReturn.pickupProofImageUrl && (
                                        <div className="space-y-2">
                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Rider Pickup Proof</span>
                                            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50 shadow-sm max-w-xs">
                                                <img 
                                                    src={selectedReturn.pickupProofImageUrl} 
                                                    alt="Pickup Proof" 
                                                    className="w-full h-44 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => window.open(selectedReturn.pickupProofImageUrl, "_blank")}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Rejection Details */}
                                {selectedReturn.status === "rejected" && selectedReturn.rejectionReason && (
                                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-xs text-rose-800">
                                        <span className="font-bold">Rejection Reason:</span>
                                        <p className="mt-1 font-semibold leading-relaxed">"{selectedReturn.rejectionReason}"</p>
                                    </div>
                                )}

                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
                                <button
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
