import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { Loader2, Receipt, TrendingUp, Undo2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import Pagination from '@shared/components/ui/Pagination';

const SellerOrderTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({
        adminEarnings: 0,
        sellerEarnings: 0,
        deliveryBoyEarnings: 0,
        refundedAmount: 0
    });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchTransactions = async (requestedPage = page, searchQ = search) => {
        try {
            setLoading(true);
            const res = await adminApi.getSellerOrderTransactions({ page: requestedPage, limit: pageSize, search: searchQ });
            if (res.data?.success) {
                setTransactions(res.data.data.transactions || []);
                setSummary(res.data.data.summary || {});
                setTotal(res.data.data.total || 0);
            }
        } catch (error) {
            console.error('Error fetching seller transactions:', error);
            toast.error('Failed to load seller transactions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions(page, search);
    }, [page, pageSize]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchTransactions(1, search);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'delivered':
            case 'completed':
                return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Delivered</span>;
            case 'cancelled_by_admin':
            case 'cancelled_by_restaurant':
            case 'cancelled_by_user':
                return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Cancelled</span>;
            case 'refunded':
                return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Refunded</span>;
            default:
                return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium capitalize">{status?.replace(/_/g, ' ') || 'Pending'}</span>;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-full">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Seller Transactions</h1>
                <p className="text-sm text-gray-500 mt-1">Overview of all order transactions and financial summary.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Admin Earnings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Admin Earnings</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(summary.adminEarnings)}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Seller Earnings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Seller Earnings</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(summary.sellerEarnings)}</h3>
                        </div>
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                            <Receipt className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Delivery Boy Earnings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Delivery Boy Earnings</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(summary.deliveryBoyEarnings)}</h3>
                        </div>
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Refunded Transactions */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Refunded Transactions</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(summary.refundedAmount)}</h3>
                        </div>
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                            <Undo2 className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-semibold text-gray-800">Order Transactions</h2>
                    <form onSubmit={handleSearchSubmit} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Search Order ID or Seller..."
                            value={search}
                            onChange={handleSearch}
                            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-64"
                        />
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors">
                            Search
                        </button>
                    </form>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 font-medium">SI</th>
                                <th className="px-4 py-3 font-medium">Order ID</th>
                                <th className="px-4 py-3 font-medium">Seller</th>
                                <th className="px-4 py-3 font-medium">Customer Name</th>
                                <th className="px-4 py-3 font-medium">Total Item Amount</th>
                                <th className="px-4 py-3 font-medium">Coupon Discount</th>
                                <th className="px-4 py-3 font-medium">VAT/Tax</th>
                                <th className="px-4 py-3 font-medium">Delivery Charge</th>
                                <th className="px-4 py-3 font-medium">Platform Fee</th>
                                <th className="px-4 py-3 font-medium">Order Amount</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="11" className="px-4 py-8 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                                        <p className="text-gray-500 mt-2">Loading transactions...</p>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                                        No transactions found
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((txn) => (
                                    <tr key={txn._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-gray-500">{txn.si}</td>
                                        <td className="px-4 py-3 font-medium text-blue-600">{txn.orderId}</td>
                                        <td className="px-4 py-3">{txn.seller}</td>
                                        <td className="px-4 py-3">{txn.customerName}</td>
                                        <td className="px-4 py-3">{formatCurrency(txn.totalItemAmount)}</td>
                                        <td className="px-4 py-3 text-red-600">{formatCurrency(txn.couponDiscount)}</td>
                                        <td className="px-4 py-3">{formatCurrency(txn.vatTax)}</td>
                                        <td className="px-4 py-3">{formatCurrency(txn.deliveryCharge)}</td>
                                        <td className="px-4 py-3 text-red-600">{formatCurrency(txn.platformFee)}</td>
                                        <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(txn.orderAmount)}</td>
                                        <td className="px-4 py-3">
                                            {getStatusBadge(txn.paymentStatus === 'refunded' ? 'refunded' : txn.status)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > 0 && (
                    <div className="p-4 border-t border-gray-200">
                        <Pagination 
                            currentPage={page} 
                            totalPages={Math.ceil(total / pageSize)} 
                            onPageChange={setPage} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SellerOrderTransactions;
