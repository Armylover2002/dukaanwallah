import { useState, useMemo, useEffect } from "react";
import { Search, Download, Plus, Edit3, Trash2, ChevronDown, FileText, FileSpreadsheet, Code, Check, Settings2, Loader2, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog";
import { toast } from "react-hot-toast";
import { adminAPI } from "@food/api";

const DURATION_UNITS = [
    { label: 'Day', value: 'DAY' },
    { label: 'Week', value: 'WEEK' },
    { label: 'Month', value: 'MONTH' },
    { label: 'Year', value: 'YEAR' }
];

export default function SubscriptionManagement() {
    const [activeTab, setActiveTab] = useState("RESTAURANT");
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [showInactive, setShowInactive] = useState(false);

    const normalizePlans = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    };

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        durationValue: 1,
        durationUnit: "DAY",
        isActive: true
    });

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const response = await adminAPI.getSubscriptionPlans({ 
                userType: activeTab,
                includeInactive: showInactive 
            });
            setPlans(normalizePlans(response.data));
        } catch (error) {
            setPlans([]);
            toast.error("Failed to fetch subscription plans");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, [activeTab, showInactive]);

    const filteredPlans = useMemo(() => {
        return normalizePlans(plans).filter(plan => 
            plan.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
        );
    }, [plans, searchQuery]);

    const handleOpenModal = (plan = null) => {
        if (plan) {
            setEditingPlan(plan);
            setFormData({
                name: plan.name,
                description: plan.description || "",
                price: plan.price,
                durationValue: plan.durationValue,
                durationUnit: plan.durationUnit,
                isActive: plan.isActive
            });
        } else {
            setEditingPlan(null);
            setFormData({
                name: "",
                description: "",
                price: "",
                durationValue: 1,
                durationUnit: "DAY",
                isActive: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                userType: activeTab,
                price: Number(formData.price)
            };

            if (editingPlan) {
                await adminAPI.updateSubscriptionPlan(editingPlan._id, payload);
                toast.success("Plan updated successfully");
            } else {
                await adminAPI.createSubscriptionPlan(payload);
                toast.success("Plan created successfully");
            }
            setIsModalOpen(false);
            fetchPlans();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this plan?")) return;
        try {
            await adminAPI.deleteSubscriptionPlan(id);
            toast.success("Plan deleted successfully");
            fetchPlans();
        } catch (error) {
            toast.error("Failed to delete plan");
        }
    };

    const toggleStatus = async (plan) => {
        try {
            await adminAPI.updateSubscriptionPlan(plan._id, { isActive: !plan.isActive });
            toast.success(`Plan ${plan.isActive ? 'disabled' : 'enabled'} successfully`);
            fetchPlans();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    return (
        <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Settings2 className="w-7 h-7 text-[#FE5502]" />
                        <span>Subscription Management</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Manage plans for restaurants and delivery partners</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-[#FE5502] hover:bg-[#E64D02] text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    <span>Create New Plan</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-200 rounded-xl w-fit mb-6">
                <button
                    onClick={() => setActiveTab("RESTAURANT")}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "RESTAURANT" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                    Restaurants
                </button>
                <button
                    onClick={() => setActiveTab("DELIVERY_PARTNER")}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "DELIVERY_PARTNER" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                    Delivery Partners
                </button>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Selling Plans</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-2">{plans.filter(p => p.isActive).length}</h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Subscribers</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-2">--</h3>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plan Types</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-2">Day, Week, Month</h3>
                </div>
            </div>

            {/* Main Table Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Table Header / Actions */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search by plan name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FE5502]/20 focus:border-[#FE5502] transition-all"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowInactive(!showInactive)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                showInactive 
                                    ? 'bg-orange-50 text-[#FE5502] border border-orange-200' 
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <AlertCircle className="w-4 h-4" />
                            <span>{showInactive ? 'Hide Archived' : 'Show Archived'}</span>
                        </button>
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all">
                                <Download className="w-4 h-4" />
                                <span>Export</span>
                                <ChevronDown className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                    <span>Excel</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    <span>CSV</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan Details</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pricing</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 text-[#FE5502] animate-spin" />
                                            <p className="text-sm text-slate-500">Loading plans...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPlans.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                                                <AlertCircle className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">No plans found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredPlans.map((plan) => (
                                    <tr key={plan._id} className={`hover:bg-slate-50/50 transition-colors group ${!plan.isActive ? 'opacity-60 bg-slate-50/30 grayscale-[0.3]' : ''}`}>

                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900">{plan.name}</span>
                                                <span className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{plan.description || 'No description'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-slate-900">₹{plan.price}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-slate-700">{plan.durationValue} {plan.durationUnit}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${plan.paymentType === 'RECURRING' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {plan.paymentType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => toggleStatus(plan)}
                                                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${plan.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                                            >
                                                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${plan.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleOpenModal(plan)}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(plan._id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                    <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50/50 border-b border-slate-100">
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                <Plus className="w-5 h-5 text-[#FE5502]" />
                            </div>
                            {editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Plan Name</label>
                            <input 
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                placeholder="e.g. Premium Monthly"
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#FE5502]/10 focus:border-[#FE5502] transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Description</label>
                            <textarea 
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                placeholder="What's included in this plan? (e.g. Priority support, lower commissions)"
                                rows="3"
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#FE5502]/10 focus:border-[#FE5502] transition-all placeholder:text-slate-400 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Price (₹)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                                    <input 
                                        type="number"
                                        required
                                        min="0"
                                        value={formData.price}
                                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#FE5502]/10 focus:border-[#FE5502] transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Duration Unit</label>
                                <div className="relative">
                                    <select 
                                        value={formData.durationUnit}
                                        onChange={(e) => setFormData({...formData, durationUnit: e.target.value})}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#FE5502]/10 focus:border-[#FE5502] transition-all appearance-none cursor-pointer"
                                    >
                                        {DURATION_UNITS.map(unit => (
                                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Duration Value</label>
                                <input 
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.durationValue}
                                    onChange={(e) => setFormData({...formData, durationValue: Number(e.target.value)})}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#FE5502]/10 focus:border-[#FE5502] transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Payment Behavior</label>
                                <div className={`h-[42px] px-4 rounded-xl text-[10px] font-black tracking-wider flex items-center justify-center border transition-colors ${
                                    formData.durationUnit === 'DAY' 
                                        ? 'bg-blue-50 text-blue-600 border-blue-100' 
                                        : 'bg-orange-50 text-[#FE5502] border-orange-100'
                                }`}>
                                    {formData.durationUnit === 'DAY' ? 'ONE-TIME CHECKOUT' : 'RECURRING SUBSCRIPTION'}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <div 
                                onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors group"
                            >
                                <button 
                                    type="button"
                                    className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none ${formData.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                                >
                                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${formData.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800">Set as Active</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Allow users to subscribe to this plan immediately</span>
                                </div>
                            </div>
                            <div className="mt-3 flex items-start gap-2 text-[10px] text-slate-500 leading-relaxed italic">
                                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                <p>For Week/Month plans, changing the price will automatically generate a new Razorpay Plan to protect existing subscriptions.</p>
                            </div>
                        </div>

                        <DialogFooter className="pt-4 flex items-center gap-3 sm:justify-end border-t border-slate-100 -mx-6 px-6 -mb-6 pb-6 mt-6 bg-slate-50/50">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors rounded-xl hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-[#FE5502] hover:bg-[#E64D02] text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 disabled:opacity-70 transition-all shadow-lg shadow-orange-200"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>{editingPlan ? 'Update Plan' : 'Create Plan'}</span>
                                    </>
                                )}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
