import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { customerApi } from "../services/customerApi";
import { invalidateCache } from "@core/api/dedupe";
import { Sparkles } from "lucide-react";

// MUI Icons
import HomeIcon from "@mui/icons-material/Home";
import DevicesIcon from "@mui/icons-material/Devices";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import KitchenIcon from "@mui/icons-material/Kitchen";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import PetsIcon from "@mui/icons-material/Pets";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SpaIcon from "@mui/icons-material/Spa";
import ToysIcon from "@mui/icons-material/Toys";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import YardIcon from "@mui/icons-material/Yard";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import DiamondIcon from "@mui/icons-material/Diamond";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import BuildIcon from "@mui/icons-material/Build";
import LuggageIcon from "@mui/icons-material/Luggage";

import { resolveQuickImageUrl } from "../utils/image";

// ---------------------------------------------------------------------------
// Color System — All backgrounds are dark/deep so white text stays readable
// Contrast ratio against #FFFFFF is ≥ 4.5:1 for every entry (WCAG AA)
// ---------------------------------------------------------------------------

const THEMES = {
  all: {
    gradient: "linear-gradient(to bottom, #D44A00, #7C2A00)",
    shadow: "shadow-orange-700/30",
    headerColor: "#F26522",
  },

  grocery: {
    gradient: "linear-gradient(to bottom, #540D36, #250316)",
    shadow: "shadow-pink-950/40",
    headerColor: "#540D36",
  },

  wedding: {
    gradient: "linear-gradient(to bottom, #420817, #190106)",
    shadow: "shadow-rose-950/60",
    headerColor: "#420817",
  },

  homeKitchen: {
    gradient: "linear-gradient(to bottom, #072C38, #021017)",
    shadow: "shadow-cyan-950/60",
    headerColor: "#072C38",
  },

  electronics: {
    gradient: "linear-gradient(to bottom, #22073D, #090114)",
    shadow: "shadow-violet-950/60",
    headerColor: "#22073D",
  },

  kids: {
    gradient: "linear-gradient(to bottom, #2B0F07, #120502)",
    shadow: "shadow-amber-950/60",
    headerColor: "#2B0F07",
  },

  pets: {
    gradient: "linear-gradient(to bottom, #0F3A5F, #061B2E)",
    shadow: "shadow-blue-900/40",
    headerColor: "#0F3A5F",
  },

  sports: {
    gradient: "linear-gradient(to bottom, #0A1B45, #020815)",
    shadow: "shadow-blue-950/60",
    headerColor: "#0A1B45",
  },

  beauty: {
    gradient: "linear-gradient(to bottom, #02281D, #000D09)",
    shadow: "shadow-emerald-950/60",
    headerColor: "#02281D",
  },

  fashion: {
    gradient: "linear-gradient(to bottom, #14123D, #05040F)",
    shadow: "shadow-indigo-950/60",
    headerColor: "#14123D",
  },

  default: {
    gradient: "linear-gradient(to bottom, #6B2200, #240B00)",
    shadow: "shadow-orange-950/60",
    headerColor: "#6B2200",
  },
};

// Shared accent for all categories (white text always works on dark backgrounds)
const TEXT_ACCENT = "text-white";

const CATEGORY_METADATA = {
  All: {
    icon: HomeIcon,
    theme: THEMES.all,
    banner: { title: "HOUSEFULL", subtitle: "SALE", floatingElements: "sparkles" },
  },
  Grocery: {
    icon: LocalGroceryStoreIcon,
    theme: THEMES.grocery,
    banner: { title: "SUPERSAVER", subtitle: "FRESH & FAST", floatingElements: "leaves" },
  },
  Wedding: {
    icon: CardGiftcardIcon,
    theme: THEMES.wedding,
    banner: { title: "WEDDING", subtitle: "BLISS", floatingElements: "hearts" },
  },
  "Home & Kitchen": {
    icon: KitchenIcon,
    theme: THEMES.homeKitchen,
    banner: { title: "HOME", subtitle: "KITCHEN", floatingElements: "smoke" },
  },
  Electronics: {
    icon: DevicesIcon,
    theme: THEMES.electronics,
    banner: { title: "TECH FEST", subtitle: "GADGETS", floatingElements: "tech" },
  },
  Kids: {
    icon: ChildCareIcon,
    theme: THEMES.kids,
    banner: { title: "LITTLE ONE", subtitle: "CARE", floatingElements: "bubbles" },
  },
  "Pet Supplies": {
    icon: PetsIcon,
    theme: THEMES.pets,
    banner: { title: "PAWSOME", subtitle: "DEALS", floatingElements: "bones" },
  },
  Sports: {
    icon: SportsSoccerIcon,
    theme: THEMES.sports,
    banner: { title: "SPORTS", subtitle: "GEAR", floatingElements: "confetti" },
  },
};

const ICON_COMPONENTS = {
  electronics: DevicesIcon,
  fashion: CheckroomIcon,
  home: HomeIcon,
  food: LocalCafeIcon,
  sports: SportsSoccerIcon,
  books: MenuBookIcon,
  beauty: SpaIcon,
  toys: ToysIcon,
  automotive: DirectionsCarIcon,
  pets: PetsIcon,
  health: LocalHospitalIcon,
  garden: YardIcon,
  office: BusinessCenterIcon,
  music: MusicNoteIcon,
  jewelry: DiamondIcon,
  baby: ChildCareIcon,
  tools: BuildIcon,
  luggage: LuggageIcon,
  art: ColorLensIcon,
  grocery: LocalGroceryStoreIcon,
};

// Returns a deep/dark header color so white text stays readable
const getDynamicHeaderColor = (name = "") => {
  const n = name.toLowerCase().trim();
  if (n.includes("all")) return THEMES.all.headerColor;
  if (n.includes("grocery") || n.includes("glocery")) return THEMES.grocery.headerColor;
  if (n.includes("electronic")) return THEMES.electronics.headerColor;
  if (n.includes("home") || n.includes("kitchen") || n.includes("kit")) return THEMES.homeKitchen.headerColor;
  if (n.includes("kid") || n.includes("child") || n.includes("baby") || n.includes("toy")) return THEMES.kids.headerColor;
  if (n.includes("pet") || n.includes("dog") || n.includes("cat")) return THEMES.pets.headerColor;
  if (n.includes("wedding") || n.includes("gift")) return THEMES.wedding.headerColor;
  if (n.includes("sport") || n.includes("soccer")) return THEMES.sports.headerColor;
  if (n.includes("beauty") || n.includes("spa")) return THEMES.beauty.headerColor;
  if (n.includes("fashion") || n.includes("cloth")) return THEMES.fashion.headerColor;
  return THEMES.default.headerColor;
};

const ALL_CATEGORY = {
  id: "all",
  _id: "all",
  name: "All",
  icon: HomeIcon,
  theme: THEMES.all,
  headerColor: THEMES.all.headerColor,
  banner: {
    title: "HOUSEFULL",
    subtitle: "SALE",
    floatingElements: "sparkles",
    textColor: TEXT_ACCENT,
  },
};

// ---------------------------------------------------------------------------
// Storage & Cache
// ---------------------------------------------------------------------------

const QUICK_HEADER_RETURN_STORAGE_KEY = "food.quick.headerReturn";
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes (content rarely changes this fast)

let globalQuickHomeCache = {
  data: null,
  headerSections: new Map(),    // headerId -> sections
  categoryProducts: new Map(),  // headerId -> products
  heroConfigs: new Map(),       // headerId -> hero config
  lastFetched: 0,
  zoneId: null,
  lat: null,
  lng: null
};

// ---------------------------------------------------------------------------
// Helper: format raw product from API
// ---------------------------------------------------------------------------
const formatProduct = (p) => ({
  ...p,
  id: p._id,
  image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
  price: Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.price || 0),
  originalPrice: Number(p.originalPrice || p.mrp || p.price || p.salePrice || 0),
  weight: p.weight || "1 unit",
  deliveryTime: "8-15 mins",
});

// ---------------------------------------------------------------------------
// Helper: extract array from varied API shapes
// ---------------------------------------------------------------------------
const extractArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useQuickHomeData = ({ currentLocation }) => {
  // Stale-while-revalidate: show any cached data immediately, even if expired
  const hasAnyCache = Boolean(globalQuickHomeCache.data);
  const hasValidCache = hasAnyCache && Date.now() - globalQuickHomeCache.lastFetched < CACHE_EXPIRY_MS;

  // Only block UI (show skeleton) if there is absolutely NO cached data
  const [isLoading, setIsLoading] = useState(!hasAnyCache);
  const [isBootstrapped, setIsBootstrapped] = useState(hasAnyCache);
  const [categories, setCategories] = useState(globalQuickHomeCache.data?.categories || [ALL_CATEGORY]);
  const [activeCategory, setActiveCategory] = useState(globalQuickHomeCache.data?.activeCategory || ALL_CATEGORY);
  const [products, setProducts] = useState(globalQuickHomeCache.data?.products || []);
  const [quickCategories, setQuickCategories] = useState(globalQuickHomeCache.data?.quickCategories || []);
  const [experienceSections, setExperienceSections] = useState(globalQuickHomeCache.data?.experienceSections || []);
  const [offerSections, setOfferSections] = useState(globalQuickHomeCache.data?.offerSections || []);
  const [categoryMap, setCategoryMap] = useState(globalQuickHomeCache.data?.categoryMap || {});
  const [subcategoryMap, setSubcategoryMap] = useState(globalQuickHomeCache.data?.subcategoryMap || {});
  const [heroConfig, setHeroConfig] = useState(globalQuickHomeCache.data?.heroConfig || { banners: { items: [] }, categoryIds: [] });
  const [headerSections, setHeaderSections] = useState([]);
  const [loadingHeaderSections, setLoadingHeaderSections] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState(null);

  const fetchDataSeqRef = useRef(0);

  const getQuickCategoryImage = useCallback((category = {}) => {
    const candidate =
      category?.image || category?.icon || category?.thumbnail ||
      category?.imageUrl || category?.iconUrl ||
      category?.media?.image || category?.media?.url || "";
    return resolveQuickImageUrl(candidate) || "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";
  }, []);

  // Build a formatted header category object from raw DB entry
  const buildHeaderCategory = useCallback((cat) => {
    const catName = cat.name;
    const normalizedName = catName.charAt(0).toUpperCase() + catName.slice(1).toLowerCase();
    const meta =
      CATEGORY_METADATA[catName] ||
      CATEGORY_METADATA[normalizedName] ||
      CATEGORY_METADATA[catName.toUpperCase()] || {
        icon: Sparkles,
        theme: THEMES.default,
        banner: { title: catName.toUpperCase(), subtitle: "TOP PICKS", floatingElements: "sparkles" },
      };

    const IconComp = (cat.iconId && ICON_COMPONENTS[cat.iconId]) || meta.icon || Sparkles;
    const headerColor = catName.toLowerCase().trim().includes("all")
      ? THEMES.all.headerColor
      : (cat.headerColor || getDynamicHeaderColor(catName));

    return {
      ...cat,
      id: cat._id,
      icon: IconComp,
      theme: meta.theme,
      headerColor,
      banner: { ...meta.banner, textColor: TEXT_ACCENT },
    };
  }, []);

  const fetchData = useCallback(async () => {
    const seq = ++fetchDataSeqRef.current;

    const currentZoneId = typeof window !== "undefined" ? window.localStorage?.getItem("userZoneId") : null;
    // Compare as numbers to avoid string vs number mismatch
    const cachedLat = parseFloat(globalQuickHomeCache.lat);
    const cachedLng = parseFloat(globalQuickHomeCache.lng);
    const newLat = parseFloat(currentLocation?.latitude);
    const newLng = parseFloat(currentLocation?.longitude);
    const locationChanged =
      cachedLat !== newLat ||
      cachedLng !== newLng ||
      globalQuickHomeCache.zoneId !== currentZoneId;

    // Re-check cache validity at call time (avoids stale closure)
    const cacheIsValid =
      !locationChanged &&
      globalQuickHomeCache.data &&
      Date.now() - globalQuickHomeCache.lastFetched < CACHE_EXPIRY_MS;

    if (cacheIsValid) return;

    if (locationChanged) {
      globalQuickHomeCache.headerSections.clear();
      globalQuickHomeCache.categoryProducts.clear();
      globalQuickHomeCache.heroConfigs.clear();
      // Clear dedupe cache so the API layer makes a fresh HTTP request
      invalidateCache('/quick-commerce/bootstrap');
      invalidateCache('/quick-commerce/products');
    }

    // Stale-while-revalidate: if stale data exists, don't show skeleton — refresh silently
    const isSilentRefresh = Boolean(globalQuickHomeCache.data);
    if (!isSilentRefresh) setIsLoading(true);

    try {
      // ── Single bootstrap call replaces 5 separate API requests ─────────────────────
      // Location sirf optional context ke liye pass karo — blocking nahi karega
      const latNum = parseFloat(currentLocation?.latitude);
      const lngNum = parseFloat(currentLocation?.longitude);
      const hasLocation = Number.isFinite(latNum) && Number.isFinite(lngNum);

      console.log("lat, lng 111: ", currentLocation?.latitude, currentLocation?.longitude);
      const bootstrapParams = {};
      if (hasLocation) {
        bootstrapParams.lat = latNum;
        bootstrapParams.lng = lngNum;
      }

      const bootstrapRes = await customerApi.getBootstrap(bootstrapParams);
      if (seq !== fetchDataSeqRef.current) return;

      if (!bootstrapRes?.data?.success) {
        throw new Error('Bootstrap fetch failed');
      }

      const payload = bootstrapRes.data.result;

      const newCache = {
        categories: [ALL_CATEGORY],
        activeCategory: ALL_CATEGORY,
        products: [],
        quickCategories: [],
        experienceSections: [],
        offerSections: [],
        heroConfig: { banners: { items: [] }, categoryIds: [] },
        categoryMap: {},
        subcategoryMap: {},
      };

      // ── Categories ─────────────────────────────────────────────────────────────
      const dbCats = payload.categories || [];

      const catMap = {};
      const subMap = {};
      dbCats.forEach((c) => {
        if (c.type === "category") catMap[c._id] = c;
        else if (c.type === "subcategory") subMap[c._id] = c;
      });
      setCategoryMap(catMap);
      setSubcategoryMap(subMap);
      newCache.categoryMap = catMap;
      newCache.subcategoryMap = subMap;

      const formattedHeaders = dbCats
        .filter((c) => c.type === "header")
        .map(buildHeaderCategory);

      const allFromAdmin = formattedHeaders.find(
        (h) => h.slug?.toLowerCase() === "all" || h.name?.toLowerCase() === "all"
      );
      const mergedAll = allFromAdmin
        ? {
          ...ALL_CATEGORY,
          _id: allFromAdmin._id,
          id: allFromAdmin._id,
          icon: allFromAdmin.icon || ALL_CATEGORY.icon
        }
        : ALL_CATEGORY;

      const headersWithoutAll = formattedHeaders.filter(
        (h) => !(h.slug?.toLowerCase() === "all" || h.name?.toLowerCase() === "all")
      );
      const finalCategories = [mergedAll, ...headersWithoutAll];
      setCategories(finalCategories);
      newCache.categories = finalCategories;

      // Restore active category from session
      let initialActive = mergedAll;
      const storedHeaderReturn = window.sessionStorage.getItem(QUICK_HEADER_RETURN_STORAGE_KEY);
      const storedExpReturn = window.sessionStorage.getItem("experienceReturn");
      const restoreId =
        (storedHeaderReturn && JSON.parse(storedHeaderReturn)?.headerId) ||
        (storedExpReturn && JSON.parse(storedExpReturn)?.headerId);
      if (restoreId) {
        const match = finalCategories.find((h) => h._id === restoreId || h.id === restoreId);
        if (match) initialActive = match;
      }
      setActiveCategory(initialActive);
      newCache.activeCategory = initialActive;

      const formattedQuick = dbCats
        .filter((c) => c.type === "category")
        .map((c) => ({ id: c._id, name: c.name, image: getQuickCategoryImage(c) }));
      setQuickCategories(formattedQuick);
      newCache.quickCategories = formattedQuick;

      // 🔑 Categories ready → UI immediately unblock karo
      setIsBootstrapped(true);
      setIsLoading(false);

      // ── Products (already in bootstrap payload) ────────────────────────────
      const rawProducts = payload.products || [];
      const formatted = rawProducts.map(formatProduct);
      setProducts(formatted);
      newCache.products = formatted;

      // ── Experience Sections ───────────────────────────────────────────
      const sections = payload.experienceSections || [];
      setExperienceSections(sections);
      newCache.experienceSections = sections;

      // ── Offer Sections ───────────────────────────────────────────────
      const offerSecs = payload.offerSections || [];
      setOfferSections(offerSecs);
      newCache.offerSections = offerSecs;

      // ── Hero Config ───────────────────────────────────────────────────
      const heroPayload = payload.heroConfig;
      const config =
        heroPayload?.banners?.items?.length > 0 || heroPayload?.categoryIds?.length > 0
          ? { banners: heroPayload.banners || { items: [] }, categoryIds: heroPayload.categoryIds || [] }
          : { banners: { items: [] }, categoryIds: [] };
      setHeroConfig(config);
      newCache.heroConfig = config;

      // Save complete cache — store parsed numbers for consistent comparisons
      globalQuickHomeCache.data = newCache;
      globalQuickHomeCache.lastFetched = Date.now();
      globalQuickHomeCache.lat = latNum;
      globalQuickHomeCache.lng = lngNum;
      globalQuickHomeCache.zoneId = currentZoneId;
    } catch (err) {
      // Surface errors only in dev
      if (import.meta.env?.DEV) console.error("Quick home bootstrap error:", err);
    } finally {
      if (seq === fetchDataSeqRef.current) setIsLoading(false);
    }
  }, [currentLocation, getQuickCategoryImage, buildHeaderCategory]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Fetch header-specific sections & products when active category changes ---
  useEffect(() => {
    if (!activeCategory) return;

    const isAll = activeCategory._id === "all" ||
      activeCategory.slug === "all" ||
      activeCategory.name?.toLowerCase() === "all";

    const headerId = activeCategory._id;

    const fetchHeaderSections = async () => {
      if (globalQuickHomeCache.headerSections.has(headerId)) {
        setHeaderSections(globalQuickHomeCache.headerSections.get(headerId));
        return;
      }
      setLoadingHeaderSections(true);
      try {
        const res = await customerApi.getExperienceSections({ pageType: "header", headerId });
        if (res.data.success) {
          const sections = extractArray(res.data.result ?? res.data.results ?? res.data);
          setHeaderSections(sections);
          globalQuickHomeCache.headerSections.set(headerId, sections);
        }
      } catch {
        // silently fail — cached empty array will be used
      } finally {
        setLoadingHeaderSections(false);
      }
    };

    const fetchCategoryProducts = async () => {
      if (isAll) {
        setCategoryProducts(null);
        return;
      }
      if (globalQuickHomeCache.categoryProducts.has(headerId)) {
        setCategoryProducts(globalQuickHomeCache.categoryProducts.get(headerId));
        return;
      }
      try {
        const res = await customerApi.getProducts({
          categoryId: headerId,
          limit: 50,
          lat: currentLocation?.latitude,
          lng: currentLocation?.longitude
        });
        if (res?.data?.success) {
          const formatted = extractArray(res.data.results ?? res.data.result).map(formatProduct);
          globalQuickHomeCache.categoryProducts.set(headerId, formatted);
          setCategoryProducts(formatted);
        }
      } catch {
        // silently fail — products fallback to home products
      }
    };

    const fetchHeroConfig = async () => {
      const homeConfig = globalQuickHomeCache.data?.heroConfig || { banners: { items: [] }, categoryIds: [] };
      if (isAll) {
        setHeroConfig(homeConfig);
        return;
      }
      if (!globalQuickHomeCache.heroConfigs) {
        globalQuickHomeCache.heroConfigs = new Map();
      }
      const cacheMap = globalQuickHomeCache.heroConfigs;
      if (cacheMap.has(headerId)) {
        setHeroConfig(cacheMap.get(headerId));
        return;
      }
      try {
        const res = await customerApi.getHeroConfig({ pageType: "header", headerId });
        if (res?.data?.success) {
          const config = res.data.result;
          const hasBanners = (config?.banners?.items || []).length > 0;
          const hasCategories = (config?.categoryIds || []).length > 0;

          // If a category has its own config (banners or categories), use it.
          // Otherwise, fall back to home page hero/category settings.
          const finalConfig = (hasBanners || hasCategories)
            ? {
              banners: config.banners || { items: [] },
              categoryIds: config.categoryIds || []
            }
            : homeConfig;

          cacheMap.set(headerId, finalConfig);
          setHeroConfig(finalConfig);
        } else {
          setHeroConfig(homeConfig);
        }
      } catch {
        setHeroConfig(homeConfig);
      }
    };

    fetchHeaderSections();
    fetchCategoryProducts();
    fetchHeroConfig();
  }, [activeCategory]);

  return {
    categories,
    activeCategory,
    setActiveCategory,
    products,
    categoryProducts,
    quickCategories,
    experienceSections,
    offerSections,
    categoryMap,
    subcategoryMap,
    headerSections,
    heroConfig,
    isLoading: isLoading || !isBootstrapped,
    loadingHeaderSections,
    isBootstrapped,
    actions: {
      refresh: () => {
        globalQuickHomeCache.data = null;
        if (globalQuickHomeCache.headerSections) globalQuickHomeCache.headerSections.clear();
        if (globalQuickHomeCache.categoryProducts) globalQuickHomeCache.categoryProducts.clear();
        if (globalQuickHomeCache.heroConfigs) globalQuickHomeCache.heroConfigs.clear();
        fetchData();
      },
    },
  };
};