import React, { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineBuildingOffice2,
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlineMagnifyingGlass,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineEllipsisVertical,
  HiOutlineCheck,
  HiOutlineXMark
} from 'react-icons/hi2';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import AdminSellerCreateModal from '../components/AdminSellerCreateModal';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatLocationTooltip = (location) => {
  if (!location) return 'Location not added yet';
  if (typeof location === 'string') {
    // If it's just coordinates (e.g. "28.53, 77.39")
    if (/^[-+]?[0-9]*\.?[0-9]+,\s*[-+]?[0-9]*\.?[0-9]+$/.test(location)) {
      return 'Exact coordinates available';
    }
    // Extract City and Area from comma-separated address
    const parts = location.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // Assuming typical format: "Area/Locality, City, State, Country"
      // Returns "City, Area"
      return `${parts[1]}, ${parts[0]}`;
    }
    return location;
  }
  return 'Location not added yet';
};

const ActiveSellers = () => {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadActiveSellers = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getSellers();
      const items =
        response?.data?.result?.items ||
        response?.data?.data?.items ||
        response?.data?.result ||
        [];
      setSellers(Array.isArray(items) ? items : []);
    } catch (error) {
      toast.error('Failed to load approved sellers');
      setSellers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (id, isActive) => {
    try {
      const res = await adminApi.toggleSellerStatus(id, isActive);
      if (res.success) {
        toast.success(`Seller ${isActive ? 'activated' : 'deactivated'} successfully`);
        loadActiveSellers(); // refresh list
      } else {
        toast.error(res.message || 'Failed to update status');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error updating status');
    }
  };

  useEffect(() => {
    loadActiveSellers();
  }, []);

  const filteredSellers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sellers;
    return sellers.filter((seller) =>
      [
        seller.shopName,
        seller.ownerName,
        seller.email,
        seller.phone,
        seller.category,
        seller.location,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [searchTerm, sellers]);

  const stats = useMemo(
    () => ({
      total: sellers.length,
      withLocation: sellers.filter((seller) => seller.location).length,
      withDocs: sellers.filter(
        (seller) =>
          seller?.documents?.shopLicenseNumber ||
          seller?.documents?.gstNumber ||
          seller?.documents?.panNumber ||
          seller?.documents?.fssaiNumber,
      ).length,
    }),
    [sellers],
  );

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="ds-h1 flex items-center gap-2">
            Active Sellers
            <Badge variant="success" className="admin-tiny px-1.5 py-0 font-bold">
              Approved
            </Badge>
          </h1>
          <p className="ds-description mt-0.5">
            Approved quick-commerce sellers who can access the seller dashboard.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-900/20"
          >
            Add Seller
          </button>
          <button
            type="button"
            onClick={loadActiveSellers}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white"
          >
            <HiOutlineArrowPath className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh List
          </button>
        </div>
      </div>

      <AdminSellerCreateModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadActiveSellers}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            label: 'Approved sellers',
            val: stats.total,
            icon: HiOutlineCheckCircle,
            tone: 'text-emerald-600 bg-emerald-50',
          },
          {
            label: 'Location ready',
            val: stats.withLocation,
            icon: HiOutlineMapPin,
            tone: 'text-sky-600 bg-sky-50',
          },
          {
            label: 'Docs added',
            val: stats.withDocs,
            icon: HiOutlineBuildingOffice2,
            tone: 'text-amber-600 bg-amber-50',
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm ring-1 ring-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="ds-label">{stat.label}</p>
                <h4 className="ds-stat-medium mt-1">{stat.val}</h4>
              </div>
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner ${stat.tone}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
        <div className="p-6 border-b border-slate-50 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white">
          <div className="relative flex-1 w-full max-w-md">
            <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by shop, owner, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 ring-1 ring-emerald-100">
            <HiOutlineCheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
              Live approved seller accounts
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="ds-table-header-cell px-6 py-3 font-semibold text-slate-500">Seller</th>
                <th className="ds-table-header-cell px-6 py-3 font-semibold text-slate-500">Contact</th>
                <th className="ds-table-header-cell px-6 py-3 font-semibold text-slate-500">Category</th>
                <th className="ds-table-header-cell px-6 py-3 font-semibold text-slate-500">Approved on</th>
                <th className="ds-table-header-cell px-6 py-3 font-semibold text-slate-500">Status</th>
                <th className="ds-table-header-cell px-6 py-3 font-semibold text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!isLoading && filteredSellers.length > 0 ? (
                filteredSellers.map((seller) => (
                  <tr key={seller._id || seller.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <HiOutlineBuildingOffice2 className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{seller.shopName || 'Store'}</span>
                          <span className="text-[11px] font-bold text-slate-500 mt-0.5">{seller.ownerName || 'Seller'}</span>
                          <span className="mt-1 text-[11px] font-medium text-slate-500 max-w-[200px] truncate" title={formatLocationTooltip(seller.location)}>
                            {seller.location || 'Location not added yet'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                          <HiOutlineEnvelope className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]" title={seller.email}>{seller.email || 'No email'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                          <HiOutlinePhone className="h-4 w-4 text-slate-400 shrink-0" />
                          <span>{seller.phone || 'No phone'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border-none">
                        {seller.category || 'General'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">
                          {formatDate(seller.approvedAt || seller.applicationDate || seller.createdAt)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                          {seller.serviceRadius ? `${seller.serviceRadius} km radius` : 'Radius not set'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <Badge variant={seller.isActive !== false ? 'success' : 'error'} className="text-[10px] font-bold uppercase tracking-wider">
                        {seller.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right align-middle">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="p-2 rounded-full hover:bg-slate-100 transition-colors focus:outline-none">
                            <HiOutlineEllipsisVertical className="h-5 w-5 text-slate-500" />
                          </button>
                        </DropdownMenu.Trigger>
                        
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content 
                            className="min-w-[160px] bg-white rounded-lg shadow-lg border border-slate-100 p-1 z-50 overflow-hidden text-sm"
                            align="end"
                          >
                            <DropdownMenu.Item 
                              className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-md cursor-pointer outline-none focus:bg-slate-50"
                              onSelect={() => navigate(`/admin/quick-commerce/sellers/active/${seller._id || seller.id}`)}
                            >
                              <HiOutlineEye className="h-4 w-4" />
                              View
                            </DropdownMenu.Item>
                            
                            {seller.isActive !== false ? (
                              <DropdownMenu.Item 
                                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md cursor-pointer outline-none focus:bg-red-50"
                                onSelect={() => handleToggleStatus(seller._id || seller.id, false)}
                              >
                                <HiOutlineXMark className="h-4 w-4" />
                                Deactivate
                              </DropdownMenu.Item>
                            ) : (
                              <DropdownMenu.Item 
                                className="flex items-center gap-2 px-3 py-2 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer outline-none focus:bg-emerald-50"
                                onSelect={() => handleToggleStatus(seller._id || seller.id, true)}
                              >
                                <HiOutlineCheck className="h-4 w-4" />
                                Activate
                              </DropdownMenu.Item>
                            )}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <HiOutlineCalendarDays className={`h-10 w-10 ${isLoading ? 'animate-pulse' : ''}`} />
                      <p className="text-sm font-semibold text-slate-500">
                        {isLoading ? 'Loading approved sellers...' : 'No approved sellers found yet'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ActiveSellers;
