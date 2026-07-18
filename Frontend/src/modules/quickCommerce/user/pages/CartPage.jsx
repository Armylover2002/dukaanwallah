import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion /*, AnimatePresence */ } from "framer-motion";
import Lottie from 'lottie-react';
import {
  ArrowLeft,
  Banknote,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Timer,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@core/context/SettingsContext';
import { useToast } from '@shared/components/ui/Toast';
import { useCart } from '../context/CartContext';
import { customerApi } from '../services/customerApi';
import emptyBoxAnimation from '../assets/lottie/Empty box.json';
import { getQuickCategoriesPath, getQuickCheckoutPath } from '../utils/routes';
import { resolveQuickImageUrl } from '../utils/image';
import { useLocation as useAppLocation } from '../context/LocationContext';
import LocationDrawer from '../components/shared/LocationDrawer';
import { useAuth } from '@core/context/AuthContext';

// ─── Pure helpers (outside component — no closure allocation on each render) ──

const DEFAULT_QUICK_BILLING_SETTINGS = {
  deliveryFee: 25,
  deliveryFeeRanges: [],
  deliveryCommissionRules: [],
  freeDeliveryThreshold: 0,
  platformFee: 0,
  gstRate: 0,
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&auto=format&fit=crop';
const CHECKOUT_STORAGE_KEY = "quick_commerce_checkout_state_v1";

const DEFAULT_CURRENT_ADDRESS = {
  type: "Home", name: "", address: "", landmark: "", city: "", phone: "",
};

const sanitizeCheckoutAddress = (addr) => {
  if (!addr || typeof addr !== "object") return DEFAULT_CURRENT_ADDRESS;
  return { ...DEFAULT_CURRENT_ADDRESS, ...addr };
};

const readStoredCheckoutState = () => {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return { ...parsed, currentAddress: sanitizeCheckoutAddress(parsed.currentAddress) };
  } catch {
    return {};
  }
};
const calculateQuickCartPricing = ({ subtotal = 0, cartItems = [], feeSettings = DEFAULT_QUICK_BILLING_SETTINGS, categoryFeeMap = {}, apiDeliveryFee = 0 }) => {
  const safeSubtotal = Number(subtotal || 0);
  const deliveryFee = Number(apiDeliveryFee || 0);

  const handlingFee = cartItems.reduce((maxFee, item) => {
    const candidateIds = [item?.headerId, item?.categoryId, item?.subcategoryId];
    const itemFee = candidateIds.reduce((cur, rawId) => {
      const id =
        rawId && typeof rawId === 'object' && rawId._id
          ? String(rawId._id)
          : String(rawId || '').trim();
      return Math.max(cur, Number(categoryFeeMap[id] || 0));
    }, 0);
    return Math.max(maxFee, itemFee);
  }, 0);

  const platformFee = Number(feeSettings?.platformFee || 0);
  const gstRate = Number(feeSettings?.gstRate || 0);
  const gstAmount =
    Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(safeSubtotal * (gstRate / 100))
      : 0;

  return {
    deliveryFee,
    handlingFee,
    platformFee,
    gstAmount,
    grandTotal: Math.max(0, safeSubtotal + deliveryFee + platformFee + gstAmount),
  };
};

// ─── Sub-components (memoized to prevent list re-renders) ─────────────────────

const CartItem = React.memo(({ item, onRemove, onUpdateQuantity, showToast }) => {
  const imageUrl = resolveQuickImageUrl(item.mainImage || item.image) || item.mainImage || item.image || FALLBACK_IMAGE;
  const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
  const stock = Number(item.stock ?? Infinity);

  const handleRemove = useCallback(() => onRemove(item), [onRemove, item]);
  const handleDecr = useCallback(() => onUpdateQuantity(item.id || item._id, -1), [onUpdateQuantity, item.id, item._id]);
  const handleIncr = useCallback(() => {
    if (item.quantity >= stock) { showToast(`Only ${stock} items are available in stock.`, 'error'); return; }
    onUpdateQuantity(item.id || item._id, 1);
  }, [onUpdateQuantity, item.id, item._id, item.quantity, stock, showToast]);

  const handleImgError = useCallback((e) => { e.currentTarget.src = FALLBACK_IMAGE; }, []);
  return (
    <article className="rounded-[24px] bg-white dark:bg-card p-4 shadow-sm border border-slate-100 dark:border-white/5 transition-colors">
      <div className="flex gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800/50">
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-contain p-2"
            onError={handleImgError}
            loading="lazy"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-base font-semibold text-slate-900 dark:text-white">{item.name}</h2>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {(item.weight || item.unit || '1 unit') === '1 unit' || (item.weight || item.unit) === 'Default'
                  ? `${item.quantity} unit${item.quantity > 1 ? 's' : ''}`
                  : (item.weight || item.unit || '1 unit')}
              </p>
            </div>
            <button
              onClick={handleRemove}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/20"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">₹{itemTotal}</p>
              {item.quantity > 1 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">₹{item.price} each</p>
              )}
            </div>

            <div className="inline-flex items-center gap-3 rounded-full bg-slate-100 dark:bg-slate-800/80 px-2 py-1">
              <button
                onClick={handleDecr}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm"
              >
                <Minus size={14} strokeWidth={3} />
              </button>
              <span className="min-w-[18px] text-center text-sm font-bold text-slate-900 dark:text-white">
                {item.quantity}
              </span>
              <button
                onClick={handleIncr}
                disabled={item.quantity >= stock}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});
CartItem.displayName = 'CartItem';

// ─── Main CartPage ─────────────────────────────────────────────────────────────

const CartPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { cart, removeFromCart, updateQuantity, cartTotal, clearCart, loading } = useCart();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const { currentLocation, savedAddresses, updateLocation, refreshAddresses } = useAppLocation();

  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  const storedCheckoutState = useMemo(() => readStoredCheckoutState(), []);
  const [currentAddress, setCurrentAddress] = useState(storedCheckoutState.currentAddress || DEFAULT_CURRENT_ADDRESS);

  const displayName = currentAddress?.name || "Customer";
  const displayPhone = currentAddress?.phone || "Phone not provided";
  const displayAddress = [currentAddress?.address, currentAddress?.landmark, currentAddress?.city].filter(Boolean).join(", ");

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCommissionBreakdown, setShowCommissionBreakdown] = useState(false);

  useEffect(() => {
    if (showClearConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showClearConfirm]);
  const [quickBillingSettings, setQuickBillingSettings] = useState(DEFAULT_QUICK_BILLING_SETTINGS);
  const [categoryFeeMap, setCategoryFeeMap] = useState({});
  const [categoryCommissionMap, setCategoryCommissionMap] = useState({});
  const [isUserCodAllowed, setIsUserCodAllowed] = useState(true);
  const [storeLocation, setStoreLocation] = useState(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [isDeliverable, setIsDeliverable] = useState(true);
  const [apiDeliveryFee, setApiDeliveryFee] = useState(0);
  const [isEstimating, setIsEstimating] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('cash');

  // ── Stable path constants ──────────────────────────────────────────────────
  const categoriesPath = useMemo(() => getQuickCategoriesPath(), []);
  const checkoutPath = useMemo(() => getQuickCheckoutPath(), []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const itemCount = useMemo(
    () => cart.reduce((n, item) => n + Number(item.quantity || 0), 0),
    [cart],
  );

  const { deliveryFee, handlingFee, platformFee, gstAmount, grandTotal } = useMemo(
    () =>
      calculateQuickCartPricing({
        subtotal: cartTotal,
        cartItems: cart,
        feeSettings: quickBillingSettings,
        categoryFeeMap,
        apiDeliveryFee,
      }),
    [cartTotal, cart, quickBillingSettings, categoryFeeMap, apiDeliveryFee],
  );

  const paymentMethods = useMemo(
    () => [
      ...(settings?.onlineEnabled === false
        ? []
        : [{ id: 'online', label: 'Pay Online', icon: CreditCard, sublabel: 'UPI / Cards / NetBanking' }]),
      ...(settings?.codEnabled === false || !isUserCodAllowed
        ? []
        : [{ id: 'cash', label: 'Cash on Delivery', icon: Banknote, sublabel: 'Pay after delivery' }]),
    ],
    [settings?.onlineEnabled, settings?.codEnabled, isUserCodAllowed],
  );

  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find((m) => m.id === selectedPayment) || null,
    [paymentMethods, selectedPayment],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  // Fetch store location from first cart item's seller
  useEffect(() => {
    let mounted = true;
    const firstItem = cart[0];
    console.log("seller id----->", firstItem)
    const sellerId =
      firstItem?.quickStoreId?._id || firstItem?.quickStoreId?.id || (typeof firstItem?.quickStoreId === 'string' ? firstItem?.quickStoreId : null) ||
      firstItem?.storeId?._id || firstItem?.storeId?.id || (typeof firstItem?.storeId === 'string' ? firstItem?.storeId : null) ||
      firstItem?.sellerId?._id || firstItem?.sellerId?.id || (typeof firstItem?.sellerId === 'string' ? firstItem?.sellerId : null) ||
      firstItem?.seller?._id || firstItem?.seller?.id || (typeof firstItem?.seller === 'string' ? firstItem?.seller : null) ||
      firstItem?.productId?.sellerId || firstItem?.item?.sellerId;

    if (!sellerId || typeof sellerId !== 'string') {
      setStoreLocation(null);
      setDistanceKm(0);
      return;
    }

    customerApi.getStoreDetails(sellerId).then((response) => {
      if (!mounted) return;
      const store = response?.data?.result || response?.data?.data || null;
      if (!store) return;

      const loc = store.location;
      let sCoords = null;
      if (Array.isArray(loc?.coordinates) && loc.coordinates.length === 2) {
        sCoords = { lat: Number(loc.coordinates[1]), lng: Number(loc.coordinates[0]) };
      } else if (Number.isFinite(Number(loc?.latitude)) && Number.isFinite(Number(loc?.longitude))) {
        sCoords = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
      }
      setStoreLocation(sCoords);
    }).catch((err) => console.error('Failed to fetch store details:', err));

    return () => { mounted = false; };
  }, [cart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute distance and fee via Backend API whenever user location changes
  useEffect(() => {
    const firstItem = cart && cart.length > 0 ? cart[0] : null;
    if (!firstItem) {
      setDistanceKm(0);
      setApiDeliveryFee(0);
      setIsDeliverable(true);
      return;
    }

    const sellerId =
      firstItem?.quickStoreId?._id || firstItem?.quickStoreId?.id || (typeof firstItem?.quickStoreId === 'string' ? firstItem?.quickStoreId : null) ||
      firstItem?.storeId?._id || firstItem?.storeId?.id || (typeof firstItem?.storeId === 'string' ? firstItem?.storeId : null) ||
      firstItem?.sellerId?._id || firstItem?.sellerId?.id || (typeof firstItem?.sellerId === 'string' ? firstItem?.sellerId : null) ||
      firstItem?.seller?._id || firstItem?.seller?.id || (typeof firstItem?.seller === 'string' ? firstItem?.seller : null);

    // productId as fallback so backend can resolve seller
    const productId = firstItem?.productId || firstItem?.id || firstItem?._id || null;

    // Need at least one identifier
    if (!sellerId && !productId) {
      setDistanceKm(0);
      setApiDeliveryFee(0);
      setIsDeliverable(true);
      return;
    }

    const lat = Number(currentLocation?.latitude || currentLocation?.lat);
    const lng = Number(currentLocation?.longitude || currentLocation?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setDistanceKm(0);
      setApiDeliveryFee(0);
      setIsDeliverable(true);
      return;
    }

    setIsEstimating(true);
    const timer = setTimeout(() => {
      const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
      customerApi.estimateDistance({ sellerId, productId, location: { lat, lng }, subtotal })
        .then(res => {
          const result = res.data?.result;
          if (result) {
            setDistanceKm(result.distanceKm || 0);
            setApiDeliveryFee(result.estimatedDeliveryFee || 0);
            setIsDeliverable(result.isDeliverable ?? true);

            if (result.isDeliverable === false && result.distanceKm > (result.maxAllowedKm || 20)) {
              showToast(`Delivery not available for this location. Distance is ${result.distanceKm.toFixed(1)} km (Max allowed: ${result.maxAllowedKm || 20} km)`, "error");
            }
          }
        })
        .catch(err => console.error("Failed to estimate distance/fee:", err))
        .finally(() => setIsEstimating(false));
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [cart, currentLocation]);

  // Load billing settings + category fee map (single parallel fetch)
  useEffect(() => {
    let mounted = true;

    Promise.all([
      customerApi.getBillingSettings(),
      customerApi.getCategories({ tree: true }),
    ]).then(([billingResponse, categoriesResponse]) => {
      if (!mounted) return;

      const feeSettings =
        billingResponse?.data?.data?.feeSettings ||
        billingResponse?.data?.result ||
        null;
      if (feeSettings) {
        setQuickBillingSettings((prev) => ({
          ...prev,
          ...feeSettings,
          deliveryFeeRanges: Array.isArray(feeSettings.deliveryFeeRanges) ? feeSettings.deliveryFeeRanges : prev.deliveryFeeRanges,
          deliveryCommissionRules: Array.isArray(feeSettings.deliveryCommissionRules) ? feeSettings.deliveryCommissionRules : prev.deliveryCommissionRules,
        }));
      }

      const results = categoriesResponse?.data?.results || categoriesResponse?.data?.result || [];
      if (Array.isArray(results)) {
        const nextFeeMap = {};
        const nextCommMap = {};
        const visit = (items = []) => {
          items.forEach((item) => {
            const id = String(item?._id || item?.id || '').trim();
            if (id) {
              nextFeeMap[id] = Number(item?.handlingFees || 0);
              nextCommMap[id] = Number(item?.adminCommission || 0);
            }
            if (Array.isArray(item?.children) && item.children.length > 0) visit(item.children);
          });
        };
        visit(results);
        setCategoryFeeMap(nextFeeMap);
        setCategoryCommissionMap(nextCommMap);
      }
    }).catch((err) => console.error('Failed to load quick cart billing settings:', err));

    return () => { mounted = false; };
  }, []);

  // Refresh addresses on mount to ensure synchronization
  useEffect(() => {
    refreshAddresses?.();
  }, [refreshAddresses]);

  // Load user COD permission
  useEffect(() => {
    let mounted = true;
    customerApi.getProfile().then((response) => {
      if (!mounted) return;
      const profile = response?.data?.result || response?.data?.data || response?.data?.user || null;
      if (profile) setIsUserCodAllowed(profile.isCodAllowed !== false);
    }).catch(() => { if (mounted) setIsUserCodAllowed(true); });
    return () => { mounted = false; };
  }, []);

  // Sync selectedPayment when paymentMethods list changes
  useEffect(() => {
    if (!paymentMethods.length) return;
    if (!paymentMethods.some((m) => m.id === selectedPayment)) {
      setSelectedPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPayment]);

  // Auto-detect which saved address is currently active
  useEffect(() => {
    if (!savedAddresses.length) return;
    const matching = savedAddresses.find(
      (addr) => addr.address === currentLocation?.name
    );
    if (matching) {
      setActiveTab(matching.label === "Office" ? "Work" : matching.label);
    }
  }, [savedAddresses, currentLocation]);

  // Keep check-out state's address in sync with global currentLocation updates
  useEffect(() => {
    if (!currentLocation?.name) return;
    try {
      const CHECKOUT_STORAGE_KEY = "quick_commerce_checkout_state_v1";
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};

      if (parsed.currentAddress?.address !== currentLocation.name) {
        const nextAddress = {
          ...parsed.currentAddress,
          address: currentLocation.name,
          city: currentLocation.city || parsed.currentAddress?.city || "Indore",
          landmark: parsed.currentAddress?.landmark || "",
          location: currentLocation.latitude && currentLocation.longitude
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : parsed.currentAddress?.location,
        };

        localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
          ...parsed,
          currentAddress: nextAddress
        }));
      }
    } catch (err) {
      console.error("Failed to sync currentLocation to checkout state:", err);
    }
  }, [currentLocation]);

  const handleSelectAddress = useCallback((addr) => {
    if (!addr) return;

    const newLoc = {
      name: addr.address,
      time: "12-15 mins",
      city: addr.city || currentLocation?.city || "Indore",
      state: currentLocation?.state || "Madhya Pradesh",
      pincode: currentLocation?.pincode || "452018",
      latitude: addr.location?.lat ?? currentLocation?.latitude,
      longitude: addr.location?.lng ?? currentLocation?.longitude,
    };

    updateLocation(newLoc, { persist: true });

    try {
      const CHECKOUT_STORAGE_KEY = "quick_commerce_checkout_state_v1";
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};

      const nextAddress = {
        id: addr.id,
        type: addr.label,
        name: addr.name || parsed.currentAddress?.name || "",
        address: addr.address,
        city: addr.city || parsed.currentAddress?.city || "Indore",
        phone: addr.phone || parsed.currentAddress?.phone || "",
        landmark: "",
        location: addr.location ? { lat: addr.location.lat, lng: addr.location.lng } : undefined,
      };

      localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
        ...parsed,
        currentAddress: nextAddress
      }));
    } catch (err) {
      console.error("Failed to update checkout state in localStorage:", err);
    }

    showToast(`Delivery location set to ${addr.label}`, 'success');
  }, [currentLocation, updateLocation, showToast]);

  // ── Stable handlers ────────────────────────────────────────────────────────
  const handleRemove = useCallback(
    (item) => {
      removeFromCart(item.id || item._id);
      showToast(`${item.name} removed from cart`, 'info');
    },
    [removeFromCart, showToast],
  );

  const handleClearAll = useCallback(async () => {
    setShowClearConfirm(false);
    await clearCart();
    showToast('Cart cleared', 'info');
  }, [clearCart, showToast]);

  const handleBack = useCallback(() => {
    if (window.history.state && window.history.state.idx > 0) { navigate(-1); return; }
    navigate(categoriesPath);
  }, [navigate, categoriesPath]);

  const openClearConfirm = useCallback(() => setShowClearConfirm(true), []);
  const closeClearConfirm = useCallback(() => setShowClearConfirm(false), []);

  // ✅ FIX: LocationDrawer close hone pe addresses refresh karo
  const handleLocationDrawerClose = useCallback(() => {
    setIsLocationOpen(false);
    // Drawer band hote hi saved addresses reload karo taaki cart mein naya address dikhe
    refreshAddresses?.();
  }, [refreshAddresses]);

  // ── Loading / empty states ─────────────────────────────────────────────────
  if (loading && cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] px-4 py-6">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-[28px] bg-white px-6 py-16 text-center shadow-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#0c831f]" />
          <h2 className="mt-5 text-xl font-bold text-slate-900">Loading your cart</h2>
          <p className="mt-2 text-sm text-slate-500">Pulling in your saved items...</p>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#f7f7f7] dark:bg-slate-950 px-4 py-6 overflow-hidden flex flex-col">
        <div className="mx-auto max-w-md w-full h-full flex flex-col">
          <div className="mb-5 flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Your Cart</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Add items to get started</p>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-[28px] px-6 py-10 shadow-sm flex flex-col items-center justify-center mb-8">
            <div className="mb-6 flex h-44 w-44 items-center justify-center">
              <Lottie animationData={emptyBoxAnimation} loop className="h-40 w-40" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your cart is empty</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400 text-center">
              Pick a few essentials and they&apos;ll show up here.
            </p>
            <Link to={categoriesPath} className="mt-6 inline-flex w-full">
              <Button className="h-12 w-full rounded-2xl bg-[#0c831f] text-white hover:bg-[#0b721b]">
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-slate-950 pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-3xl px-4 py-5">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Your Cart</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{itemCount} item{itemCount === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button
            onClick={openClearConfirm}
            className="text-sm font-semibold text-rose-500 transition-colors hover:text-rose-600"
          >
            Clear all
          </button>
        </div>

        {/* Clear cart confirmation modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeClearConfirm}
            />
            <div className="relative z-10 w-full max-w-sm rounded-[28px] bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-white/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 mx-auto">
                <Trash2 size={22} className="text-rose-500 dark:text-rose-400" />
              </div>
              <h3 className="text-center text-lg font-bold text-slate-900 dark:text-white">Clear your cart?</h3>
              <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                All {itemCount} item{itemCount === 1 ? '' : 's'} will be removed. This can&apos;t be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={closeClearConfirm}
                  className="flex-1 rounded-2xl border-2 border-slate-200 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-600"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Banner */}
        <section className="mb-4 rounded-[24px] bg-[#e9f7ec] dark:bg-emerald-950/30 p-4 shadow-sm border border-transparent dark:border-emerald-900/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#0c831f] dark:text-emerald-400">
                Delivery in 10 minutes
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                Shipment from your nearby store
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Fast doorstep delivery with live seller-side processing.
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0c831f] shadow-sm">
              <Timer size={20} />
            </div>
          </div>
        </section>

        {/* Delivery Address Section Removed */}
        <motion.div className="bg-white dark:bg-card rounded-2xl p-5 mb-4 shadow-sm border border-slate-100 dark:border-white/5 mt-3 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-green-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin size={24} className="text-[#0c831f]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-800 dark:text-white text-lg">
                    Delivery Address
                  </span>
                  {currentAddress.type && (
                    <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {currentAddress.type}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm mt-1">
                  {displayName} • {displayPhone}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed line-clamp-2">
                  {displayAddress || "No delivery address selected. Please add one."}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/quick-commerce/addresses?from=cart")}
              className="px-4 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-[#0c831f] font-black text-xs uppercase tracking-widest transition-all border border-green-100"
            >
              Change
            </button>
          </div>
        </motion.div>
        {/* Cart Items — each item is memoized */}
        <div className="space-y-3">
          {cart.map((item, index) => (
            <CartItem
              key={`${item.id || item._id}-${index}`}
              item={item}
              onRemove={handleRemove}
              onUpdateQuantity={updateQuantity}
              showToast={showToast}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <Link to={categoriesPath} className="w-full">
            <Button variant="outline" className="w-full h-12 rounded-[20px] border-dashed border-2 border-[#0c831f] text-[#0c831f] hover:bg-[#0c831f]/5 font-bold text-sm tracking-wide dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
              <Plus size={18} className="mr-2" />
              Add more products
            </Button>
          </Link>
        </div>

        {/* Bill Details */}
        <section className="mt-4 rounded-[24px] bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Bill details</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Price breakdown</h2>
            </div>
            <span className="rounded-full bg-[#f0fdf4] dark:bg-emerald-900/30 px-3 py-1 text-xs font-bold text-[#0c831f] dark:text-emerald-400">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-400">
            {[
              ['Items total', cartTotal],
              ['Delivery fee', deliveryFee],
              ['Platform fee', platformFee],
              ['GST', gstAmount],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {label}
                    {label === 'Items total' && (
                      <button
                        onClick={() => setShowCommissionBreakdown(!showCommissionBreakdown)}
                        className="flex items-center text-[10px] text-[#0c831f] dark:text-emerald-400 font-semibold hover:bg-green-100 dark:hover:bg-emerald-900/50 bg-green-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded transition-colors"
                      >
                        (incl. of all taxes)
                        {showCommissionBreakdown ? <ChevronUp size={12} className="ml-0.5" /> : <ChevronDown size={12} className="ml-0.5" />}
                      </button>
                    )}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">₹{value}</span>
                </div>
                {label === 'Items total' && showCommissionBreakdown && (
                  <div className="mt-1 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2.5 space-y-2 shadow-sm">
                    {cart.map((item, idx) => {
                      const cIds = [item?.headerId, item?.categoryId, item?.subcategoryId];
                      let comm = item.adminCommission || item.commission;
                      if (!comm) {
                        for (const rawId of cIds) {
                          const id = rawId && typeof rawId === 'object' && rawId._id ? String(rawId._id) : String(rawId || '').trim();
                          if (id && categoryCommissionMap[id]) {
                            comm = categoryCommissionMap[id];
                            break;
                          }
                        }
                      }
                      return (
                        <div key={idx} className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="truncate pr-3 w-[80%]">{item.name}</span>
                          <span className="font-medium">{comm || 0}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <div className="border-t border-dashed border-slate-200 pt-3">
              <div className="flex items-center justify-between text-base font-bold text-slate-900">
                <span>To pay</span>
                <span>₹{grandTotal}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Payment Selection */}
        <section className="mt-4 rounded-[24px] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Payment</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Choose how you want to pay</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                We&apos;ll carry this choice into checkout so you don&apos;t have to pick it again.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {paymentMethods.length ? (
              paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedPayment === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedPayment(method.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all ${isSelected
                      ? 'border-[#0c831f] bg-green-50 dark:bg-green-900/20'
                      : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isSelected ? 'bg-green-100 dark:bg-green-800' : 'bg-slate-100 dark:bg-slate-700'}`}>
                      <Icon size={18} className={isSelected ? 'text-[#0c831f] dark:text-green-400' : 'text-slate-600 dark:text-slate-300'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${isSelected ? 'text-[#0c831f] dark:text-green-400' : 'text-slate-800 dark:text-white'}`}>
                        {method.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{method.sublabel}</p>
                    </div>
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${isSelected ? 'border-[#0c831f] bg-[#0c831f] dark:border-green-500 dark:bg-green-500' : 'border-slate-300 dark:border-slate-600'}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Payment options are currently unavailable. You can still review the order on checkout.
              </div>
            )}
          </div>
        </section>

      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[520] border-t border-slate-200 bg-white px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">To pay</p>
            <p className="truncate text-2xl font-bold text-slate-900">₹{grandTotal}</p>
            <p className="text-xs text-slate-500">
              {selectedPaymentMethod ? selectedPaymentMethod.label : 'Includes delivery charges'}
            </p>
          </div>

          {!isAuthenticated ? (
            <Button
              onClick={() => {
                showToast("Please login to proceed to checkout.", "error");
                navigate("/user/auth/login", { state: { from: location } });
              }}
              className="h-12 w-full rounded-2xl bg-[#0c831f] px-4 text-sm text-white whitespace-normal sm:whitespace-nowrap hover:bg-[#0b721b] block w-full flex-1 sm:min-w-[220px]"
            >
              <ShoppingBag size={18} className="mr-2 inline" />
              Proceed to Checkout
            </Button>
          ) : !isDeliverable ? (
            <div className="flex-1 sm:min-w-[220px]">
              <Button disabled className="h-12 w-full rounded-2xl bg-red-100 text-red-600 font-medium px-4 whitespace-normal sm:whitespace-nowrap">
                Delivery unavailable ({distanceKm} km away)
              </Button>
            </div>
          ) : (
            <Link
              to={checkoutPath}
              state={{ selectedPayment }}
              className="block w-full flex-1 sm:min-w-[220px]"
            >
              <Button disabled={isEstimating} className="h-12 w-full rounded-2xl bg-[#0c831f] px-4 text-sm text-white whitespace-normal sm:whitespace-nowrap hover:bg-[#0b721b]">
                {isEstimating ? (
                  <Timer size={18} className="mr-2 animate-spin" />
                ) : (
                  <ShoppingBag size={18} className="mr-2" />
                )}
                {isEstimating ? "Calculating..." : "Proceed to Checkout"}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ✅ FIX: onClose mein refreshAddresses call ho raha hai */}
      <LocationDrawer
        isOpen={isLocationOpen}
        onClose={handleLocationDrawerClose}
      />
    </div>
  );
};

export default CartPage;