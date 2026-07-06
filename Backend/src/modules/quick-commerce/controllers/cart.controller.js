import mongoose from 'mongoose';
import { QuickCart } from '../models/cart.model.js';
import { QuickProduct } from '../models/product.model.js';
import { ensureQuickCommerceSeedData } from '../services/seed.service.js';
import { calculateQuickPricing } from '../admin/services/billing.service.js';

const approvedProductFilter = {
  $or: [
    { isActive: true },
    { isActive: { $exists: false } },
    { status: 'active' },
  ],
  $and: [
    {
      $or: [
        { approvalStatus: { $exists: false } },
        { approvalStatus: 'approved' },
      ],
    },
  ],
};

const resolveId = (req) => {
  if (req.user?.userId) return { userId: req.user.userId };
  const sessionId = String(req.headers['x-quick-session'] || req.query.sessionId || req.body.sessionId || '').trim();
  return sessionId ? { sessionId } : null;
};

const buildCartInsertDoc = (idQuery) => {
  if (!idQuery) return { items: [] };
  if (idQuery.userId) {
    return {
      userId: idQuery.userId,
      sessionId: `user:${String(idQuery.userId)}`,
      items: [],
    };
  }
  return {
    sessionId: String(idQuery.sessionId || '').trim(),
    items: [],
  };
};

const mapCart = async (idQuery) => {
  const cart = await QuickCart.findOne(idQuery).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return { items: [], subtotal: 0, total: 0 };
  }

  const productIds = cart.items
    .map((item) => item.productId)
    .filter((id) => mongoose.isValidObjectId(id));

  const products = await QuickProduct.find({ _id: { $in: productIds }, ...approvedProductFilter }).lean();
  const productMap = products.reduce((acc, product) => {
    acc[String(product._id)] = product;
    return acc;
  }, {});

  const items = cart.items
    .map((item) => {
      const product = productMap[String(item.productId)];
      if (!product) return null;

      let variant = null;
      if (item.variantId && Array.isArray(product.variants)) {
        variant = product.variants.find(v => String(v._id) === String(item.variantId) || String(v.id) === String(item.variantId));
      }

      const pSalePrice = variant && Number(variant.salePrice || 0) > 0 ? Number(variant.salePrice) : Number(product.salePrice || 0);
      const pPrice = variant ? Number(variant.price || 0) : Number(product.price || 0);

      const unitPrice = pSalePrice > 0 ? pSalePrice : pPrice;
      const mrp = variant && Number(variant.price || 0) > 0 ? Number(variant.price) : Number(product.mrp || product.price || unitPrice || 0);

      const pName = variant ? `${product.name} - ${variant.name}` : product.name;
      const pStock = variant ? Number(variant.stock ?? 0) : Number(product.stock ?? 0);

      return {
        id: String(product._id) + (variant ? `-${variant._id}` : ''),
        productId: String(product._id),
        variantId: variant ? String(variant._id) : null,
        variantName: variant ? variant.name : null,
        categoryId: product.categoryId ? String(product.categoryId) : null,
        subcategoryId: product.subcategoryId ? String(product.subcategoryId) : null,
        headerId: product.headerId ? String(product.headerId) : null,
        name: pName,
        image: product.mainImage || product.image || '',
        mainImage: product.mainImage || product.image || '',
        price: unitPrice,
        salePrice: pSalePrice,
        mrp,
        originalPrice: mrp,
        unit: product.unit,
        stock: pStock,
        quantity: item.quantity,
        lineTotal: item.quantity * unitPrice,
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
  const { pricing } = await calculateQuickPricing({
    subtotal,
    products,
  });

  return {
    items,
    subtotal,
    deliveryFee: Number(pricing?.deliveryFee || 0),
    handlingFee: Number(pricing?.platformFee || 0),
    tax: Number(pricing?.tax || 0),
    gst: Number(pricing?.gst || 0),
    total: Number(pricing?.total || subtotal),
  };
};

export const getCart = async (req, res) => {
  await ensureQuickCommerceSeedData();
  const idQuery = resolveId(req);

  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  const cart = await mapCart(idQuery);
  return res.json({ success: true, result: cart });
};

export const addToCart = async (req, res) => {
  await ensureQuickCommerceSeedData();

  const idQuery = resolveId(req);
  let { productId } = req.body;
  const quantity = Number(req.body.quantity || 1);

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  let variantId = null;
  if (productId && String(productId).includes('-')) {
    const parts = String(productId).split('-');
    productId = parts[0];
    variantId = parts[1];
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  let variant = null;
  if (variantId && Array.isArray(product.variants)) {
    variant = product.variants.find(v => String(v._id) === String(variantId) || String(v.id) === String(variantId));
  }
  const stockLimit = variant ? Number(variant.stock || 0) : Number(product.stock || 0);

  const cart = await QuickCart.findOneAndUpdate(
    idQuery,
    { $setOnInsert: buildCartInsertDoc(idQuery) },
    { upsert: true, new: true }
  );

  const itemIndex = cart.items.findIndex((item) => String(item.productId) === String(productId) && String(item.variantId || null) === String(variantId || null));
  const currentQty = itemIndex >= 0 ? cart.items[itemIndex].quantity : 0;
  const targetQty = currentQty + Math.max(1, quantity);

  if (targetQty > stockLimit) {
    return res.status(400).json({
      success: false,
      message: `Only ${stockLimit} items are available in stock.`,
    });
  }

  if (itemIndex >= 0) {
    cart.items[itemIndex].quantity = targetQty;
  } else {
    cart.items.push({ productId, variantId, quantity: Math.max(1, quantity) });
  }

  await cart.save();

  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const updateCartItem = async (req, res) => {
  await ensureQuickCommerceSeedData();

  const idQuery = resolveId(req);
  let { productId, quantity } = req.body;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  let variantId = null;
  if (productId && String(productId).includes('-')) {
    const parts = String(productId).split('-');
    productId = parts[0];
    variantId = parts[1];
  }

  const qty = Number(quantity);
  let cart = await QuickCart.findOneAndUpdate(
    idQuery,
    { $setOnInsert: buildCartInsertDoc(idQuery) },
    { upsert: true, new: true }
  );

  const itemIndex = cart.items.findIndex((item) => String(item.productId) === String(productId) && String(item.variantId || null) === String(variantId || null));

  if (!Number.isFinite(qty) || qty <= 0) {
    if (itemIndex >= 0) cart.items.splice(itemIndex, 1);
  } else {
    const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let variant = null;
    if (variantId && Array.isArray(product.variants)) {
      variant = product.variants.find(v => String(v._id) === String(variantId) || String(v.id) === String(variantId));
    }
    const stockLimit = variant ? Number(variant.stock || 0) : Number(product.stock || 0);

    const targetQty = Math.floor(qty);
    if (targetQty > stockLimit) {
      return res.status(400).json({
        success: false,
        message: `Only ${stockLimit} items are available in stock.`,
      });
    }
    
    if (itemIndex >= 0) {
      cart.items[itemIndex].quantity = targetQty;
    } else {
      cart.items.push({ productId, variantId, quantity: targetQty });
    }
  }

  await cart.save();
  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const removeCartItem = async (req, res) => {
  await ensureQuickCommerceSeedData();

  const idQuery = resolveId(req);
  let { productId } = req.params;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  let variantId = null;
  if (productId && String(productId).includes('-')) {
    const parts = String(productId).split('-');
    productId = parts[0];
    variantId = parts[1];
  }

  const cart = await QuickCart.findOne(idQuery);
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  cart.items = cart.items.filter((item) => !(String(item.productId) === String(productId) && String(item.variantId || null) === String(variantId || null)));
  await cart.save();

  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const clearCart = async (req, res) => {
  await ensureQuickCommerceSeedData();

  const idQuery = resolveId(req);
  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  await QuickCart.findOneAndUpdate(
    idQuery,
    {
      $set: { items: [] },
      $setOnInsert: buildCartInsertDoc(idQuery),
    },
    { upsert: true, new: true }
  );
  return res.json({
    success: true,
    result: {
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      handlingFee: 0,
      tax: 0,
      gst: 0,
      total: 0,
    },
  });
};

