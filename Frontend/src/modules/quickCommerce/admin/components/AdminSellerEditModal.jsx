import React, { useState, useEffect, useMemo } from 'react';
import { HiXMark, HiOutlineMapPin } from 'react-icons/hi2';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import MapPicker from '@shared/components/MapPicker';
import axiosInstance from '@core/api/axios';

const formatTimeTo12Hour = (time24) => {
  if (!time24 || !time24.includes(":")) return time24;
  const [hourStr, minuteStr] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const formattedHour = String(hour).padStart(2, "0");
  return `${formattedHour}:${minuteStr} ${ampm}`;
};

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

const isPointInPolygon = (lat, lng, polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude || polygon[i].lng;
    const yi = polygon[i].latitude || polygon[i].lat;
    const xj = polygon[j].longitude || polygon[j].lng;
    const yj = polygon[j].latitude || polygon[j].lat;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const AdminSellerEditModal = ({ isOpen, onClose, onSuccess, seller }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && seller) {
      let openingTime = '';
      let closingTime = '';
      if (seller.shopInfo?.openingHours) {
        const parts = seller.shopInfo.openingHours.split(' - ');
        if (parts.length === 2) {
          openingTime = parts[0];
          closingTime = parts[1];
        }
      }

      setFormData({
        name: seller.ownerName || seller.name || "",
        shopName: seller.shopName || "",
        email: seller.email || "",
        phone: seller.phone || "",
        address: typeof seller.location === 'string' ? seller.location : (seller.location?.address || seller.location?.formattedAddress || ""),
        lat: seller.location?.latitude || seller.location?.coordinates?.[1] || "",
        lng: seller.location?.longitude || seller.location?.coordinates?.[0] || "",
        radius: '5',
        businessType: seller.shopInfo?.businessType || seller.category || "",
        bankName: seller.bankInfo?.bankName || "",
        accountHolderName: seller.bankInfo?.accountHolderName || "",
        accountNumber: seller.bankInfo?.accountNumber || "",
        ifscCode: seller.bankInfo?.ifscCode || "",
        accountType: seller.bankInfo?.accountType || "",
        upiId: seller.bankInfo?.upiId || "",
        panNumber: seller.documents?.panNumber || "",
        gstRegistered: seller.documents?.gstRegistered ? 'true' : 'false',
        gstNumber: seller.documents?.gstNumber || "",
        gstLegalName: seller.documents?.gstLegalName || "",
        fssaiNumber: seller.documents?.fssaiNumber || "",
        shopLicenseNumber: seller.documents?.shopLicenseNumber || "",
        zoneId: seller.shopInfo?.zoneId || "",
        zoneName: seller.shopInfo?.zoneName || "",
        zoneSource: 'quick',
        openingTime: openingTime,
        closingTime: closingTime
      });
    }
  }, [isOpen, seller]);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [manualAddressInput, setManualAddressInput] = useState('');
  const [isGeocodingManual, setIsGeocodingManual] = useState(false);
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
    shopLicenseNumber: '',
    zoneId: '',
    zoneName: '',
    zoneSource: '',
    openingTime: '',
    closingTime: ''
  });
  const [upiQrImage, setUpiQrImage] = useState(null);
  const [shopLicenseImage, setShopLicenseImage] = useState(null);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    if (isOpen) {
      axiosInstance.get("/quick-commerce/admin/zones")
        .then(res => {
          const payload = res.data?.result || res.data?.results || res.data?.data || [];
          setZones(Array.isArray(payload) ? payload : (payload.zones || payload.items || []));
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Derived: currently selected zone object — must be before any early return (Rules of Hooks)
  const selectedZone = useMemo(
    () => zones.find(z => z._id === formData.zoneId) || null,
    [zones, formData.zoneId]
  );

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


  const handleManualAddressGeocode = async () => {
    const query = manualAddressInput.trim();
    if (!query) {
      toast.error('Please enter an address, pincode, or city to search');
      return;
    }
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      toast.error('Google Maps API key is not configured');
      return;
    }
    if (!selectedZone) {
      toast.error('Please select a service zone first before searching for a location');
      return;
    }
    setIsGeocodingManual(true);
    try {
      const encodedQuery = encodeURIComponent(query + ', India');
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${apiKey}`
      );
      const data = await response.json();
      if (data.status === 'OK' && data.results?.length > 0) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        const formattedAddress = result.formatted_address || query;

        // Zone boundary check using Ray Casting algorithm
        if (Array.isArray(selectedZone?.coordinates) && selectedZone.coordinates.length >= 3) {
          const inside = isPointInPolygon(lat, lng, selectedZone.coordinates);
          if (!inside) {
            toast.error(`This location is outside the selected zone "${selectedZone.name || selectedZone.zoneName || 'Selected Zone'}". Please enter an address within the zone boundary.`);
            setIsGeocodingManual(false);
            return;
          }
        }

        setFormData(prev => ({
          ...prev,
          lat: Number(lat.toFixed(6)).toString(),
          lng: Number(lng.toFixed(6)).toString(),
          address: formattedAddress,
        }));
        toast.success('Location found on map! You can adjust the pin if needed.');
        // Open map so admin can see the pin within the zone boundary
        setIsMapOpen(true);
      } else {
        toast.error('Could not find location. Try a more specific address or pincode.');
      }
    } catch (err) {
      toast.error('Failed to fetch location. Check your internet connection.');
    } finally {
      setIsGeocodingManual(false);
    }
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
    if (!formData.name || !formData.shopName || !formData.phone || !formData.address || (!formData.zoneId && !formData.zoneName) || !formData.openingTime || !formData.closingTime) {
      toast.error('Please fill all required fields');
      return;
    }

    if (formData.openingTime >= formData.closingTime) {
      toast.error('Closing time must be later than opening time');
      return;
    }

    if (formData.lat && formData.lng && formData.zoneId) {
      const selectedZone = zones.find(z => z._id === formData.zoneId);
      if (selectedZone && selectedZone.coordinates) {
        const inside = isPointInPolygon(Number(formData.lat), Number(formData.lng), selectedZone.coordinates);
        if (!inside) {
          toast.error('Selected location is outside the boundaries of the chosen Service Zone');
          return;
        }
      }
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
      const payload = {
        name: formData.name,
        shopName: formData.shopName,
        email: formData.email,
        phone: formData.phone,
        location: {
          address: formData.address,
          latitude: Number(formData.lat),
          longitude: Number(formData.lng)
        },
        bankInfo: {
          bankName: formData.bankName,
          accountHolderName: formData.accountHolderName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          accountType: formData.accountType,
          upiId: formData.upiId
        },
        documents: {
          panNumber: formData.panNumber,
          gstRegistered: formData.gstRegistered === 'true',
          gstNumber: formData.gstNumber,
          fssaiNumber: formData.fssaiNumber,
          shopLicenseNumber: formData.shopLicenseNumber
        },
        shopInfo: {
          businessType: formData.businessType,
          supportEmail: formData.supportEmail,
          openingHours: `${formData.openingTime} - ${formData.closingTime}`,
          zoneId: formData.zoneId,
          zoneName: formData.zoneName
        }
      };

      const response = await adminApi.updateActiveSeller(seller._id || seller.id, payload);
      if (response?.success) {
        toast.success('Seller updated successfully');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(response?.message || 'Failed to update seller');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating seller');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={`fixed inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 ${isMapOpen ? 'z-40 opacity-0 pointer-events-none' : 'z-[9999]'}`}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900">Edit Seller</h2>
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

                  {/* Manual Address Search */}
                  <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Or search address manually</p>
                    <p className="text-xs text-slate-400 mb-3">Type address, pincode, or city+state — we'll find it on the map and validate it's within the selected zone.</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900 transition"
                        placeholder="e.g. 123 Main St, Mumbai, Maharashtra 400001"
                        value={manualAddressInput}
                        onChange={(e) => setManualAddressInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualAddressGeocode(); } }}
                      />
                      <button
                        type="button"
                        onClick={handleManualAddressGeocode}
                        disabled={isGeocodingManual}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {isGeocodingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <HiOutlineMapPin className="h-4 w-4" />}
                        {isGeocodingManual ? 'Searching...' : 'Find'}
                      </button>
                    </div>
                    {formData.lat && formData.lng && (
                      <p className="mt-2 text-xs text-emerald-600 font-semibold">
                        ✓ Location pinned ({Number(formData.lat).toFixed(5)}, {Number(formData.lng).toFixed(5)}) — use "Pick on Map" to fine-tune.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Latitude</label>
                    <input type="text" name="lat" maxLength={20} value={formData.lat} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. 28.7041" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Longitude</label>
                    <input type="text" name="lng" maxLength={20} value={formData.lng} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900" placeholder="e.g. 77.1025" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Service Zone *</label>
                    <select 
                      name="zoneId" 
                      required 
                      value={formData.zoneId || ''} 
                      onChange={(e) => {
                        const selectedZone = zones.find(z => z._id === e.target.value);
                        setFormData(prev => ({ 
                          ...prev, 
                          zoneId: e.target.value, 
                          zoneName: selectedZone?.name || '', 
                          zoneSource: 'quick' 
                        }));
                      }} 
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="" disabled>Select a zone</option>
                      {Array.isArray(zones) && zones.map(zone => (
                        <option key={zone._id} value={zone._id}>{zone.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Opening Time *</label>
                    <select name="openingTime" required value={formData.openingTime} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900">
                      <option value="" disabled>Select time</option>
                      {timeOptions.map(time => (
                        <option key={time} value={time}>{formatTimeTo12Hour(time)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Closing Time *</label>
                    <select name="closingTime" required value={formData.closingTime} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900">
                      <option value="" disabled>Select time</option>
                      {timeOptions.map(time => (
                        <option key={time} value={time}>{formatTimeTo12Hour(time)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Business Type / Category</label>
                    <select name="businessType" required value={formData.businessType} onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-slate-900">
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
                    {seller?.bankInfo?.upiQrImage && (
                      <div className="mb-2">
                        <a href={seller.bankInfo.upiQrImage} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-600 hover:underline">
                          View Current Image
                        </a>
                      </div>
                    )}
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
                    {seller?.documents?.shopLicenseImage && (
                      <div className="mb-2 flex items-center gap-2">
                        <img src={seller.documents.shopLicenseImage} alt="Shop License" className="h-10 w-10 object-cover rounded bg-slate-100" />
                        <a href={seller.documents.shopLicenseImage} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-600 hover:underline">
                          View Current Image
                        </a>
                      </div>
                    )}
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
              {isSubmitting ? 'Updating...' : 'Update Seller'}
            </button>
          </div>
        </div>
      </div>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          initialLocation={formData.lat && formData.lng ? { lat: Number(formData.lat), lng: Number(formData.lng) } : null}
          defaultAddress={formData.address}
          zoneCoordinates={selectedZone?.coordinates || []}
          zoneLabel={selectedZone?.name || selectedZone?.zoneName || ''}
        />
      )}
    </>
  );
};

export default AdminSellerEditModal;