import mongoose from 'mongoose';
import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';
import { QuickExperienceSection } from '../models/experience.model.js';
import { QuickHeroConfig } from '../models/heroConfig.model.js';

const getCollection = (name) => mongoose.connection?.db?.collection(name) || null;

// --- In-memory Cache ---
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = {
  settings: { data: null, expiry: 0 },
  hero: { data: new Map(), expiry: 0 },
  experience: { data: new Map(), expiry: 0 },
  offerSections: { data: null, expiry: 0 },
  categories: { data: null, expiry: 0 }
};

const isExpired = (expiry) => Date.now() > expiry;

export const clearContentCache = () => {
  cache.settings.expiry = 0;
  cache.hero.data.clear();
  cache.experience.data.clear();
  cache.offerSections.expiry = 0;
  cache.categories.expiry = 0;
};

const toIdString = (value) => {
  if (!value) return null;
  let str = null;
  if (typeof value === 'object' && value !== null) {
    if (value._id) str = String(value._id);
    else if (value.id) str = String(value.id);
    else str = String(value);
  } else {
    str = String(value);
  }
  
  if (str && mongoose.Types.ObjectId.isValid(str)) {
    return str;
  }
  return null;
};

const toId = (value) => {
  if (!value) return null;
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
};

const normalizeStatusQuery = () => ({
  $and: [
    { status: { $ne: 'inactive' } },
    { isActive: { $ne: false } },
  ],
});

const approvedOrLegacyFilter = {
  $and: [
    {
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
      ],
    },
  ],
};

export const getQuickSettings = async () => {
  if (cache.settings.data && !isExpired(cache.settings.expiry)) {
    return cache.settings.data;
  }

  const collection = getCollection('quick_settings');
  if (!collection) return null;
  const data = await collection.findOne({}, { sort: { updatedAt: -1, createdAt: -1 } });
  
  cache.settings.data = data;
  cache.settings.expiry = Date.now() + CACHE_TTL;
  return data;
};

export const getQuickHeroConfig = async ({ pageType = 'home', headerId = null } = {}) => {
  const cacheKey = `${pageType}:${headerId}`;
  if (cache.hero.data.has(cacheKey) && !isExpired(cache.hero.expiry)) {
    return cache.hero.data.get(cacheKey);
  }

  const collection = getCollection('quick_hero_configs');
  if (!collection) return null;

  const query = { pageType };
  if (pageType === 'header') {
    query.headerId = headerId && headerId !== 'all' && headerId !== 'null' && mongoose.Types.ObjectId.isValid(String(headerId)) ? String(headerId) : null;
  }

  const data = await QuickHeroConfig.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
  
  cache.hero.data.set(cacheKey, data);
  cache.hero.expiry = Date.now() + CACHE_TTL;
  return data;
};

export const setQuickHeroConfig = async (data) => {
  const query = { pageType: data.pageType };
  if (data.pageType === 'header') {
    query.headerId = data.headerId ? String(data.headerId) : null;
  }

  const result = await QuickHeroConfig.findOneAndUpdate(
    query,
    { $set: data },
    { upsert: true, new: true }
  ).lean();
  clearContentCache();
  return result;
};

export const getQuickExperienceSections = async ({ pageType = 'home', headerId = null, isAdmin = false } = {}) => {
  const cacheKey = `${pageType}:${headerId}`;
  if (!isAdmin && cache.experience.data.has(cacheKey) && !isExpired(cache.experience.expiry)) {
    return cache.experience.data.get(cacheKey);
  }

  const collection = getCollection('quick_experience_sections');
  if (!collection) return [];

  const query = {
    pageType,
  };

  if (!isAdmin) {
    Object.assign(query, normalizeStatusQuery());
  }

  if (pageType === 'header') {
    let isAllCategory = false;
    if (headerId) {
      if (String(headerId).toLowerCase() === 'all') {
        isAllCategory = true;
      } else if (mongoose.Types.ObjectId.isValid(headerId)) {
        const category = await QuickCategory.findById(headerId).lean();
        if (category && (category.slug === 'all' || category.name?.toLowerCase() === 'all')) {
          isAllCategory = true;
        }
      }
    }

    if (isAllCategory && isAdmin) {
      // Admin: show sections across all header categories
    } else {
      query.headerId = headerId && headerId !== 'all' && headerId !== 'null' && mongoose.Types.ObjectId.isValid(String(headerId)) ? String(headerId) : null;
    }
  }

  const sections = await QuickExperienceSection.find(query).sort({ order: 1, createdAt: 1 }).lean();
  if (!sections.length) return [];

  // --- Category Tree Logic (Optimized) ---
  const getCategoryTreeInfo = async () => {
    if (cache.categories.data && !isExpired(cache.categories.expiry)) {
      return cache.categories.treeInfo;
    }
    const allCategories = await QuickCategory.find(normalizeStatusQuery()).lean();
    const childrenMap = new Map();
    allCategories.forEach(c => {
      if (c.parentId) {
        const pid = String(c.parentId);
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid).push(c);
      }
    });

    const getRecursiveChildIds = (catId, seen = new Set()) => {
      const id = String(catId);
      if (seen.has(id)) return [];
      seen.add(id);
      let ids = [id];
      const children = childrenMap.get(id) || [];
      children.forEach(child => {
        ids = [...ids, ...getRecursiveChildIds(child._id, seen)];
      });
      return ids;
    };

    const treeInfo = { allCategories, childrenMap, getRecursiveChildIds };
    cache.categories.data = allCategories;
    cache.categories.treeInfo = treeInfo;
    cache.categories.expiry = Date.now() + CACHE_TTL;
    return treeInfo;
  };

  const { getRecursiveChildIds } = await getCategoryTreeInfo();

  // Hydrate data
  const productIds = new Set();
  const categoryIds = new Set();
  const subcategoryIds = new Set();
  
  const dynamicProductCategoryIds = new Set();
  const dynamicProductSubcategoryIds = new Set();

  sections.forEach((section) => {
    const { config = {} } = section;
    const typeConfig = config[section.displayType] || config; // Handle both nested and flat
    
    // Banners
    const bannerItems = typeConfig.banners?.items || typeConfig.items || [];

    // Categories
    const catIds = typeConfig.categoryIds || [];
    catIds.forEach(id => {
      const nid = toIdString(id);
      if (nid) categoryIds.add(nid);
    });

    // Subcategories
    const subcatIds = typeConfig.subcategoryIds || [];
    subcatIds.forEach(id => {
      const nid = toIdString(id);
      if (nid) subcategoryIds.add(nid);
    });

    // Products
    const prodIds = typeConfig.productIds || [];
    prodIds.forEach(id => {
      const nid = toIdString(id);
      if (nid) productIds.add(nid);
    });

    // If products type and no explicit products, collect categories for dynamic fetch
    if (section.displayType === 'products' && (!prodIds || prodIds.length === 0)) {
       catIds.forEach(id => {
         const nid = toIdString(id);
         if (nid) {
            getRecursiveChildIds(nid).forEach(childId => dynamicProductCategoryIds.add(childId));
         }
       });
       subcatIds.forEach(id => {
         const nid = toIdString(id);
         if (nid) {
            getRecursiveChildIds(nid).forEach(childId => dynamicProductSubcategoryIds.add(childId));
         }
       });
    }
  });

  const [products, categories] = await Promise.all([
    (productIds.size || dynamicProductCategoryIds.size || dynamicProductSubcategoryIds.size)
      ? QuickProduct.find({ 
          $and: [
            { 
              $or: [
                { _id: { $in: Array.from(productIds) } },
                { categoryId: { $in: Array.from(dynamicProductCategoryIds) } },
                { subcategoryId: { $in: Array.from(dynamicProductSubcategoryIds) } },
                { headerId: { $in: Array.from(dynamicProductCategoryIds) } }
              ]
            },
            approvedOrLegacyFilter,
            { isActive: { $ne: false } }
          ]
        }).sort({ createdAt: -1 }).limit(500).lean()
      : Promise.resolve([]),
    (categoryIds.size || subcategoryIds.size)
      ? QuickCategory.find({
          _id: { $in: Array.from(new Set([...Array.from(categoryIds), ...Array.from(subcategoryIds)])) },
          isActive: { $ne: false }
        }).lean()
      : Promise.resolve([]),
  ]);

  const productsById = new Map(products.map((p) => [String(p._id), p]));
  const categoriesById = new Map(categories.map((c) => [String(c._id), c]));

  const finalSections = sections.map((section) => {
    const { config = {} } = section;
    const typeConfig = config[section.displayType] || config;
    const newConfig = { ...config };

    if (section.displayType === 'categories') {
      const target = config.categories ? { ...config.categories } : { ...config };
      target.items = (target.categoryIds || [])
          .map(id => categoriesById.get(toIdString(id)))
          .filter(Boolean);
      
      newConfig.categories = target;
    }

    if (section.displayType === 'subcategories') {
      const target = config.subcategories ? { ...config.subcategories } : { ...config };
      target.items = (target.subcategoryIds || [])
          .map(id => categoriesById.get(toIdString(id)))
          .filter(Boolean);
      
      newConfig.subcategories = target;
    }

    if (section.displayType === 'products') {
      const target = config.products ? { ...config.products } : { ...config };
      const explicitItems = (target.productIds || [])
          .map(id => productsById.get(toIdString(id)))
          .filter(Boolean);
      
      if (explicitItems.length > 0) {
        target.items = explicitItems;
      } else {
        const sectionCatIds = new Set((target.categoryIds || []).map(toIdString).filter(Boolean));
        const sectionSubcatIds = new Set((target.subcategoryIds || []).map(toIdString).filter(Boolean));
        
        const expandedCatIds = new Set();
        sectionCatIds.forEach(id => getRecursiveChildIds(id).forEach(cid => expandedCatIds.add(cid)));
        const expandedSubcatIds = new Set();
        sectionSubcatIds.forEach(id => getRecursiveChildIds(id).forEach(cid => expandedSubcatIds.add(cid)));

        target.items = products.filter(p => 
          expandedCatIds.has(toIdString(p.categoryId)) || 
          expandedSubcatIds.has(toIdString(p.subcategoryId)) ||
          expandedCatIds.has(toIdString(p.headerId))
        ).slice(0, (target.rows || 1) * (target.columns || 4) || 20);
      }
      
      newConfig.products = target;
    }

    return {
      ...section,
      config: newConfig
    };
  });

  if (!isAdmin) {
    cache.experience.data.set(cacheKey, finalSections);
    cache.experience.expiry = Date.now() + CACHE_TTL;
  }
  return finalSections;
};

export const createQuickExperienceSection = async (data) => {
  // Get max order to append at end
  const maxSection = await QuickExperienceSection.findOne({
    pageType: data.pageType,
    headerId: data.headerId || null
  }).sort({ order: -1 });
  
  const order = (maxSection?.order ?? -1) + 1;
  const result = await QuickExperienceSection.create({ ...data, order });
  clearContentCache();
  return result;
};

export const updateQuickExperienceSection = async (id, data) => {
  const result = await QuickExperienceSection.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  clearContentCache();
  return result;
};

export const deleteQuickExperienceSection = async (id) => {
  const result = await QuickExperienceSection.findByIdAndDelete(id);
  clearContentCache();
  return result;
};

export const reorderQuickExperienceSections = async (items = []) => {
  const ops = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));
  if (!ops.length) return;
  const result = await QuickExperienceSection.bulkWrite(ops);
  clearContentCache();
  return result;
};

export const getQuickCoupons = async () => {
  const collection = getCollection('quick_coupons');
  if (!collection) return [];
  return collection.find(normalizeStatusQuery()).sort({ updatedAt: -1, createdAt: -1 }).toArray();
};

export const getAdminQuickCoupons = async (params = {}) => {
  const collection = getCollection('quick_coupons');
  if (!collection) return [];
  const filter = {};
  const andConditions = [];
  const now = new Date();

  if (params.status && params.status !== 'all') {
    if (params.status === 'active') {
      andConditions.push({
        isActive: true,
        $or: [
          { validTill: null },
          { validTill: { $gt: now } }
        ]
      });
    } else if (params.status === 'expired') {
      andConditions.push({
        $or: [
          { isActive: false },
          { validTill: { $ne: null, $lte: now } }
        ]
      });
    }
  }

  if (params.search) {
    andConditions.push({
      $or: [
        { code: { $regex: params.search, $options: 'i' } },
        { title: { $regex: params.search, $options: 'i' } },
        { description: { $regex: params.search, $options: 'i' } },
      ]
    });
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  return collection.find(filter).sort({ updatedAt: -1, createdAt: -1 }).toArray();
};

export const expireQuickCoupons = async () => {
  const now = new Date();
  const { SellerCoupon } = await import('../models/sellerCoupon.model.js');
  
  // 1. Auto-expire approved seller coupons
  const expiredSellers = await SellerCoupon.updateMany(
    { status: 'Approved', expiryDate: { $lte: now } },
    { $set: { status: 'Expired' } }
  );

  // 2. Auto-deactivate active admin quick coupons
  const collection = getCollection('quick_coupons');
  let expiredAdminsCount = 0;
  if (collection) {
    const expiredAdmins = await collection.updateMany(
      { isActive: true, validTill: { $ne: null, $lte: now } },
      { $set: { isActive: false, status: 'expired' } }
    );
    expiredAdminsCount = expiredAdmins.modifiedCount;
  }

  // 3. Clear cache if modifications occurred
  if (expiredSellers.modifiedCount > 0 || expiredAdminsCount > 0) {
    try {
      const { invalidateCache } = await import('../../../../middleware/cache.js');
      await invalidateCache('quick_coupons*');
      await invalidateCache('quick_offers*');
    } catch (err) {
      console.error('Failed to invalidate cache in expireQuickCoupons:', err);
    }
  }
};

export const createAdminQuickCoupon = async (data) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  if (!data.code) throw new Error('Coupon code is required');
  if (!data.discountValue || Number(data.discountValue) <= 0) throw new Error('Discount value must be greater than 0');

  const existing = await collection.findOne({ code: String(data.code).toUpperCase().trim() });
  if (existing) throw new Error('A coupon with this code already exists');

  const coupon = {
    ...data,
    code: String(data.code).toUpperCase().trim(),
    discountValue: Number(data.discountValue),
    minOrderValue: data.minOrderValue ? Number(data.minOrderValue) : 0,
    maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : undefined,
    usageLimit: data.usageLimit ? Number(data.usageLimit) : undefined,
    perUserLimit: data.perUserLimit ? Number(data.perUserLimit) : 1,
    usedCount: 0,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    status: 'active',
    validFrom: data.validFrom || null,
    validTill: data.validTill || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(coupon);
  return { ...coupon, _id: result.insertedId };
};

export const updateAdminQuickCoupon = async (id, data) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  const update = {
    ...data,
    updatedAt: new Date(),
  };
  if (update.code) update.code = String(update.code).toUpperCase().trim();
  if (update.discountValue !== undefined) update.discountValue = Number(update.discountValue);
  if (update.minOrderValue !== undefined) update.minOrderValue = Number(update.minOrderValue);
  if (update.maxDiscount !== undefined) update.maxDiscount = update.maxDiscount ? Number(update.maxDiscount) : undefined;
  delete update._id;

  const { ObjectId } = mongoose.Types;
  const objId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objId) throw new Error('Invalid coupon ID');

  const result = await collection.findOneAndUpdate(
    { _id: objId },
    { $set: update },
    { returnDocument: 'after' }
  );
  return result;
};

export const deleteAdminQuickCoupon = async (id) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  const { ObjectId } = mongoose.Types;
  const objId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objId) throw new Error('Invalid coupon ID');

  await collection.deleteOne({ _id: objId });
  return true;
};

export const toggleAdminQuickCouponStatus = async (id) => {
  const collection = getCollection('quick_coupons');
  if (!collection) throw new Error('Collection not found');

  const { ObjectId } = mongoose.Types;
  const objId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!objId) throw new Error('Invalid coupon ID');

  const existing = await collection.findOne({ _id: objId });
  if (!existing) throw new Error('Coupon not found');

  const newStatus = !existing.isActive;
  await collection.updateOne({ _id: objId }, { $set: { isActive: newStatus, updatedAt: new Date() } });
  return { ...existing, isActive: newStatus };
};

export const getQuickOffers = async () => {
  const collection = getCollection('quick_offers');
  if (!collection) return [];
  return collection.find(normalizeStatusQuery()).sort({ updatedAt: -1, createdAt: -1 }).toArray();
};

export const getQuickOfferSections = async (query = {}) => {
  const hasQuery = Object.keys(query).length > 0;
  if (!hasQuery && cache.offerSections.data && !isExpired(cache.offerSections.expiry)) {
    return cache.offerSections.data;
  }

  const collection = getCollection('quick_offer_sections');
  if (!collection) return [];

  const filter = normalizeStatusQuery();
  if (query.status && query.status !== 'all') {
    // Override normalizeStatusQuery if explicit status is provided
    filter.$and = filter.$and.filter(f => !f.status);
    filter.$and.push({ status: query.status });
  }

  const sections = await collection
    .find(filter)
    .sort({ order: 1, createdAt: 1 })
    .toArray();

  if (!sections.length) return [];

  const productIds = new Set();
  const categoryIds = new Set();

  sections.forEach((section) => {
    const rawProductIds = Array.isArray(section.productIds) ? section.productIds : [];
    rawProductIds.forEach((id) => {
      const normalized = toIdString(id);
      if (normalized) productIds.add(normalized);
    });

    const rawCategoryIds = Array.isArray(section.categoryIds)
      ? section.categoryIds
      : section.categoryId
        ? [section.categoryId]
        : [];

    rawCategoryIds.forEach((id) => {
      const normalized = toIdString(id);
      if (normalized) categoryIds.add(normalized);
    });
  });

  const [products, categories] = await Promise.all([
    productIds.size
      ? QuickProduct.find({ _id: { $in: Array.from(productIds) } }).lean()
      : Promise.resolve([]),
    categoryIds.size
      ? QuickCategory.find({ _id: { $in: Array.from(categoryIds) } }).lean()
      : Promise.resolve([]),
  ]);

  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const categoriesById = new Map(categories.map((category) => [String(category._id), category]));

  const finalOfferSections = sections.map((section) => {
    const hydratedCategoryIds = (Array.isArray(section.categoryIds) ? section.categoryIds : [])
      .map((id) => categoriesById.get(toIdString(id)) || id);

    const hydratedCategory =
      categoriesById.get(toIdString(section.categoryId)) || section.categoryId || null;

    const hydratedProducts = (Array.isArray(section.productIds) ? section.productIds : [])
      .map((id) => productsById.get(toIdString(id)) || id);

    return {
      ...section,
      categoryId: hydratedCategory,
      categoryIds: hydratedCategoryIds,
      productIds: hydratedProducts,
    };
  });

  if (!hasQuery) {
    cache.offerSections.data = finalOfferSections;
    cache.offerSections.expiry = Date.now() + CACHE_TTL;
  }
  return finalOfferSections;
};

export const createQuickOfferSection = async (data) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  const section = {
    ...data,
    order: data.order ?? 0,
    status: data.status || 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(section);
  clearContentCache();
  return { ...section, _id: result.insertedId };
};

export const updateQuickOfferSection = async (id, data) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  const update = {
    ...data,
    updatedAt: new Date(),
  };
  delete update._id;

  const result = await collection.findOneAndUpdate(
    { _id: toId(id) },
    { $set: update },
    { returnDocument: 'after' }
  );
  clearContentCache();
  return result;
};

export const deleteQuickOfferSection = async (id) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  await collection.deleteOne({ _id: toId(id) });
  clearContentCache();
  return true;
};

export const reorderQuickOfferSections = async (items = []) => {
  const collection = getCollection('quick_offer_sections');
  if (!collection) throw new Error('Collection not found');

  const ops = items.map((item) => ({
    updateOne: {
      filter: { _id: toId(item.id) },
      update: { $set: { order: item.order, updatedAt: new Date() } },
    },
  }));

  if (ops.length > 0) {
    await collection.bulkWrite(ops);
  }
  clearContentCache();
  return true;
};

export const getQuickCategories = async (query = {}) => {
  if (!query.parentId && cache.categories.data && !isExpired(cache.categories.expiry)) {
    return cache.categories.data;
  }

  const filter = normalizeStatusQuery();

  if (query.parentId) {
    filter.$and.push({ parentId: query.parentId });
  }

  const categories = await QuickCategory.find(filter)
    .sort({ order: 1, name: 1 })
    .lean();

  if (!query.parentId) {
    cache.categories.data = categories;
    cache.categories.expiry = Date.now() + CACHE_TTL;
  }
  return categories;
};
