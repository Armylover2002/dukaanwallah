




import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Home, Briefcase, MapPin, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';
import { useLocation } from '../context/LocationContext';
import { loadGoogleMaps } from '@/core/services/googleMapsLoader';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_LAT = 22.711140989838025;
const DEFAULT_LNG = 75.9001552518043;
const DEFAULT_POSITION = [DEFAULT_LAT, DEFAULT_LNG];

const EMPTY_FORM = {
    type: 'home',
    name: '',
    phone: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const capitalize = (str = '') => str.charAt(0).toUpperCase() + str.slice(1);

const buildDisplayAddress = (addr) =>
    addr.fullAddress ||
    [addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') ||
    '';

const mapProfileToAddresses = (profile) => {
    const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
    return raw.map((addr, idx) => ({
        id: addr._id ?? idx,
        type: capitalize(addr.label || 'home'),
        name: profile?.name ?? '',
        address: buildDisplayAddress(addr),
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        landmark: addr.landmark,
        phone: profile?.phone ?? '',
        location: addr.location,
        isDefault: idx === 0,
    }));
};

const capitalizeLabel = (type) => {
    const t = String(type || '').trim().toLowerCase();
    if (t === 'home') return 'Home';
    if (t === 'work' || t === 'office') return 'Office';
    return 'Other';
};

const buildRawAddress = (form) => {
    return {
        label: capitalizeLabel(form.type),
        street: form.address?.trim() || '',
        additionalDetails: form.landmark?.trim() || '',
        city: form.city?.trim() || '',
        state: form.state?.trim() || '',
        zipCode: form.pincode?.trim() || '',
        phone: form.phone?.trim() || '',
    };
};

const getCachedPosition = () => {
    try {
        const cached = localStorage.getItem('location_v2');
        if (!cached) return null;
        const { latitude, longitude } = JSON.parse(cached) ?? {};
        if (latitude && longitude) return { lat: latitude, lng: longitude };
    } catch { /* ignore */ }
    return null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const CenterPin = memo(() => (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative mb-6 flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center p-1.5 mb-[-4px] shadow-md animate-bounce">
                <div className="w-4 h-4 rounded-full bg-green-600 border-2 border-white" />
            </div>
            <div className="w-1 h-4 bg-green-600 border-x border-white shadow-xl" />
        </div>
    </div>
));
CenterPin.displayName = 'CenterPin';

const MapPicker = memo(({ mapContainerRef, mapLoading }) => (
    <div className="grid gap-2">
        <Label>Select Location on Map</Label>
        <div className="h-44 w-full bg-slate-100 rounded-xl relative overflow-hidden shadow-inner border border-slate-200">
            <div ref={mapContainerRef} className="w-full h-full" />
            {mapLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#0c831f] border-t-transparent" />
                </div>
            )}
            <CenterPin />
        </div>
    </div>
));
MapPicker.displayName = 'MapPicker';

const TypeSelector = memo(({ value, onChange }) => {
    const types = ['home', 'work', 'other'];
    return (
        <div className="grid gap-2">
            <Label>Address Type</Label>
            <div className="flex gap-2">
                {types.map((t) => (
                    <Button
                        key={t}
                        type="button"
                        variant="outline"
                        className={`flex-1 ${value === t ? 'border-[#0c831f] text-[#0c831f] bg-green-50' : ''}`}
                        onClick={() => onChange(t)}
                    >
                        {capitalize(t)}
                    </Button>
                ))}
            </div>
        </div>
    );
});
TypeSelector.displayName = 'TypeSelector';

const AddressFormFields = memo(({ form, onChange, mapContainerRef, mapLoading }) => {
    const set = (key) => (e) => onChange((f) => ({ ...f, [key]: e.target.value }));
    return (
        <>
            <TypeSelector value={form.type} onChange={(t) => onChange((f) => ({ ...f, type: t }))} />
            <MapPicker mapContainerRef={mapContainerRef} mapLoading={mapLoading} />
            <div className="grid gap-2">
                <Label htmlFor="form-name">Full Name</Label>
                <Input id="form-name" placeholder="John Doe" value={form.name} onChange={set('name')} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="form-phone">Phone Number</Label>
                <Input id="form-phone" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="form-address">Address</Label>
                <Textarea id="form-address" placeholder="Flat No, Building, Street" value={form.address} onChange={set('address')} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="form-landmark">Nearest Landmark (optional)</Label>
                <Input id="form-landmark" placeholder="Near City Mall, Opp. Temple" value={form.landmark} onChange={set('landmark')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="form-city">City</Label>
                    <Input id="form-city" placeholder="New Delhi" value={form.city} onChange={set('city')} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="form-state">State</Label>
                    <Input id="form-state" placeholder="Delhi" value={form.state} onChange={set('state')} />
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="form-pincode">Pincode</Label>
                <Input id="form-pincode" placeholder="110075" value={form.pincode} onChange={set('pincode')} />
            </div>
        </>
    );
});
AddressFormFields.displayName = 'AddressFormFields';

const AddressCard = memo(({ addr, onEdit, onDelete }) => {
    const Icon = addr.type === 'Home' ? Home : addr.type === 'Work' ? Briefcase : MapPin;
    return (
        <div className="bg-white dark:bg-card rounded-xl p-4 border border-slate-200 dark:border-white/5 relative overflow-hidden transition-colors">
            {addr.isDefault && (
                <div className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-1 rounded-bl-lg uppercase tracking-wide">
                    Default
                </div>
            )}
            <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                    <Icon size={18} />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-800 mb-0.5">{addr.type}</h3>
                    <p className="text-slate-800 font-medium text-sm mb-1">{addr.name}</p>
                    <p className="text-slate-500 text-xs leading-relaxed mb-1">{addr.address}</p>
                    <p className="text-slate-500 text-xs mb-2">{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
                    <p className="text-slate-700 font-medium text-xs">Phone: {addr.phone}</p>
                </div>
            </div>
            <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(addr); }}
                    className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                    <Edit2 size={14} /> Edit
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(addr); }}
                    className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                    <Trash2 size={14} /> Delete
                </button>
            </div>
        </div>
    );
});
AddressCard.displayName = 'AddressCard';

// ─── Custom hook: Google Maps initializer ─────────────────────────────────────
const useMapPicker = ({ isOpen, initialPosition, setForm }) => {
    const [mapContainer, setMapContainer] = useState(null);
    const googleMapRef = useRef(null);
    const [mapPosition, setMapPosition] = useState(DEFAULT_POSITION);
    const [mapLoading, setMapLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !mapContainer) return;

        let active = true;
        setMapLoading(true);

        const initMap = async () => {
            try {
                const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                if (!apiKey) { setMapLoading(false); return; }

                await loadGoogleMaps(apiKey);
                if (!active || !mapContainer) return;

                const google = window.google;
                const pos = initialPosition ?? getCachedPosition() ?? { lat: DEFAULT_LAT, lng: DEFAULT_LNG };

                const map = new google.maps.Map(mapContainer, {
                    center: pos,
                    zoom: 16,
                    disableDefaultUI: true,
                    zoomControl: true,
                    gestureHandling: 'greedy',
                });
                googleMapRef.current = map;
                setMapPosition([pos.lat, pos.lng]);

                let idleTimer = null;
                map.addListener('idle', () => {
                    clearTimeout(idleTimer);
                    idleTimer = setTimeout(() => {
                        if (!active) return;
                        const center = map.getCenter();
                        const lat = center.lat();
                        const lng = center.lng();
                        setMapPosition([lat, lng]);

                        new google.maps.Geocoder().geocode(
                            { location: { lat, lng } },
                            (results, status) => {
                                if (!active || status !== 'OK' || !results?.[0]) return;
                                const { formatted_address, address_components } = results[0];
                                const get = (types) =>
                                    address_components.find((c) => types.every((t) => c.types.includes(t)))?.long_name || '';

                                setForm((f) => ({
                                    ...f,
                                    address: formatted_address || f.address,
                                    city: get(['locality']) || f.city,
                                    state: get(['administrative_area_level_1']) || f.state,
                                    pincode: get(['postal_code']) || f.pincode,
                                }));
                            }
                        );
                    }, 500);
                });

                setMapLoading(false);
            } catch (err) {
                console.error('Map init failed:', err);
                setMapLoading(false);
            }
        };

        const timer = setTimeout(initMap, 200);
        return () => {
            active = false;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, mapContainer]);

    return { mapContainerRef: setMapContainer, mapPosition, mapLoading };
};

// ─── Geocoding helper ─────────────────────────────────────────────────────────
const resolveLocation = async (form, mapPosition) => {
    const isDefaultPos = mapPosition[0] === DEFAULT_LAT && mapPosition[1] === DEFAULT_LNG;
    if (!isDefaultPos) {
        return { lat: mapPosition[0], lng: mapPosition[1] };
    }
    try {
        const query = [form.address, form.landmark, form.city, form.state, form.pincode]
            .filter(Boolean).join(', ');
        const geo = await customerApi.geocodeAddress(query);
        const loc = geo.data?.result?.location;
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') return loc;
    } catch { /* fall through */ }
    return mapPosition[0] !== DEFAULT_LAT ? { lat: mapPosition[0], lng: mapPosition[1] } : null;
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AddressesPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { refreshAddresses } = useLocation();

    const [addresses, setAddresses] = useState([]);
    const [rawAddresses, setRawAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState('');
    const [profilePhone, setProfilePhone] = useState('');

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);

    const [addForm, setAddForm] = useState(EMPTY_FORM);
    const [editForm, setEditForm] = useState(EMPTY_FORM);

    const [saving, setSaving] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const addMap = useMapPicker({ isOpen: isAddOpen, initialPosition: null, setForm: setAddForm });
    const editMap = useMapPicker({ isOpen: isEditOpen, initialPosition: selectedAddress?.location ?? null, setForm: setEditForm });

    const fetchAddresses = useCallback(async () => {
        try {
            const { data } = await customerApi.getProfile();
            const profile = data?.result ?? data?.data ?? data;
            const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
            setRawAddresses(raw);
            setProfileName(profile?.name ?? '');
            setProfilePhone(profile?.phone ?? '');
            setAddresses(mapProfileToAddresses(profile));
        } catch {
            setAddresses([]);
            setRawAddresses([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

    // Auto-open Add modal when navigated from LocationDrawer with ?add=1
    useEffect(() => {
        if (searchParams.get('add') === '1' && !loading) {
            setSearchParams({}, { replace: true });
            setAddForm((f) => ({ ...f, name: profileName, phone: profilePhone }));
            setIsAddOpen(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, loading]);

    const reload = useCallback(async () => {
        setLoading(true);
        await fetchAddresses();
        await refreshAddresses?.();
    }, [fetchAddresses, refreshAddresses]);

    const openAddModal = useCallback((e) => {
        e?.preventDefault();
        e?.stopPropagation();
        setAddForm({ ...EMPTY_FORM, name: profileName, phone: profilePhone });
        setIsAddOpen(true);
    }, [profileName, profilePhone]);

    // ── Add ──
    const handleSaveNewAddress = useCallback(async () => {
        const address = addForm.address?.trim();
        const city = addForm.city?.trim();
        const state = addForm.state?.trim();
        if (!address) { toast.error('Please enter the address'); return; }
        if (!city) { toast.error('Please enter the city'); return; }
        if (!state) { toast.error('Please enter the state'); return; }

        setSaving(true);
        try {
            const newAddr = buildRawAddress(addForm);
            const loc = await resolveLocation(addForm, addMap.mapPosition);
            if (loc) {
                newAddr.location = {
                    type: 'Point',
                    coordinates: [loc.lng, loc.lat]
                };
            }

            await customerApi.updateProfile({
                ...(addForm.name?.trim() && { name: addForm.name.trim() }),
                ...(addForm.phone?.trim() && { phone: addForm.phone.trim() }),
                addresses: [...rawAddresses, newAddr],
            });
            toast.success('Address saved successfully');
            setIsAddOpen(false);
            await reload();
            if (searchParams.get('from') === 'cart') {
                navigate(-1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save address');
        } finally {
            setSaving(false);
        }
    }, [addForm, addMap.mapPosition, rawAddresses, reload, searchParams, navigate]);

    // ── Edit ──
    const handleEdit = useCallback((addr) => {
        setSelectedAddress(addr);
        setEditForm({
            type: (addr.type || 'Home').toLowerCase(),
            name: addr.name ?? '',
            phone: addr.phone ?? '',
            address: addr.address ?? '',
            landmark: addr.landmark ?? '',
            city: addr.city ?? '',
            state: addr.state ?? '',
            pincode: addr.pincode ?? '',
        });
        setIsEditOpen(true);
    }, []);

    const handleUpdateAddress = useCallback(async () => {
        if (!selectedAddress) return;
        const address = editForm.address?.trim();
        const city = editForm.city?.trim();
        const state = editForm.state?.trim();
        if (!address) { toast.error('Please enter the address'); return; }
        if (!city) { toast.error('Please enter the city'); return; }
        if (!state) { toast.error('Please enter the state'); return; }

        const idx = rawAddresses.findIndex((_, i) =>
            addresses[i]?.id === selectedAddress.id ||
            (addresses[i]?.address === selectedAddress.address && addresses[i]?.type === selectedAddress.type)
        );
        if (idx < 0) { setIsEditOpen(false); return; }

        setUpdating(true);
        try {
            const updatedRaw = {
                ...(rawAddresses[idx] ?? {}),
                ...buildRawAddress(editForm),
            };
            const loc = await resolveLocation(editForm, editMap.mapPosition);
            if (loc) {
                updatedRaw.location = {
                    type: 'Point',
                    coordinates: [loc.lng, loc.lat]
                };
            }

            await customerApi.updateProfile({
                ...(editForm.name?.trim() && { name: editForm.name.trim() }),
                ...(editForm.phone?.trim() && { phone: editForm.phone.trim() }),
                addresses: rawAddresses.map((r, i) => (i === idx ? updatedRaw : r)),
            });
            toast.success('Address updated successfully');
            setIsEditOpen(false);
            setSelectedAddress(null);
            await reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update address');
        } finally {
            setUpdating(false);
        }
    }, [selectedAddress, editForm, editMap.mapPosition, rawAddresses, addresses, reload]);

    // ── Delete ──
    const handleDelete = useCallback((addr) => {
        setSelectedAddress(addr);
        setIsDeleteOpen(true);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!selectedAddress) return;
        const idx = addresses.findIndex((a) =>
            a.id === selectedAddress.id ||
            (a.address === selectedAddress.address && a.type === selectedAddress.type)
        );
        if (idx < 0) { setIsDeleteOpen(false); return; }

        setDeleting(true);
        try {
            await customerApi.updateProfile({
                addresses: rawAddresses.filter((_, i) => i !== idx),
            });
            toast.success('Address deleted successfully');
            setIsDeleteOpen(false);
            setSelectedAddress(null);
            await reload();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete address');
        } finally {
            setDeleting(false);
        }
    }, [selectedAddress, addresses, rawAddresses, reload]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-background pb-24 font-sans transition-colors duration-500">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-slate-50/95 dark:bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 dark:border-white/5 mb-4 flex items-center gap-2 transition-colors">
                <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); navigate(-1); }}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-white/10 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800 dark:text-slate-200" />
                </button>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Saved Addresses</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">
                {/* Add button */}
                <button
                    type="button"
                    onClick={openAddModal}
                    className="w-full bg-white dark:bg-card p-4 rounded-xl border border-slate-200 dark:border-white/5 flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Plus size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-semibold text-sm">Add New Address</span>
                </button>

                {/* Address list */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                            <p className="text-slate-500 font-medium">Loading addresses...</p>
                        </div>
                    ) : addresses.length === 0 ? (
                        <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                            <MapPin size={30} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-700 font-semibold mb-1">No saved addresses</p>
                            <p className="text-slate-500 text-sm">Add your first delivery address above</p>
                        </div>
                    ) : (
                        addresses.map((addr) => (
                            <AddressCard key={addr.id} addr={addr} onEdit={handleEdit} onDelete={handleDelete} />
                        ))
                    )}
                </div>
            </div>

            {/* ── Add Modal ── */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto sm:max-w-[425px] rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle>Add New Address</DialogTitle>
                        <DialogDescription>Enter your delivery details below.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <AddressFormFields
                            form={addForm}
                            onChange={setAddForm}
                            mapContainerRef={addMap.mapContainerRef}
                            mapLoading={addMap.mapLoading}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={saving}>Cancel</Button>
                        <Button type="button" className="bg-[#0c831f] hover:bg-[#0b721b]" onClick={handleSaveNewAddress} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Address'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Edit Modal ── */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto sm:max-w-[425px] rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle>Edit Address</DialogTitle>
                        <DialogDescription>Update your delivery details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <AddressFormFields
                            form={editForm}
                            onChange={setEditForm}
                            mapContainerRef={editMap.mapContainerRef}
                            mapLoading={editMap.mapLoading}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={updating}>Cancel</Button>
                        <Button type="button" className="bg-[#0c831f] hover:bg-[#0b721b]" onClick={handleUpdateAddress} disabled={updating}>
                            {updating ? 'Updating...' : 'Update Address'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Modal ── */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[425px] rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Address?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this address? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedAddress && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 my-2">
                            <p className="font-bold text-slate-800 mb-1">{selectedAddress.type}</p>
                            <p className="text-slate-600 text-sm">{selectedAddress.address}</p>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deleting}>Cancel</Button>
                        <Button type="button" variant="destructive" className="bg-red-500 hover:bg-red-600" onClick={handleConfirmDelete} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AddressesPage;