import React, { useState, useEffect, useMemo } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Pagination from '@shared/components/ui/Pagination';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';
import {
  Search,
  Filter,
  RotateCcw,
  Eye,
  Check,
  X,
  Settings,
  AlertCircle,
  Calendar,
  Package,
  MapPin,
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Building2,
  ExternalLink,
  ChevronRight,
  Truck,
  RefreshCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_TABS = [
  { id: 'all', label: 'All Returns' },
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'pickup_assigned', label: 'Pickup Assigned' },
  { id: 'picked_up', label: 'Picked Up' },
  { id: 'delivered_to_seller', label: 'With Seller' },
  { id: 'refund_processed', label: 'Refunded' },
  { id: 'rejected', label: 'Rejected' }
];

const getStatusBadgeVariant = (status) => {
  switch (status) {
    case 'pending_review': return 'warning';
    case 'approved': return 'info';
    case 'pickup_assigned': return 'indigo';
    case 'picked_up': return 'secondary';
    case 'delivered_to_seller': return 'primary';
    case 'refund_processed': return 'success';
    case 'rejected': return 'danger';
    default: return 'outline';
  }
};

const formatStatusText = (status) => {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').toUpperCase();
};

const ReturnOrders = () => {
  const { showToast } = useToast();
  
  // State variables
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  
  // Return eligibility settings
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [returnWindowDays, setReturnWindowDays] = useState(7);
  const [isReturnEnabled, setIsReturnEnabled] = useState(true);
  
  // Modals & Drawers
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  // Input states for modals
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [retriggeringRefund, setRetriggeringRefund] = useState(false);

  // Fetch returns list
  const fetchReturns = async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = {
        page: targetPage,
        limit: pageSize,
        status: activeTab === 'all' ? undefined : activeTab
      };
      const response = await adminApi.getReturnOrders(params);
      if (response?.data?.success) {
        const result = response.data.result || {};
        setReturns(result.items || []);
        setTotal(result.total || 0);
        setPage(result.page || targetPage);
      } else {
        showToast('Failed to load return orders', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading return orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch settings
  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await adminApi.getReturnSettings();
      if (response?.data?.success) {
        const settings = response.data.result || {};
        setReturnWindowDays(settings.returnWindowDays || 7);
        setIsReturnEnabled(settings.isReturnEnabled !== false);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load return settings', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Save settings
  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await adminApi.updateReturnSettings({
        returnWindowDays,
        isReturnEnabled
      });
      if (response?.data?.success) {
        showToast('Return settings updated successfully', 'success');
      } else {
        showToast('Failed to update settings', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating settings', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Fetch available delivery partners for assignment
  const fetchAvailablePartners = async () => {
    setPartnersLoading(true);
    try {
      const response = await adminApi.getAvailableReturnPartners();
      if (response?.data?.success) {
        setPartners(response.data.result || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load delivery partners', 'error');
    } finally {
      setPartnersLoading(false);
    }
  };

  // Lifecycle effects
  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchReturns(1);
  }, [activeTab, pageSize]);

  // Handle Return Approval
  const handleApprove = async () => {
    if (!selectedReturn) return;
    setSubmittingAction(true);
    try {
      const response = await adminApi.approveReturnOrder(selectedReturn._id, {
        partnerId: selectedPartnerId || undefined
      });
      if (response?.data?.success) {
        showToast('Return request approved successfully', 'success');
        setIsApproveModalOpen(false);
        // Refresh details if drawer is open
        if (isDrawerOpen) {
          const detailRes = await adminApi.getReturnOrderById(selectedReturn._id);
          if (detailRes?.data?.success) setSelectedReturn(detailRes.data.result);
        }
        fetchReturns(page);
      } else {
        showToast('Failed to approve return request', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error approving return request', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Return Rejection
  const handleReject = async () => {
    if (!selectedReturn) return;
    if (!rejectionReason.trim()) {
      showToast('Rejection reason is required', 'warning');
      return;
    }
    setSubmittingAction(true);
    try {
      const response = await adminApi.rejectReturnOrder(selectedReturn._id, {
        reason: rejectionReason
      });
      if (response?.data?.success) {
        showToast('Return request rejected successfully', 'success');
        setIsRejectModalOpen(false);
        setRejectionReason('');
        // Refresh details if drawer is open
        if (isDrawerOpen) {
          const detailRes = await adminApi.getReturnOrderById(selectedReturn._id);
          if (detailRes?.data?.success) setSelectedReturn(detailRes.data.result);
        }
        fetchReturns(page);
      } else {
        showToast('Failed to reject return request', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error rejecting return request', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Partner Assignment
  const handleAssignPartner = async () => {
    if (!selectedReturn || !selectedPartnerId) {
      showToast('Please select a delivery partner', 'warning');
      return;
    }
    setSubmittingAction(true);
    try {
      const response = await adminApi.assignReturnPartner(selectedReturn._id, {
        partnerId: selectedPartnerId
      });
      if (response?.data?.success) {
        showToast('Delivery partner assigned successfully', 'success');
        setIsAssignModalOpen(false);
        // Refresh details if drawer is open
        if (isDrawerOpen) {
          const detailRes = await adminApi.getReturnOrderById(selectedReturn._id);
          if (detailRes?.data?.success) setSelectedReturn(detailRes.data.result);
        }
        fetchReturns(page);
      } else {
        showToast('Failed to assign delivery partner', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error assigning delivery partner', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Re-trigger Refund (fixes stuck orders marked as processed without actual wallet credit)
  const handleRetriggerRefund = async () => {
    if (!selectedReturn) return;
    setRetriggeringRefund(true);
    try {
      const response = await adminApi.retriggerReturnRefund(selectedReturn._id);
      if (response?.data?.success) {
        showToast('Refund and payout re-triggered successfully. Check wallet transactions.', 'success');
        // Refresh details
        const detailRes = await adminApi.getReturnOrderById(selectedReturn._id);
        if (detailRes?.data?.success) setSelectedReturn(detailRes.data.result);
        fetchReturns(page);
      } else {
        showToast(response?.data?.message || 'Failed to re-trigger refund', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.message || 'Error re-triggering refund', 'error');
    } finally {
      setRetriggeringRefund(false);
    }
  };

  // Open detail drawer
  const handleViewDetails = async (retOrder) => {
    try {
      const response = await adminApi.getReturnOrderById(retOrder._id);
      if (response?.data?.success) {
        setSelectedReturn(response.data.result);
        setIsDrawerOpen(true);
      } else {
        showToast('Failed to load details', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading details', 'error');
    }
  };

  // Filter returns by search term locally
  const filteredReturns = useMemo(() => {
    if (!searchTerm.trim()) return returns;
    const term = searchTerm.toLowerCase();
    return returns.filter(item => {
      const orderIdMatch = String(item.orderId || '').toLowerCase().includes(term);
      const userMatch = item.userId?.name ? String(item.userId.name).toLowerCase().includes(term) : false;
      const sellerMatch = item.sellerId?.shopName ? String(item.sellerId.shopName).toLowerCase().includes(term) : false;
      return orderIdMatch || userMatch || sellerMatch;
    });
  }, [returns, searchTerm]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Return Orders
            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-500">
              <RotateCcw className="h-5 w-5" />
            </div>
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Manage customer return eligibility and process orders pickups.</p>
        </div>
      </div>

      {/* Global Config Card */}
      <Card className="border-none shadow-sm ring-1 ring-slate-100 bg-white">
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Return Eligibility Settings</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Define the global number of days after delivery during which a customer can request a return for Quick Commerce orders.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Return Window (Days)</label>
              <input
                type="number"
                min="1"
                max="90"
                value={returnWindowDays}
                onChange={(e) => setReturnWindowDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))}
                disabled={settingsLoading}
                className="w-32 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50/20 transition-all text-center"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Enable Returns</label>
              <button
                onClick={() => setIsReturnEnabled(!isReturnEnabled)}
                disabled={settingsLoading}
                className={cn(
                  "relative inline-flex h-9 w-20 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isReturnEnabled ? "bg-emerald-500" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out mt-0.5",
                    isReturnEnabled ? "translate-x-11" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={settingsLoading}
              className="sm:self-end h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center"
            >
              {settingsLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </Card>

      {/* Tabs list */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border",
              activeTab === tab.id
                ? "bg-rose-50 border-rose-200 text-rose-600 shadow-sm"
                : "bg-white hover:bg-slate-50 border-slate-100 text-slate-500"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table and List Card */}
      <Card className="border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
        {/* Search header */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative group max-w-sm w-full">
            <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by Order ID, User, or Seller..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-4 focus:ring-rose-50/20 focus:border-rose-200 transition-all"
            />
          </div>
          
          <button
            onClick={() => fetchReturns(1)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-sm self-start border border-slate-100"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Return ID</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Original Order</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-7 w-7 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Syncing return files...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredReturns.length > 0 ? (
                filteredReturns.map((item) => (
                  <tr
                    key={item._id}
                    onClick={() => handleViewDetails(item)}
                    className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                  >
                    <td className="px-5 py-4.5">
                      <span className="text-xs font-black text-slate-700">#{String(item._id).substring(18).toUpperCase()}</span>
                    </td>
                    <td className="px-5 py-4.5">
                      <span className="text-xs font-bold text-slate-600">{item.orderId}</span>
                    </td>
                    <td className="px-5 py-4.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-xs font-bold uppercase">
                          {(item.userId?.name || 'G')[0]}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-700">{item.userId?.name || 'Guest User'}</p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{item.userId?.phone || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4.5">
                      <span className="text-xs font-bold text-slate-600">{item.sellerId?.shopName || 'Unknown Store'}</span>
                    </td>
                    <td className="px-5 py-4.5">
                      <Badge variant="outline" className="text-[10px] font-bold py-0.5 uppercase">
                        {item.refundMethod === 'wallet' ? 'Wallet' : 'Bank'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4.5 text-right font-black text-slate-800 text-xs">
                      ₹{Number(item.refundAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4.5">
                      <Badge variant={getStatusBadgeVariant(item.status)} className="text-[9px] font-black tracking-wide py-0.5 uppercase">
                        {formatStatusText(item.status)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetails(item)}
                          className="p-2 bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        {item.status === 'pending_review' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedReturn(item);
                                fetchAvailablePartners();
                                setSelectedPartnerId('');
                                setIsApproveModalOpen(true);
                              }}
                              className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all"
                              title="Approve & Assign"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedReturn(item);
                                setRejectionReason('');
                                setIsRejectModalOpen(true);
                              }}
                              className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg transition-all"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {['approved', 'pickup_assigned'].includes(item.status) && (
                          <button
                            onClick={() => {
                              setSelectedReturn(item);
                              fetchAvailablePartners();
                              setSelectedPartnerId(item.deliveryPartnerId?._id || '');
                              setIsAssignModalOpen(true);
                            }}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                            title="Assign Rider"
                          >
                            <Truck className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-slate-50 text-slate-300 rounded-full">
                        <AlertCircle className="h-8 w-8" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-700">No Return Orders</h4>
                      <p className="text-xs text-slate-400">There are no return request orders matching the selected filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination element */}
        {total > pageSize && (
          <div className="p-4 border-t border-slate-50">
            <Pagination
              page={page}
              totalPages={Math.ceil(total / pageSize) || 1}
              total={total}
              pageSize={pageSize}
              onPageChange={(p) => fetchReturns(p)}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
              loading={loading}
            />
          </div>
        )}
      </Card>

      {/* DETAIL DRAWER */}
      {isDrawerOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          />

          {/* Drawer content panel */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Quick Return Request</span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5">
                  #{String(selectedReturn._id).substring(18).toUpperCase()}
                </h2>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all border border-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
              
              {/* Order Info & Status */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Original Order ID</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{selectedReturn.orderId}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Workflow State</p>
                  <Badge variant={getStatusBadgeVariant(selectedReturn.status)} className="text-[9px] font-black py-0.5 uppercase tracking-wide mt-0.5">
                    {formatStatusText(selectedReturn.status)}
                  </Badge>
                </div>
              </div>

              {/* Customer Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <User className="h-4 w-4" /> Customer Details
                </h4>
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 space-y-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-400">Name</span>
                    <span className="font-bold text-slate-700">{selectedReturn.userId?.name || 'Guest Customer'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-400">Phone</span>
                    <span className="font-bold text-slate-700">{selectedReturn.userId?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-400">Address</span>
                    <span className="font-bold text-slate-700 text-right max-w-xs leading-normal">
                      {[selectedReturn.customerAddress?.street, selectedReturn.customerAddress?.city].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Return Items */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Package className="h-4 w-4" /> Return Items ({selectedReturn.returnItems?.length || 0})
                </h4>
                <div className="divide-y divide-slate-100 bg-slate-50/30 rounded-2xl border border-slate-100 overflow-hidden">
                  {selectedReturn.returnItems?.map((item, i) => (
                    <div key={i} className="p-4 flex gap-4 items-center">
                      <div className="h-12 w-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-100">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-6 w-6 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-slate-800 truncate">{item.name}</h5>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          ₹{Number(item.price).toLocaleString()} × {item.quantity}
                        </p>
                      </div>
                      <span className="text-xs font-black text-slate-800 shrink-0">
                        ₹{Number(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="p-4 bg-slate-50 flex items-center justify-between text-xs font-black border-t border-slate-100">
                    <span className="text-slate-500 uppercase tracking-wider text-[10px]">Total Refund Amount</span>
                    <span className="text-slate-800 text-sm">₹{Number(selectedReturn.refundAmount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Customer Return Proof & Reason */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Return Reason & Proof</h4>
                </div>
                
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reason</span>
                    <p className="text-xs font-medium text-slate-700 bg-white p-3 rounded-xl border border-slate-100 shadow-2xs leading-normal">
                      "{selectedReturn.reason}"
                    </p>
                  </div>

                  {selectedReturn.proofImageUrl && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Proof Attachment</span>
                      <div className="relative group max-w-sm rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
                        <img src={selectedReturn.proofImageUrl} alt="Return Proof" className="w-full h-auto max-h-56 object-contain" />
                        <a
                          href={selectedReturn.proofImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute right-3 top-3 p-2 bg-white/80 hover:bg-white text-slate-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 text-[10px] font-bold"
                        >
                          <ExternalLink className="h-3 w-3" /> OPEN FULL IMAGE
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Refund Method details */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Refund Settlement Option</h4>
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-400">Preferred Method</span>
                    <Badge variant="outline" className="text-[10px] font-black tracking-wide py-0.5 uppercase">
                      {selectedReturn.refundMethod === 'wallet' ? 'Refund to User Wallet' : 'Refund to Bank Account'}
                    </Badge>
                  </div>
                  
                  {selectedReturn.refundMethod === 'bank_account' && selectedReturn.bankDetails && (
                    <div className="pt-2 border-t border-slate-100 text-xs space-y-2 text-slate-600">
                      <div className="flex justify-between">
                        <span>Holder Name:</span>
                        <strong className="text-slate-800">{selectedReturn.bankDetails.accountHolderName}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Account Number:</span>
                        <strong className="text-slate-800">{selectedReturn.bankDetails.accountNumber}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>IFSC Code:</span>
                        <strong className="text-slate-800">{selectedReturn.bankDetails.ifscCode}</strong>
                      </div>
                      {selectedReturn.bankDetails.bankName && (
                        <div className="flex justify-between">
                          <span>Bank Name:</span>
                          <strong className="text-slate-800">{selectedReturn.bankDetails.bankName}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedReturn.refundTransactionId && (
                    <div className="pt-2 border-t border-slate-100 flex justify-between text-xs items-center">
                      <span className="font-semibold text-slate-400">Ref / Transaction ID:</span>
                      <strong className="text-slate-800 text-[11px] font-mono select-all bg-white px-2 py-1 rounded-md border border-slate-100">
                        {selectedReturn.refundTransactionId}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Rider Assignment Details */}
              {(selectedReturn.deliveryPartnerId || ['approved', 'pickup_assigned'].includes(selectedReturn.status)) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Truck className="h-4 w-4" /> Delivery Pickup Details
                    </h4>
                    {['approved', 'pickup_assigned'].includes(selectedReturn.status) && (
                      <button
                        onClick={() => {
                          fetchAvailablePartners();
                          setSelectedPartnerId(selectedReturn.deliveryPartnerId?._id || '');
                          setIsAssignModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-600 rounded-xl transition-all"
                      >
                        {selectedReturn.deliveryPartnerId ? "Change Delivery Partner" : "Assign Delivery Partner"}
                      </button>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 space-y-2.5">
                    {selectedReturn.deliveryPartnerId ? (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-400">Rider Name</span>
                          <span className="font-bold text-slate-700">{selectedReturn.deliveryPartnerId?.name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-400">Rider Phone</span>
                          <span className="font-bold text-slate-700">{selectedReturn.deliveryPartnerId?.phone || 'N/A'}</span>
                        </div>
                        
                        {selectedReturn.pickupOtp && (
                          <div className="flex justify-between text-xs items-center pt-1">
                            <span className="font-semibold text-slate-400">Rider OTP Code</span>
                            <span className="text-xs font-black tracking-widest text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1 rounded-lg">
                              {selectedReturn.pickupOtp}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-400">OTP Status</span>
                          <Badge variant={selectedReturn.otpVerified ? 'success' : 'outline'} className="text-[9px] font-bold py-0.5">
                            {selectedReturn.otpVerified ? 'VERIFIED' : 'PENDING'}
                          </Badge>
                        </div>

                        {selectedReturn.pickupProofImageUrl && (
                          <div className="pt-2.5 space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pickup Proof Photo</span>
                            <div className="max-w-xs rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                              <img src={selectedReturn.pickupProofImageUrl} alt="Pickup Proof" className="w-full h-auto max-h-40 object-cover" />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-2 text-center">
                        <p className="text-xs text-slate-500 font-semibold">No delivery partner assigned yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Seller confirmation details */}
              {selectedReturn.sellerConfirmedAt && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" /> Seller Confirmation
                  </h4>
                  <div className="p-4 bg-emerald-50/20 rounded-2xl border border-emerald-100/30 text-xs flex items-center justify-between text-emerald-800">
                    <span className="font-semibold">Confirmed Received At:</span>
                    <strong className="font-bold">{new Date(selectedReturn.sellerConfirmedAt).toLocaleString()}</strong>
                  </div>
                </div>
              )}

              {/* Rejection / Note Details */}
              {(selectedReturn.rejectionReason || selectedReturn.adminNote) && (
                <div className="p-4 bg-rose-50/20 rounded-2xl border border-rose-100/30 text-xs space-y-2">
                  {selectedReturn.rejectionReason && (
                    <div className="space-y-1">
                      <span className="font-black text-rose-800 uppercase text-[9px] tracking-wider">Rejection Reason</span>
                      <p className="text-rose-700 bg-white p-2.5 rounded-xl border border-rose-100/50 leading-relaxed font-medium">"{selectedReturn.rejectionReason}"</p>
                    </div>
                  )}
                  {selectedReturn.adminNote && (
                    <div className="space-y-1">
                      <span className="font-black text-slate-600 uppercase text-[9px] tracking-wider">Admin Internal Note</span>
                      <p className="text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 leading-relaxed font-medium">"{selectedReturn.adminNote}"</p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Drawer Actions Footer */}
            {selectedReturn.status === 'pending_review' && (
              <div className="p-6 border-t border-slate-100 grid grid-cols-2 gap-4 bg-slate-50">
                <button
                  onClick={() => {
                    fetchAvailablePartners();
                    setSelectedPartnerId('');
                    setIsApproveModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Check className="h-4 w-4" /> APPROVE & PICKUP
                </button>
                <button
                  onClick={() => {
                    setRejectionReason('');
                    setIsRejectModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <X className="h-4 w-4" /> REJECT REQUEST
                </button>
              </div>
            )}
            
            {['approved', 'pickup_assigned'].includes(selectedReturn.status) && (
              <div className="p-6 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => {
                    fetchAvailablePartners();
                    setSelectedPartnerId(selectedReturn.deliveryPartnerId?._id || '');
                    setIsAssignModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Truck className="h-4 w-4" /> {selectedReturn.deliveryPartnerId ? 'CHANGE DELIVERY PARTNER' : 'ASSIGN DELIVERY PARTNER'}
                </button>
              </div>
            )}

            {/* Re-trigger Refund Button — for stuck orders */}
            {selectedReturn.status === 'delivered_to_seller' && (
              <div className="p-6 border-t border-slate-100 bg-amber-50">
                <div className="mb-3 text-xs text-amber-700 font-semibold">
                  Re-trigger refund and payout if the customer or rider did not receive their credit.
                </div>
                <button
                  onClick={handleRetriggerRefund}
                  disabled={retriggeringRefund}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  {retriggeringRefund ? (
                    <><RefreshCcw className="h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    <><RefreshCcw className="h-4 w-4" /> RE-TRIGGER REFUND &amp; PAYOUT</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPROVAL MODAL */}
      {isApproveModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-slate-900 mb-2">Approve Return Order</h3>
            <p className="text-xs text-slate-500 font-semibold mb-6">
              You are approving the return request for Order <span className="text-rose-500 font-bold">#{selectedReturn.orderId}</span>. Please assign a delivery partner for pickup.
            </p>

            <div className="space-y-4 mb-6 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Delivery Rider (Optional)</label>
                {partnersLoading ? (
                  <div className="py-2.5 text-center text-xs text-slate-400">Scanning fleet riders...</div>
                ) : (
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-rose-300 transition-all cursor-pointer"
                  >
                    <option value="">Keep Unassigned / Manual Dispatch</option>
                    {partners.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.phone})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Only online and approved delivery partners are shown.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIsApproveModalOpen(false)}
                disabled={submittingAction}
                className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submittingAction}
                className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:bg-slate-200"
              >
                {submittingAction ? 'Approving...' : 'Confirm Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {isRejectModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-slate-900 mb-2">Reject Return Order</h3>
            <p className="text-xs text-slate-500 font-semibold mb-5">
              Please enter the reason for rejecting the return request for Order <span className="text-rose-500 font-bold">#{selectedReturn.orderId}</span>.
            </p>

            <div className="mb-6">
              <textarea
                placeholder="Write rejection reason here..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={submittingAction}
                rows="4"
                className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold outline-none focus:border-rose-300 transition-all resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                disabled={submittingAction}
                className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={submittingAction}
                className="py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:bg-slate-200"
              >
                {submittingAction ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN PARTNER MODAL */}
      {isAssignModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-slate-900 mb-2">Assign Delivery Partner</h3>
            <p className="text-xs text-slate-500 font-semibold mb-6">
              Choose a delivery partner to perform the return pickup from the customer for Order <span className="text-rose-500 font-bold">#{selectedReturn.orderId}</span>.
            </p>

            <div className="space-y-4 mb-6 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Delivery Rider</label>
                {partnersLoading ? (
                  <div className="py-2.5 text-center text-xs text-slate-400">Searching online partners...</div>
                ) : (
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-blue-300 transition-all cursor-pointer"
                  >
                    <option value="" disabled>-- Select Delivery Rider --</option>
                    {partners.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.phone})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Assigning a partner will generate a pickup OTP and update status to pickup_assigned.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                disabled={submittingAction}
                className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignPartner}
                disabled={submittingAction}
                className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:bg-slate-200"
              >
                {submittingAction ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReturnOrders;
