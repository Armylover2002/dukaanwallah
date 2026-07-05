import React, { useState } from 'react';
import { HiXMark, HiOutlineMapPin } from 'react-icons/hi2';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import MapPicker from '@shared/components/MapPicker';

const AdminSellerCreateModal = ({ isOpen, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    shopName: '',
    email: '',
    phone: '',
    address: '',
    lat: '',
    lng: '',
    radius: '5',
    businessType: '',
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    accountType: '',
    upiId: '',
    panNumber: '',
    gstRegistered: 'false',
    gstNumber: '',
    gstLegalName: '',
    fssaiNumber: '',
    shopLicenseNumber: ''
  });
  const [upiQrImage, setUpiQrImage] = useState(null);
  const [shopLicenseImage, setShopLicenseImage] = useState(null);

  if (!isOpen) return null;

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: Number.isFinite(location?.lat) ? location.lat.toFixed(6) : prev.lat,
      lng: Number.isFinite(location?.lng) ? location.lng.toFixed(6) : prev.lng,
      radius: location?.radius !== undefined ? String(location.radius) : prev.radius,
      address: location?.address || prev.address,
    }));
  };

  const handleChange = (e) => {
    let { name, value } = e.target;

    if (name === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10); // Only digits, max 10
    }
    if (name === 'name' || name === 'accountHolderName') {
      value = value.replace(/[^a-zA-Z\s]/g, ''); // Only letters and spaces
    }
    if (name === 'accountNumber') {
      value = value.replace(/\D/g, '').slice(0, 18); // Only digits, max 18
    }
    if (name === 'fssaiNumber') {
      value = value.replace(/\D/g, '').slice(0, 14); // Only digits, max 14
    }
    if (name === 'ifscCode') {
      value = value.toUpperCase().slice(0, 11); // 4 letters + 0 + 6 alphanumeric = 11
    }
    if (name === 'panNumber') {
      value = value.toUpperCase().slice(0, 10); // 5 letters + 4 digits + 1 letter = 10
    }
    if (name === 'gstNumber') {
      value = value.toUpperCase().slice(0, 15); // 15 characters
    }
    if (name === 'upiId') {
      value = value.slice(0, 50);
    }
    if (name === 'shopLicenseNumber') {
      value = value.slice(0, 20); // 5-20 characters
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.shopName || !formData.phone || !formData.address) {
      toast.error('Please fill all required fields');
      return;
    }

    if (formData.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
      toast.error("Enter a valid email address");
      return;
    }

    if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }

    if (formData.accountNumber && !/^\d{9,18}$/.test(formData.accountNumber)) {
      toast.error("Account number must be 9–18 digits (numbers only)");
      return;
    }

    if (formData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode)) {
      toast.error("Invalid IFSC code. Format: 4 letters + 0 + 6 alphanumeric");
      return;
    }

    if (formData.upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(formData.upiId)) {
      toast.error("Invalid UPI ID. Format: username@bankhandle");
      return;
    }

    if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
      toast.error("Invalid PAN format. Must be 5 letters, 4 digits, 1 letter");
      return;
    }

    if (formData.gstRegistered === 'true' && formData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstNumber)) {
      toast.error("Invalid GST format. Must be 15 characters (e.g. 22ABCDE1234F1Z5)");
      return;
    }

    if (formData.fssaiNumber && !/^\d{14}$/.test(formData.fssaiNumber)) {
      toast.error("FSSAI number must be exactly 14 digits");
      return;
    }

    if (formData.shopLicenseNumber && !/^[A-Za-z0-9\/\-]{5,20}$/.test(formData.shopLicenseNumber)) {
      toast.error("Shop license number must be 5–20 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        data.append(key, formData[key]);
      });
      if (upiQrImage) data.append('upiQrImage', upiQrImage);
      if (shopLicenseImage) data.append('shopLicenseImage', shopLicenseImage);

      const response = await adminApi.createActiveSeller(data);
      if (response?.data?.success) {
        toast.success('Seller created successfully');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(response?.data?.message || 'Failed to create seller');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating seller');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={`fixed inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 ${isMapOpen ? 'z-40 opacity-0 pointer-events-none' : 'z-[9999]'}`}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900">Add New Active Seller</h2>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            >
              <HiXMark className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <form id="add-seller-form" onSubmit={handleSubmit} className="space-y-8">
              {/* Identity & Contact */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100">
                  Identity & Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Owner Name *</label>
                    <input type="text" name="name" required maxLength={40} value={formData.name} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. Rahul Kumar" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Shop Name *</label>
                    <input type="text" name="shopName" required maxLength={50} value={formData.shopName} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. Rahul Provisions" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Phone * (For Login)</label>
                    <input type="tel" name="phone" required maxLength={10} value={formData.phone} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="10-digit number" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Email</label>
                    <input type="email" name="email" maxLength={50} value={formData.email} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="email@example.com" />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100">
                  Location Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500">Complete Address *</label>
                      <button
                        type="button"
                        onClick={() => setIsMapOpen(true)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700"
                      >
                        <HiOutlineMapPin className="h-3.5 w-3.5" />
                        Pick on Map
                      </button>
                    </div>
                    <input type="text" name="address" required maxLength={250} value={formData.address} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="Full store address" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Latitude</label>
                    <input type="text" name="lat" maxLength={20} value={formData.lat} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. 28.7041" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Longitude</label>
                    <input type="text" name="lng" maxLength={20} value={formData.lng} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. 77.1025" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Business Type / Category</label>
                    <select name="businessType" value={formData.businessType} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900">
                      <option value="" disabled>Select a category</option>
                      <option value="Grocery">Grocery</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Fashion">Fashion</option>
                      <option value="General Store">General Store</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Banking */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100">
                  Banking Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Bank Name</label>
                    <input type="text" name="bankName" maxLength={100} value={formData.bankName} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. HDFC Bank" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Account Holder Name</label>
                    <input type="text" name="accountHolderName" maxLength={100} value={formData.accountHolderName} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. Rahul Kumar" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Account Number</label>
                    <input type="text" name="accountNumber" maxLength={18} value={formData.accountNumber} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. 50100123456789" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">IFSC Code</label>
                    <input type="text" name="ifscCode" maxLength={11} value={formData.ifscCode} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. HDFC0001234" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">UPI ID</label>
                    <input type="text" name="upiId" maxLength={50} value={formData.upiId} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. rahul@okaxis" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">UPI QR Image</label>
                    <input type="file" accept="image/*" onChange={(e) => setUpiQrImage(e.target.files[0])} className="w-full text-xs font-semibold" />
                  </div>
                </div>
              </div>

              {/* Compliance */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest pb-2 border-b border-slate-100">
                  Compliance & Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">PAN Number</label>
                    <input type="text" name="panNumber" maxLength={10} value={formData.panNumber} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. ABCDE1234F" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">GST Registered</label>
                    <select name="gstRegistered" value={formData.gstRegistered} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900">
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>
                  {formData.gstRegistered === 'true' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">GST Number</label>
                        <input type="text" name="gstNumber" maxLength={15} value={formData.gstNumber} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. 22ABCDE1234F1Z5" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">GST Legal Name</label>
                        <input type="text" name="gstLegalName" maxLength={150} value={formData.gstLegalName} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="Company/Owner Name on GST" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">FSSAI Number</label>
                    <input type="text" name="fssaiNumber" maxLength={14} value={formData.fssaiNumber} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="14-digit FSSAI Number" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Shop License Number</label>
                    <input type="text" name="shopLicenseNumber" maxLength={20} value={formData.shopLicenseNumber} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="Shop License Number" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Shop License Image</label>
                    <input type="file" accept="image/*" onChange={(e) => setShopLicenseImage(e.target.files[0])} className="w-full text-xs font-semibold" />
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-seller-form"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isSubmitting ? 'Creating...' : 'Create Active Seller'}
            </button>
          </div>
        </div>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={{ lat: Number(formData.lat) || 0, lng: Number(formData.lng) || 0 }}
          defaultAddress={formData.address}
        />
      )}
    </>
  );
};

export default AdminSellerCreateModal;