import mongoose from 'mongoose';
import { getIO, rooms } from '../../../config/socket.js';
import { logger } from '../../../utils/logger.js';
import { QuickOrder } from '../models/order.model.js';
import { QuickCart } from '../models/cart.model.js';
import { QuickProduct } from '../models/product.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { getSellerCommissionSnapshot } from '../admin/services/commission.service.js';
import {
  calculateQuickPricing,
  getRiderEarning as getQuickRiderEarning,
} from '../admin/services/billing.service.js';
import * as foodTransactionService from '../../food/orders/services/foodTransaction.service.js';
import { emitQuickCommerceStatusUpdate } from '../services/quickStatusRealtime.service.js';
import { getSellerLocation, getOrderAddressPoint } from '../services/quickOrder.service.js';
import { haversineKm } from '../../food/orders/services/order.helpers.js';
import { createRazorpayOrder, isRazorpayConfigured, getRazorpayKeyId } from '../../food/orders/helpers/razorpay.helper.js';
import { autoRefundForCancelledOrder } from '../../../core/payments/autoRefund.service.js';
import { verifyPayment as verifyFoodPayment } from '../../food/orders/services/order.service.js';
import { sendWhatsAppTemplate } from '../../whatsapp/services/whatsapp.service.js';
import { notifyOwnerSafely } from '../../food/orders/services/order.helpers.js';

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
  const sessionId = String(req.headers['x-quick-session'] || req.body.sessionId || req.query.sessionId || '').trim();
  return sessionId ? { sessionId } : null;
};

const getOrderPayableAmount = (order) => {
  const pricing = order?.pricing || {};
  // pricing.total already includes: subtotal + deliveryFee + platformFee + gst - discount
  // No need to add platformFee again here.
  const total = Number(pricing.total ?? order?.total ?? 0);
  return Number.isFinite(total) ? Math.max(0, total) : 0;
};

const normalizeOrderSummary = (order) => {
  const amount = getOrderPayableAmount(order);
  const paymentMethod = order?.payment?.method || order?.paymentMethod || 'cash';
  const paymentStatus = order?.payment?.status || order?.paymentStatus || '';

  return {
    id: order._id,
    _id: order._id,
    orderId: order.orderId,
    orderNumber: order.orderId,
    total: amount,
    totalAmount: amount,
    payableAmount: amount,
    amount,
    status: order.orderStatus,
    orderStatus: order.orderStatus,
    workflowStatus: order.workflowStatus || '',
    paymentMethod,
    paymentStatus,
    payment: order.payment || {},
    itemCount: Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      : 0,
    createdAt: order.createdAt,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
        itemId: item.itemId || item.productId || '',
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
      }))
      : [],
    pricing: order.pricing || {},
  };
};

const normalizeDeliveryAddress = (address) => {
  if (!address || typeof address !== 'object') return null;

  const name = String(address.name || address.fullName || '').trim();
  const street = String(address.address || address.street || '').trim();
  const city = String(address.city || '').trim();
  const additionalDetails = String(address.landmark || address.additionalDetails || '').trim();
  const phone = String(address.phone || '').trim();
  const label = ['Home', 'Office', 'Other'].includes(address.type) ? address.type : 'Other';
  const lat = Number(address.location?.lat);
  const lng = Number(address.location?.lng);

  return {
    name,
    label,
    street,
    additionalDetails,
    city: city || 'NA',
    state: 'NA',
    zipCode: '',
    phone,
    ...(Number.isFinite(lat) && Number.isFinite(lng)
      ? {
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      }
      : {}),
  };
};

const normalizeRequestedItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      let productId = String(item?.productId || item?.itemId || item?.id || item?._id || '').trim();
      let variantId = item?.variantId ? String(item.variantId).trim() : null;

      if (productId.includes('-')) {
        const parts = productId.split('-');
        productId = parts[0];
        if (!variantId) variantId = parts[1];
      }

      return {
        productId,
        variantId: variantId && mongoose.isValidObjectId(variantId) ? variantId : null,
        quantity: Math.max(1, Number(item?.quantity || 1)),
      };
    })
    .filter((item) => item.productId && mongoose.isValidObjectId(item.productId));
};

const emitQuickOrderStatusUpdate = (order, message = '') => {
  try {
    void emitQuickCommerceStatusUpdate(order, { message });
  } catch {
    // best-effort realtime update
  }
};

const emitQuickSellerOrders = (sellerOrders) => {
  try {
    const io = getIO();
    if (!io || !Array.isArray(sellerOrders) || sellerOrders.length === 0) return;

    sellerOrders.forEach((sellerOrder) => {
      if (!sellerOrder?.sellerId) return;
      const payload = {
        orderId: sellerOrder.orderId,
        sellerOrderId: sellerOrder._id?.toString?.() || '',
        status: sellerOrder.status,
        workflowStatus: sellerOrder.workflowStatus,
        items: sellerOrder.items || [],
        pricing: sellerOrder.pricing || {},
        createdAt: sellerOrder.createdAt || new Date(),
      };

      io.to(rooms.seller(sellerOrder.sellerId)).emit('new_order', payload);
      io.to(rooms.seller(sellerOrder.sellerId)).emit('order:new', payload);
      // Trigger notification sound on seller panel (same as restaurant/delivery)
      io.to(rooms.seller(sellerOrder.sellerId)).emit('play_notification_sound', {
        orderId: sellerOrder.orderId,
        sellerOrderId: sellerOrder._id?.toString?.() || '',
      });

      // FCM Push Notification to seller
      notifyOwnerSafely(
        { ownerType: 'SELLER', ownerId: sellerOrder.sellerId },
        {
          title: 'New order received!',
          body: `Order #${sellerOrder.orderId} is waiting for your action.`,
          data: {
            type: 'new_seller_order',
            orderId: sellerOrder.orderId,
            sellerOrderId: sellerOrder._id?.toString?.() || '',
            orderType: sellerOrder.orderType || 'quick',
            link: '/seller/orders',
          },
        },
      ).catch(() => { /* best-effort */ });
    });
  } catch {
    // best-effort realtime update
  }
};

export const placeOrder = async (req, res) => {
  try {
    const idQuery = resolveId(req);

    if (!idQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const cart = await QuickCart.findOne(idQuery).lean();
    const requestedItems = normalizeRequestedItems(req.body?.items);
    // Prefer explicitly requested items from checkout to ensure variant exact match, fallback to DB cart
    const sourceItems =
      Array.isArray(requestedItems) && requestedItems.length > 0 ? requestedItems : (Array.isArray(cart?.items) && cart.items.length > 0 ? cart.items : []);

    if (sourceItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const productIds = sourceItems.map((item) => item.productId);
    const products = await QuickProduct.find({ _id: { $in: productIds }, ...approvedProductFilter }).lean();
    const productMap = products.reduce((acc, product) => {
      acc[String(product._id)] = product;
      return acc;
    }, {});

    let items = sourceItems
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
        const itemName = variant ? `${product.name} - ${variant.name}` : product.name;

        return {
          productId: product._id,
          variantId: variant ? variant._id : null,
          sellerId: product.sellerId || null,
          name: itemName,
          image: product.image || product.mainImage || '',
          price: unitPrice,
          quantity: item.quantity,
        };
      })
      .filter(Boolean);

    if (items.length === 0 && requestedItems.length > 0 && sourceItems !== requestedItems) {
      const fallbackProductIds = requestedItems.map((item) => item.productId);
      const fallbackProducts = await QuickProduct.find({
        _id: { $in: fallbackProductIds },
        ...approvedProductFilter,
      }).lean();
      const fallbackProductMap = fallbackProducts.reduce((acc, product) => {
        acc[String(product._id)] = product;
        return acc;
      }, {});

      items = requestedItems
        .map((item) => {
          const product = fallbackProductMap[String(item.productId)];
          if (!product) return null;

          let variant = null;
          if (item.variantId && Array.isArray(product.variants)) {
            variant = product.variants.find(v => String(v._id) === String(item.variantId) || String(v.id) === String(item.variantId));
          }

          const pSalePrice = variant && Number(variant.salePrice || 0) > 0 ? Number(variant.salePrice) : Number(product.salePrice || 0);
          const pPrice = variant ? Number(variant.price || 0) : Number(product.price || 0);
          const unitPrice = pSalePrice > 0 ? pSalePrice : pPrice;
          const itemName = variant ? `${product.name} - ${variant.name}` : product.name;

          return {
            productId: product._id,
            variantId: variant ? variant._id : null,
            sellerId: product.sellerId || null,
            name: itemName,
            image: product.image || product.mainImage || '',
            price: unitPrice,
            quantity: item.quantity,
          };
        })
        .filter(Boolean);
    }

    if (items.length === 0) {
      logger.warn(`Quick placeOrder: No valid items found for productIds: ${JSON.stringify(productIds)} using idQuery: ${JSON.stringify(idQuery)}`);
      return res.status(400).json({ success: false, message: 'No valid items found in cart' });
    }

    // Validate stock for all items
    for (const item of items) {
      const prodIdStr = String(item.productId);
      const product = products.find((p) => String(p._id) === prodIdStr) ||
        (typeof fallbackProducts !== 'undefined' ? fallbackProducts.find((p) => String(p._id) === prodIdStr) : null);
      if (product) {
        const availableStock = Number(product.stock ?? 0);
        if (item.quantity > availableStock) {
          return res.status(400).json({
            success: false,
            message: `Only ${availableStock} items are available in stock for ${product.name}.`,
          });
        }
      }
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = Math.max(0, Number(req.body?.discountTotal || 0));
    const deliveryAddress = normalizeDeliveryAddress(req.body?.address);

    // Calculate precise distance between seller and delivery address
    const firstProduct = products[0];
    const sellerId = firstProduct?.sellerId;
    const seller = sellerId ? await Seller.findById(sellerId).select('location').lean() : null;

    let distanceKm = 0.1; // Default fallback distance if coordinates are missing
    if (seller && deliveryAddress) {
      const sellerCoords = getSellerLocation(seller);
      const deliveryCoords = getOrderAddressPoint({ deliveryAddress });
      if (sellerCoords && deliveryCoords) {
        distanceKm = haversineKm(sellerCoords.lat, sellerCoords.lng, deliveryCoords.lat, deliveryCoords.lng);
      }
    }
    // NEW — server-side hard cap. Frontend check bypass ho sakta hai (Postman/DevTools se),
    // isliye backend pe bhi enforce karna zaroori hai. Ye sirf ek naya check hai,
    // baaki pricing/order-creation logic bilkul waisa hi hai.
    const MAX_QUICK_DELIVERY_DISTANCE_KM = 20;
    if (Number.isFinite(distanceKm) && distanceKm > MAX_QUICK_DELIVERY_DISTANCE_KM) {
      return res.status(400).json({
        success: false,
        message: `Delivery not available for this address — it is ${distanceKm.toFixed(1)} km away (maximum ${MAX_QUICK_DELIVERY_DISTANCE_KM} km allowed).`,
      });
    }

    const { pricing } = await calculateQuickPricing({
      subtotal,
      discount,
      products,
      distanceKm,
    });

    // --- SYNC FIX: Trust the frontend calculated exact fees if provided ---
    if (typeof req.body?.deliveryFee === 'number') pricing.deliveryFee = Math.max(0, req.body.deliveryFee);
    if (typeof req.body?.taxTotal === 'number') pricing.gst = Math.max(0, req.body.taxTotal);
    if (typeof req.body?.platformFee === 'number') pricing.platformFee = Math.max(0, req.body.platformFee);

    // Mongoose pricingSchema only has 'tax', not 'gst'. Map gst to tax so it gets saved.
    pricing.tax = pricing.gst;

    // Recalculate total with these synced values
    pricing.total = Math.max(0, subtotal + pricing.deliveryFee + pricing.platformFee + pricing.tax - discount);

    const deliveryFee = Number(pricing.deliveryFee || 0);
    const total = Number(pricing.total || 0);
    const orderNumber = `QC${Date.now().toString().slice(-8)}`;
    const isOnlinePayment = String(req.body?.paymentMode || 'COD').toUpperCase() === 'ONLINE';
    const paymentMode = isOnlinePayment ? 'razorpay' : 'cash';
    const sellerPaymentMode = isOnlinePayment ? 'online' : 'cash';
    // For online payment, do not fan out seller orders until payment succeeds
    const shouldFanOutSellerOrders = !isOnlinePayment;
    const initialOrderStatus = isOnlinePayment ? 'created' : 'placed';

    // Calculate rider earning using actual distance
    const riderEarning = await getQuickRiderEarning(distanceKm);

    let razorpayPayload = null;
    let razorpayData = {};
    if (isOnlinePayment) {
      if (isRazorpayConfigured()) {
        const amountPaise = Math.round(total * 100);
        if (amountPaise < 100) {
          return res.status(400).json({ success: false, message: 'Amount too low for online payment' });
        }
        try {
          const rzOrder = await createRazorpayOrder(amountPaise, 'INR', orderNumber);
          razorpayData = {
            orderId: rzOrder.id,
            paymentId: "",
            signature: "",
          };
          razorpayPayload = {
            key: getRazorpayKeyId(),
            orderId: rzOrder.id,
            amount: rzOrder.amount,
            currency: rzOrder.currency || "INR",
          };
        } catch (err) {
          logger.error(`Quick order Razorpay init failed for ${orderNumber}: ${err?.message || err}`);
          return res.status(400).json({ success: false, message: err?.message || 'Payment gateway error' });
        }
      }
    }

    const order = await QuickOrder.create({
      orderType: 'quick',
      orderId: orderNumber,
      restaurantId: sellerId,
      sessionId: idQuery.sessionId || '',
      userId: idQuery.userId || null,
      items: items.map((item) => ({
        itemId: String(item.productId),
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        type: 'quick',
        sourceId: String(item.sellerId || item.productId),
        sourceName: '',
      })),
      pricing: {
        ...pricing,
        subtotal,
        total,
      },
      deliveryAddress,
      timeSlot: req.body?.timeSlot || 'now',
      payment: {
        method: paymentMode,
        status: paymentMode === 'razorpay' ? 'created' : 'cod_pending',
        amountDue: Math.max(0, total),  // total already includes platformFee
        razorpay: razorpayData,
      },
      orderStatus: initialOrderStatus,
      note: String(req.body?.note || req.body?.deliveryNote || req.body?.deliveryInstruction || '').trim(),
      riderEarning: riderEarning || 0,
      platformProfit: Math.max(
        0,
        deliveryFee + Number(pricing.platformFee || 0) - (riderEarning || 0),
      ), // Initial guess, will be updated with commission
      statusHistory: [
        {
          byRole: 'SYSTEM',
          from: '',
          to: initialOrderStatus,
          note: isOnlinePayment ? 'Quick commerce order created' : 'Quick commerce order placed',
        },
      ],
    });

    // Decrement stock for each item in the order
    for (const item of items) {
      await QuickProduct.updateOne(
        { _id: item.productId },
        { $inc: { stock: -item.quantity } }
      );
    }

    const sellerBuckets = new Map();
    items.forEach((item) => {
      const sellerId = item.sellerId ? String(item.sellerId) : '';
      if (!sellerId) return;
      if (!sellerBuckets.has(sellerId)) sellerBuckets.set(sellerId, []);
      sellerBuckets.get(sellerId).push(item);
    });

    const sellerOrdersResults = sellerBuckets.size > 0
      ? await Promise.all(Array.from(sellerBuckets.entries()).map(async ([sellerId, sellerItems]) => {
        const sellerSubtotal = sellerItems.reduce(
          (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
          0,
        );
        const allocatedDeliveryFee = Number(
          ((deliveryFee * sellerSubtotal) / Math.max(subtotal, 1)).toFixed(2),
        );

        // Calculate commission for this specific seller
        const { commissionAmount } = await getSellerCommissionSnapshot(sellerId, sellerSubtotal);
        const sellerReceivable = Math.max(
          0,
          Number((sellerSubtotal - commissionAmount).toFixed(2)),
        );

        return {
          orderType: 'quick',
          parentOrderId: order._id,
          sellerId,
          orderId: order.orderId,
          customer: {
            name: String(req.body?.address?.name || 'Customer').trim() || 'Customer',
            phone: String(req.body?.address?.phone || '').trim(),
          },
          items: sellerItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
          })),
          pricing: {
            subtotal: sellerSubtotal,
            commission: commissionAmount,
            total: sellerSubtotal + allocatedDeliveryFee,
            receivable: sellerReceivable,
          },
          status: 'pending',
          workflowStatus: 'SELLER_PENDING',
          sellerPendingExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
          address: {
            address: deliveryAddress?.street || '',
            city: deliveryAddress?.city || '',
            ...(Array.isArray(deliveryAddress?.location?.coordinates)
              ? {
                location: {
                  lat: deliveryAddress.location.coordinates[1],
                  lng: deliveryAddress.location.coordinates[0],
                },
              }
              : {}),
          },
          payment: {
            method: sellerPaymentMode,
          },
        };
      }))
      : [];

    const totalSellerCommission = sellerOrdersResults.reduce((sum, so) => sum + (so.pricing?.commission || 0), 0);

    // Update the main order with the total commission
    if (totalSellerCommission > 0) {
      const platformProfit = Math.max(
        0,
        deliveryFee +
        Number(pricing.platformFee || 0) +
        totalSellerCommission -
        (riderEarning || 0),
      );
      await QuickOrder.updateOne(
        { _id: order._id },
        {
          $set: {
            'pricing.restaurantCommission': totalSellerCommission,
            platformProfit: platformProfit
          }
        }
      );
      order.pricing.restaurantCommission = totalSellerCommission;
      order.platformProfit = platformProfit;
    }

    const sellerOrders = sellerOrdersResults;

    await QuickCart.findOneAndUpdate(idQuery, { $set: { items: [] } }, { upsert: false });

    emitQuickOrderStatusUpdate(order, 'Quick order placed successfully.');

    if (shouldFanOutSellerOrders) {
      void (async () => {
        try {
          if (!sellerOrders.length) return;
          // Idempotent upsert: protects against retries / duplicate placeOrder submissions.
          const upserts = await Promise.all(
            sellerOrders.map((doc) =>
              SellerOrder.findOneAndUpdate(
                { sellerId: doc.sellerId, orderId: doc.orderId },
                { $set: doc },
                { upsert: true, new: true, setDefaultsOnInsert: true },
              ),
            ),
          );
          emitQuickSellerOrders(upserts.filter(Boolean));
        } catch (error) {
          logger.error(`Quick seller order fanout failed for ${order.orderId}: ${error?.message || error}`);
        }
      })();
    }

    if (!isOnlinePayment) {
      // COD: send WhatsApp after successful order creation
      try {
        const mobile = String(order.deliveryAddress?.phone || '').trim();
        if (mobile) {
          const customerName = String(req.body?.address?.name || 'Customer').trim() || 'Customer';
          const itemsStr = order.items.map(i => `${i.name || i.productName} x${i.quantity}`).join(', ');
          const totalAmount = getOrderPayableAmount(order);
          logger.info(`[WhatsApp] Sending COD confirmation to ${mobile} for quick order ${order.orderId}`);
          sendWhatsAppTemplate(mobile, customerName, order.orderId, itemsStr, totalAmount, 'COD').catch(err => {
            logger.error(`[WhatsApp] COD send failed for quick order ${order.orderId}: ${err.message}`);
          });
        } else {
          logger.warn(`[WhatsApp] Skipped COD notification for ${order.orderId}: no phone in deliveryAddress`);
        }
      } catch (waErr) {
        logger.error(`[WhatsApp] COD trigger error for quick order ${order.orderId}: ${waErr.message}`);
      }
    }

    return res.status(201).json({
      success: true,
      result: {
        id: order._id,
        _id: order._id,
        orderId: order.orderId,
        orderNumber: order.orderId,
        total: getOrderPayableAmount(order),
        totalAmount: getOrderPayableAmount(order),
        payableAmount: getOrderPayableAmount(order),
        amount: getOrderPayableAmount(order),
        status: order.orderStatus,
        orderStatus: order.orderStatus,
        paymentMethod: order.payment?.method || paymentMode,
        paymentStatus: order.payment?.status || '',
        pricing: order.pricing || {},
        createdAt: order.createdAt,
      },
      razorpay: razorpayPayload,
    });
  } catch (error) {
    logger.error(`Quick placeOrder failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to place quick order',
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const idQuery = resolveId(req);

    if (!idQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const orders = await QuickOrder.find({ ...idQuery, orderType: 'quick' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Estimate total results based on this chunk to avoid slow countDocuments queries
    const hasMore = orders.length === limit;
    const totalResults = skip + orders.length + (hasMore ? 1 : 0);

    const sellerIds = [
      ...new Set(
        orders
          .map((order) =>
            String(order?.items?.find((item) => item?.type === 'quick')?.sourceId || order?.items?.[0]?.sourceId || '').trim(),
          )
          .filter((value) => mongoose.Types.ObjectId.isValid(value)),
      ),
    ];

    const sellers = sellerIds.length
      ? await Seller.find({ _id: { $in: sellerIds } }).select('_id name shopName').lean()
      : [];
    const sellerMap = sellers.reduce((acc, seller) => {
      acc[String(seller._id)] = seller;
      return acc;
    }, {});

    const mappedOrders = orders.map((order) => {
      const normalized = normalizeOrderSummary(order);
      const sellerId = String(
        order?.items?.find((item) => item?.type === 'quick')?.sourceId || order?.items?.[0]?.sourceId || '',
      ).trim();
      const seller = sellerMap[sellerId] || null;

      return {
        ...normalized,
        sellerId: seller?._id || null,
        storeName: seller?.shopName || seller?.name || '',
        seller: seller
          ? {
            _id: seller._id,
            name: seller.name || '',
            shopName: seller.shopName || seller.name || 'Store',
          }
          : null,
      };
    });

    return res.json({
      success: true,
      result: mappedOrders,
      results: mappedOrders,
      page,
      limit,
      totalPages: Math.ceil(totalResults / limit),
      totalResults,
    });
  } catch (error) {
    console.error('[getMyOrders] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const idQuery = resolveId(req);

    if (!idQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const rawOrderId = String(req.params.orderId || '').trim();
    if (!rawOrderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const orderIdentityQuery = [{ orderId: rawOrderId }];
    if (mongoose.isValidObjectId(rawOrderId)) {
      orderIdentityQuery.unshift({ _id: rawOrderId });
    }

    const query = {
      ...idQuery,
      orderType: 'quick',
      $or: orderIdentityQuery,
    };

    const order = await QuickOrder.findOne(query)
      .select('+deliveryOtp')
      .populate('dispatch.deliveryPartnerId', 'name phone email profilePhoto rating totalRatings')
      .populate('dispatchPlan.legs.deliveryPartnerId', 'name phone email profilePhoto rating totalRatings')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const sellerOrder = await SellerOrder.findOne({ orderId: order.orderId }).lean();
    const seller =
      sellerOrder?.sellerId
        ? await Seller.findById(sellerOrder.sellerId).select('_id name shopName location phone').lean()
        : null;

    const deliveryAddress = order.deliveryAddress || {};
    const deliveryCoords = Array.isArray(deliveryAddress.location?.coordinates)
      ? {
        lat: Number(deliveryAddress.location.coordinates[1]),
        lng: Number(deliveryAddress.location.coordinates[0]),
      }
      : null;
    const dropOtp = order.deliveryVerification?.dropOtp || {};
    const handoverOtp = String(order.deliveryOtp || '').trim();

    return res.json({
      success: true,
      result: {
        ...order,
        id: order._id,
        _id: order._id,
        orderNumber: order.orderId,
        orderId: order.orderId,
        address: {
          type: deliveryAddress.label || 'Other',
          name: deliveryAddress.name || order.userName || '',
          address: deliveryAddress.street || '',
          city: deliveryAddress.city || '',
          phone: deliveryAddress.phone || '',
          ...(deliveryCoords ? { location: deliveryCoords } : {}),
        },
        seller: seller
          ? {
            _id: seller._id,
            id: seller._id,
            name: seller.shopName || seller.name || 'Store',
            shopName: seller.shopName || seller.name || 'Store',
            location: seller.location || null,
            phone: seller.phone || '',
          }
          : null,
        sellerOrder: sellerOrder
          ? {
            _id: sellerOrder._id,
            status: sellerOrder.status,
            workflowStatus: sellerOrder.workflowStatus,
            address: sellerOrder.address || null,
          }
          : null,
        deliveryVerification: {
          ...(order.deliveryVerification || {}),
          dropOtp: {
            required: Boolean(dropOtp.required),
            verified: Boolean(dropOtp.verified),
          },
        },
        ...(dropOtp.required && !dropOtp.verified && handoverOtp
          ? { handoverOtp }
          : {}),
      },
    });
  } catch (error) {
    logger.error(`Quick getOrderById failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load quick order',
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const idQuery = resolveId(req);

    if (!idQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const rawOrderId = String(req.params.orderId || '').trim();
    if (!rawOrderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const orderIdentityQuery = [{ orderId: rawOrderId }];
    if (mongoose.isValidObjectId(rawOrderId)) {
      orderIdentityQuery.unshift({ _id: rawOrderId });
    }

    const query = {
      ...idQuery,
      orderType: 'quick',
      $or: orderIdentityQuery,
    };

    const order = await QuickOrder.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const currentStatus = String(order.orderStatus || '').toLowerCase();
    if (['delivered', 'cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin'].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: currentStatus === 'delivered' ? 'Delivered orders cannot be cancelled' : 'Order is already cancelled',
      });
    }

    const isOnlinePayment = String(order.payment?.method || '').toLowerCase() === 'razorpay' ||
      String(order.payment?.method || '').toLowerCase() === 'razorpay_qr';
    const isWalletPayment = String(order.payment?.method || '').toLowerCase() === 'wallet';
    const isPaid = String(order.payment?.status || '').toLowerCase() === 'paid';

    const isOnlinePaid = isOnlinePayment && isPaid;
    const isWalletPaid = isWalletPayment && isPaid;

    const refundTo = req.body?.refundTo || 'gateway';
    const requestedRefundMethod = refundTo === 'wallet' || refundTo === 'gateway' ? refundTo : 'gateway';

    if (isOnlinePaid) {
      order.payment.refund = {
        ...(order.payment.refund || {}),
        status: 'pending',
        amount: Number(order.pricing?.total || 0),
        refundId: '',
        requestedMethod: requestedRefundMethod,
        processedMethod: undefined,
        requestedAt: new Date(),
        requestedByUser: true,
        reason: String(req.body?.reason || 'Quick commerce order cancelled by user').trim(),
        processedAt: null,
      };
    } else if (isWalletPaid) {
      order.payment.refund = {
        ...(order.payment.refund || {}),
        status: 'pending',
        amount: Number(order.pricing?.total || 0),
        refundId: '',
        requestedMethod: 'wallet',
        processedMethod: undefined,
        requestedAt: new Date(),
        requestedByUser: true,
        reason: String(req.body?.reason || 'Quick commerce order cancelled by user').trim(),
        processedAt: null,
      };
    } else if (!['paid', 'refunded'].includes(order.payment.status)) {
      order.payment.status = 'cancelled';
    }

    order.orderStatus = 'cancelled_by_user';
    order.workflowStatus = 'CANCELLED';
    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    order.statusHistory.push({
      byRole: 'USER',
      from: currentStatus || '',
      to: 'cancelled_by_user',
      note: String(req.body?.reason || 'Quick commerce order cancelled by user').trim(),
    });

    if (isOnlinePaid) {
      try {
        await autoRefundForCancelledOrder(order, requestedRefundMethod);
      } catch (err) {
        logger.error(`[QuickcancelOrder] Auto-refund error for Order ${order.orderId}: ${err?.message || err}`);
      }
    } else if (isWalletPaid) {
      try {
        await autoRefundForCancelledOrder(order, 'wallet');
      } catch (err) {
        logger.error(`[QuickcancelOrder] Wallet auto-refund error for Order ${order.orderId}: ${err?.message || err}`);
      }
    }

    if (order.payment?.method === 'cash') {
      order.payment.status = 'failed';
    }

    await order.save();

    // Increment stock back for each order item upon cancellation
    for (const item of order.items) {
      if (item.itemId) {
        await QuickProduct.updateOne(
          { _id: item.itemId },
          { $inc: { stock: item.quantity } }
        );
      }
    }

    await SellerOrder.updateMany(
      {
        orderId: order.orderId,
        status: { $nin: ['cancelled', 'delivered'] },
      },
      {
        $set: {
          status: 'cancelled',
          workflowStatus: 'CANCELLED',
        },
      },
    );

    emitQuickOrderStatusUpdate(order, 'Quick order cancelled successfully.');

    return res.json({
      success: true,
      result: {
        id: order._id,
        _id: order._id,
        orderId: order.orderId,
        orderNumber: order.orderId,
        status: order.orderStatus,
      },
    });
  } catch (error) {
    logger.error(`Quick cancelOrder failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to cancel quick order',
    });
  }
};


export const verifyPayment = async (req, res) => {
  try {
    const idQuery = resolveId(req);
    if (!idQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const rawOrderId = String(req.body?.orderId || '').trim();
    if (!rawOrderId) {
      return res.status(400).json({ success: false, message: 'Order id required' });
    }

    const orderIdentityQuery = [{ orderId: rawOrderId }];
    if (mongoose.isValidObjectId(rawOrderId)) {
      orderIdentityQuery.unshift({ _id: rawOrderId });
    }

    const query = {
      orderType: 'quick',
      ...idQuery,
      $or: orderIdentityQuery,
    };

    const order = await QuickOrder.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // If order has userId, delegate to the food verifyPayment service
    if (order.userId) {
      const result = await verifyFoodPayment(order.userId.toString(), req.body);
      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        result,
      });
    }

    // If guest order (no userId), verify directly
    if (order.payment.status === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        result: { order, payment: order.payment },
      });
    }

    const { verifyPaymentSignature } = await import('../../food/orders/helpers/razorpay.helper.js');
    const valid = verifyPaymentSignature(
      req.body.razorpayOrderId,
      req.body.razorpayPaymentId,
      req.body.razorpaySignature
    );

    if (!valid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const fromStatus = order.orderStatus;
    if (order.orderStatus === 'created') {
      order.orderStatus = 'placed';
    }

    order.payment.status = 'paid';
    if (!order.payment.razorpay) {
      order.payment.razorpay = {};
    }
    order.payment.razorpay.paymentId = req.body.razorpayPaymentId;
    order.payment.razorpay.signature = req.body.razorpaySignature;

    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    order.statusHistory.push({
      byRole: 'USER',
      from: fromStatus,
      to: order.orderStatus === 'scheduled' ? 'scheduled' : 'placed',
      note: 'Payment verified',
    });

    await order.save();

    try {
      const { updateTransactionStatus } = await import('../../food/orders/services/foodTransaction.service.js');
      await updateTransactionStatus(order._id, 'captured', {
        status: 'captured',
        razorpayPaymentId: req.body.razorpayPaymentId,
        razorpaySignature: req.body.razorpaySignature,
        recordedByRole: 'USER',
      });
    } catch (txErr) {
      logger.error(`Quick verifyPayment transaction status update failed: ${txErr.message}`);
    }

    try {
      const { upsertSellerOrdersForParent, notifySellerNewOrders } = await import('../../food/orders/services/order.service.js');
      const sellerOrders = await upsertSellerOrdersForParent(order);
      await notifySellerNewOrders(order, sellerOrders);
    } catch (fanoutErr) {
      logger.error(`Quick guest verifyPayment fanout/notification failed: ${fanoutErr.message}`);
    }

    // Online payment verified: send WhatsApp confirmation
    try {
      const mobile = String(order.deliveryAddress?.phone || '').trim();
      if (mobile) {
        const customerName = 'Customer';
        const itemsStr = order.items.map(i => `${i.name || i.productName} x${i.quantity}`).join(', ');
        const totalAmount = getOrderPayableAmount(order);
        logger.info(`[WhatsApp] Sending Online confirmation to ${mobile} for quick order ${order.orderId}`);
        sendWhatsAppTemplate(mobile, customerName, order.orderId, itemsStr, totalAmount, 'Online').catch(err => {
          logger.error(`[WhatsApp] Online send failed for quick order ${order.orderId}: ${err.message}`);
        });
      } else {
        logger.warn(`[WhatsApp] Skipped Online notification for ${order.orderId}: no phone in deliveryAddress`);
      }
    } catch (waErr) {
      logger.error(`[WhatsApp] Online trigger error for quick order ${order.orderId}: ${waErr.message}`);
    }
    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      result: { order, payment: order.payment },
    });
  } catch (error) {
    logger.error(`Quick verifyPayment failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to verify payment',
    });
  }
};

