/**
 * Quick Commerce Return Orders — Service Layer
 *
 * Completely isolated from existing order/payment flows.
 * Uses QuickReturnOrder (new collection) + reads from FoodOrder (QuickOrder alias) + wallet service.
 */

import mongoose from 'mongoose';
import { QuickReturnOrder } from '../models/quickReturnOrder.model.js';
import { QuickReturnSettings } from '../models/quickReturnSettings.model.js';
import { QuickOrder } from '../../models/order.model.js';
import { Seller } from '../../seller/models/seller.model.js';
import { FoodDeliveryPartner } from '../../../food/delivery/models/deliveryPartner.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { creditWallet } from '../../../../core/payments/wallet.service.js';
import { logger } from '../../../../utils/logger.js';
import { SellerTransaction } from '../../seller/models/sellerTransaction.model.js';
import { getRiderEarning } from '../../admin/services/billing.service.js';
import { haversineKm } from '../../../food/orders/services/order.helpers.js';

const generateOtp = () =>
  String(Math.floor(1000 + Math.random() * 9000));

// ────────────────────────────────────────────────────────────────────────────
// Settings
// ────────────────────────────────────────────────────────────────────────────

export const getReturnSettings = async () => {
  let doc = await QuickReturnSettings.findOne({ key: 'global' }).lean();
  if (!doc) {
    doc = await QuickReturnSettings.create({ key: 'global' });
  }
  return doc;
};

export const updateReturnSettings = async (data, adminId = null) => {
  const patch = {};
  if (data.returnWindowDays !== undefined) {
    patch.returnWindowDays = Math.max(1, Math.min(90, Number(data.returnWindowDays) || 7));
  }
  if (data.isReturnEnabled !== undefined) {
    patch.isReturnEnabled = Boolean(data.isReturnEnabled);
  }
  if (adminId) patch.updatedByAdminId = adminId;

  return QuickReturnSettings.findOneAndUpdate(
    { key: 'global' },
    { $set: patch },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
};

// ────────────────────────────────────────────────────────────────────────────
// Eligibility Check
// ────────────────────────────────────────────────────────────────────────────

export const checkReturnEligibility = async (orderId, userId, sessionId) => {
  const settings = await getReturnSettings();
  if (!settings.isReturnEnabled) {
    return { eligible: false, reason: 'Returns are currently disabled.' };
  }

  // Find the original order
  const order = await QuickOrder.findOne({
    orderId,
    orderType: { $in: ['quick', 'mixed'] },
  }).lean();

  if (!order) {
    return { eligible: false, reason: 'Order not found.' };
  }

  // Verify ownership
  if (userId && String(order.userId || '') !== String(userId)) {
    return { eligible: false, reason: 'Order does not belong to this account.' };
  }
  if (!userId && sessionId && order.sessionId && order.sessionId !== sessionId) {
    return { eligible: false, reason: 'Order does not belong to this session.' };
  }

  // Must be delivered
  if (order.orderStatus !== 'delivered') {
    return { eligible: false, reason: 'Only delivered orders can be returned.' };
  }

  // Check return window
  const deliveredAt = order.deliveryState?.deliveredAt || order.updatedAt;
  const windowMs = settings.returnWindowDays * 24 * 60 * 60 * 1000;
  if (Date.now() - new Date(deliveredAt).getTime() > windowMs) {
    return {
      eligible: false,
      reason: `Return window of ${settings.returnWindowDays} days has passed.`,
    };
  }

  // Check if already returned
  const existing = await QuickReturnOrder.findOne({ orderId, status: { $ne: 'rejected' } }).lean();
  if (existing) {
    return { eligible: false, reason: 'A return request already exists for this order.', returnId: String(existing._id) };
  }

  return { eligible: true, order, settings };
};

// ────────────────────────────────────────────────────────────────────────────
// Create Return Request (User)
// ────────────────────────────────────────────────────────────────────────────

export const createReturnRequest = async ({
  orderId,
  userId,
  sessionId,
  reason,
  proofImageUrl,
  refundMethod,
  bankDetails,
}) => {
  const eligibility = await checkReturnEligibility(orderId, userId, sessionId);
  if (!eligibility.eligible) {
    const err = new Error(eligibility.reason);
    err.statusCode = 400;
    throw err;
  }

  const { order, settings } = eligibility;

  // Resolve seller from items
  const quickItems = Array.isArray(order.items)
    ? order.items.filter((i) => i.type === 'quick')
    : [];
  const sellerIdStr = quickItems[0]?.sourceId || null;
  const sellerId = mongoose.isValidObjectId(String(sellerIdStr || ''))
    ? new mongoose.Types.ObjectId(String(sellerIdStr))
    : null;

  // Resolve seller address
  let sellerAddress = { shopName: '', address: '', location: { lat: null, lng: null } };
  if (sellerId) {
    const seller = await Seller.findById(sellerId).select('shopName location').lean();
    if (seller) {
      let lat = null;
      let lng = null;
      if (Array.isArray(seller.location?.coordinates) && seller.location.coordinates.length === 2) {
        lat = Number(seller.location.coordinates[1]);
        lng = Number(seller.location.coordinates[0]);
      } else if (Number.isFinite(Number(seller.location?.lat)) && Number.isFinite(Number(seller.location?.lng))) {
        lat = Number(seller.location.lat);
        lng = Number(seller.location.lng);
      } else if (Number.isFinite(Number(seller.location?.latitude)) && Number.isFinite(Number(seller.location?.longitude))) {
        lat = Number(seller.location.latitude);
        lng = Number(seller.location.longitude);
      }
      sellerAddress = {
        shopName: seller.shopName || '',
        address: seller.location?.formattedAddress || seller.location?.address || '',
        location: { lat, lng },
      };
    }
  }

  // Customer address snapshot
  const addr = order.deliveryAddress || {};
  const coords = addr.location?.coordinates;
  let custLat = null;
  let custLng = null;
  if (Array.isArray(coords) && coords.length === 2) {
    custLat = Number(coords[1]);
    custLng = Number(coords[0]);
  } else if (addr.location && Number.isFinite(Number(addr.location.lat)) && Number.isFinite(Number(addr.location.lng))) {
    custLat = Number(addr.location.lat);
    custLng = Number(addr.location.lng);
  }
  const customerAddress = {
    street: [addr.street, addr.additionalDetails].filter(Boolean).join(', '),
    city: addr.city || '',
    state: addr.state || '',
    phone: addr.phone || '',
    location: {
      lat: custLat,
      lng: custLng,
    },
  };

  // Return items from original order
  const returnItems = quickItems.map((item) => ({
    productId: item.itemId || '',
    name: item.name || 'Item',
    quantity: Number(item.quantity || 1),
    price: Number(item.price || 0),
    image: item.image || '',
  }));

  const refundAmount = returnItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const doc = await QuickReturnOrder.create({
    orderId,
    parentOrderMongoId: order._id,
    userId: userId || null,
    sessionId: sessionId || '',
    sellerId,
    returnItems,
    reason,
    proofImageUrl: proofImageUrl || '',
    refundMethod: refundMethod || 'wallet',
    bankDetails: refundMethod === 'bank_account' ? bankDetails : undefined,
    refundAmount,
    customerAddress,
    sellerAddress,
    returnWindowDays: settings.returnWindowDays,
  });

  return doc;
};

// ────────────────────────────────────────────────────────────────────────────
// Admin: List + Detail
// ────────────────────────────────────────────────────────────────────────────

export const getAdminReturns = async ({ status, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status && status !== 'all') filter.status = status;

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    QuickReturnOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'name phone email')
      .populate('sellerId', 'shopName name')
      .populate('deliveryPartnerId', 'name phone')
      .lean(),
    QuickReturnOrder.countDocuments(filter),
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
};

export const getAdminReturnById = async (returnId) => {
  const doc = await QuickReturnOrder.findById(returnId)
    .populate('userId', 'name phone email')
    .populate('sellerId', 'shopName name location')
    .populate('deliveryPartnerId', 'name phone lastLat lastLng')
    .lean();
  if (!doc) {
    const err = new Error('Return order not found.');
    err.statusCode = 404;
    throw err;
  }
  return doc;
};

// ────────────────────────────────────────────────────────────────────────────
// Admin: Approve Return
// ────────────────────────────────────────────────────────────────────────────

export const approveReturnRequest = async (returnId, adminId, partnerId) => {
  const ret = await QuickReturnOrder.findById(returnId);
  if (!ret) {
    const err = new Error('Return order not found.');
    err.statusCode = 404;
    throw err;
  }
  if (ret.status !== 'pending_review') {
    const err = new Error(`Cannot approve a return in '${ret.status}' status.`);
    err.statusCode = 400;
    throw err;
  }

  // Validate partner if provided
  if (partnerId && !mongoose.isValidObjectId(String(partnerId))) {
    const err = new Error('Invalid delivery partner ID.');
    err.statusCode = 400;
    throw err;
  }

  const otp = generateOtp();
  const sellerOtp = generateOtp();
  const newStatus = partnerId ? 'pickup_assigned' : 'approved';

  ret.status = newStatus;
  ret.reviewedByAdminId = adminId;
  ret.reviewedAt = new Date();
  ret.pickupOtp = otp;
  ret.sellerDeliveryOtp = sellerOtp;
  if (partnerId) {
    ret.deliveryPartnerId = new mongoose.Types.ObjectId(String(partnerId));
    ret.assignedAt = new Date();

    // Pre-calculate rider earning at assignment so partner can see it immediately
    try {
      const lat1 = ret.customerAddress?.location?.lat;
      const lon1 = ret.customerAddress?.location?.lng;
      const lat2 = ret.sellerAddress?.location?.lat;
      const lon2 = ret.sellerAddress?.location?.lng;
      if (lat1 != null && lon1 != null && lat2 != null && lon2 != null) {
        const distKm = haversineKm(Number(lat1), Number(lon1), Number(lat2), Number(lon2));
        ret.riderEarning = await getRiderEarning(distKm);
      }
    } catch (calcErr) {
      logger.warn(`[Return] Could not pre-calculate rider earning on approve: ${calcErr.message}`);
    }
  }

  await ret.save();
  logger.info(`[Return] Approved returnId=${returnId} by adminId=${adminId}, partner=${partnerId || 'unassigned'}, preCalcEarning=${ret.riderEarning || 0}`);

  return { ...ret.toObject(), pickupOtp: otp, sellerDeliveryOtp: sellerOtp }; // expose OTP once on approve
};

// ────────────────────────────────────────────────────────────────────────────
// Admin: Reject Return
// ────────────────────────────────────────────────────────────────────────────

export const rejectReturnRequest = async (returnId, adminId, reason) => {
  const ret = await QuickReturnOrder.findById(returnId);
  if (!ret) {
    const err = new Error('Return order not found.');
    err.statusCode = 404;
    throw err;
  }
  if (!['pending_review', 'approved'].includes(ret.status)) {
    const err = new Error(`Cannot reject a return in '${ret.status}' status.`);
    err.statusCode = 400;
    throw err;
  }

  ret.status = 'rejected';
  ret.rejectionReason = reason || 'Rejected by admin.';
  ret.reviewedByAdminId = adminId;
  ret.reviewedAt = new Date();
  await ret.save();

  logger.info(`[Return] Rejected returnId=${returnId} by adminId=${adminId}`);
  return ret.toObject();
};

// ────────────────────────────────────────────────────────────────────────────
// Admin: Assign Partner
// ────────────────────────────────────────────────────────────────────────────

export const assignPickupPartner = async (returnId, partnerId) => {
  if (!mongoose.isValidObjectId(String(partnerId || ''))) {
    const err = new Error('Invalid delivery partner ID.');
    err.statusCode = 400;
    throw err;
  }

  const ret = await QuickReturnOrder.findOne({
    _id: returnId,
    status: { $in: ['approved', 'pickup_assigned'] },
  });
  if (!ret) {
    const err = new Error('Return order not found or not in assignable state.');
    err.statusCode = 404;
    throw err;
  }

  // Generate OTP if not already set
  if (!ret.pickupOtp) {
    ret.pickupOtp = generateOtp();
  }
  if (!ret.sellerDeliveryOtp) {
    ret.sellerDeliveryOtp = generateOtp();
  }

  ret.deliveryPartnerId = new mongoose.Types.ObjectId(String(partnerId));
  ret.assignedAt = new Date();
  ret.status = 'pickup_assigned';

  // Pre-calculate rider earning at assignment time so partner can see it immediately in the app
  try {
    const lat1 = ret.customerAddress?.location?.lat;
    const lon1 = ret.customerAddress?.location?.lng;
    const lat2 = ret.sellerAddress?.location?.lat;
    const lon2 = ret.sellerAddress?.location?.lng;
    if (lat1 != null && lon1 != null && lat2 != null && lon2 != null) {
      const distKm = haversineKm(Number(lat1), Number(lon1), Number(lat2), Number(lon2));
      ret.riderEarning = await getRiderEarning(distKm);
    }
  } catch (calcErr) {
    logger.warn(`[Return] Could not pre-calculate rider earning on assign: ${calcErr.message}`);
  }

  await ret.save();
  logger.info(`[Return] Partner assigned returnId=${returnId}, partnerId=${partnerId}, preCalcEarning=${ret.riderEarning || 0}`);

  return ret.toObject();
};

// ────────────────────────────────────────────────────────────────────────────
// Delivery Partner: List assigned pickups
// ────────────────────────────────────────────────────────────────────────────

export const getPartnerPickups = async (partnerId) => {
  const items = await QuickReturnOrder.find({
    deliveryPartnerId: new mongoose.Types.ObjectId(String(partnerId)),
    status: { $in: ['pickup_assigned', 'picked_up'] },
  })
    .sort({ assignedAt: -1 })
    .populate('userId', 'name phone')
    .populate('sellerId', 'shopName name location')
    .lean();

  return items;
};

// ────────────────────────────────────────────────────────────────────────────
// Delivery Partner: Verify OTP (pickup from customer)
// ────────────────────────────────────────────────────────────────────────────

export const verifyPickupOtp = async (returnId, partnerId, otp) => {
  const ret = await QuickReturnOrder.findOne({
    _id: returnId,
    deliveryPartnerId: new mongoose.Types.ObjectId(String(partnerId)),
    status: 'pickup_assigned',
  }).select('+pickupOtp');

  if (!ret) {
    const err = new Error('Return order not found or not assigned to you.');
    err.statusCode = 404;
    throw err;
  }

  if (ret.otpVerified) {
    return { verified: true, message: 'OTP already verified.' };
  }

  if (!ret.pickupOtp || ret.pickupOtp !== String(otp || '').trim()) {
    const err = new Error('Invalid OTP. Please try again.');
    err.statusCode = 400;
    throw err;
  }

  ret.otpVerified = true;
  await ret.save();
  return { verified: true };
};

// ────────────────────────────────────────────────────────────────────────────
// Delivery Partner: Confirm pickup (upload proof + mark picked_up)
// ────────────────────────────────────────────────────────────────────────────

export const confirmPickup = async (returnId, partnerId, pickupProofImageUrl) => {
  const ret = await QuickReturnOrder.findOne({
    _id: returnId,
    deliveryPartnerId: new mongoose.Types.ObjectId(String(partnerId)),
    status: 'pickup_assigned',
    otpVerified: true,
  });

  if (!ret) {
    const err = new Error('Return order not found or OTP not yet verified.');
    err.statusCode = 404;
    throw err;
  }

  if (!pickupProofImageUrl) {
    const err = new Error('Pickup proof image is required.');
    err.statusCode = 400;
    throw err;
  }

  ret.pickupProofImageUrl = pickupProofImageUrl;
  ret.pickedUpAt = new Date();
  ret.status = 'picked_up';
  ret.pickupOtp = ''; // Clear OTP upon successful pickup completion
  await ret.save();

  logger.info(`[Return] Picked up returnId=${returnId} by partnerId=${partnerId}`);
  return ret.toObject();
};

// ────────────────────────────────────────────────────────────────────────────
// Delivery Partner: Mark delivered to seller
// ────────────────────────────────────────────────────────────────────────────

export const markDeliveredToSeller = async (returnId, partnerId, sellerOtp) => {
  const ret = await QuickReturnOrder.findOne({
    _id: returnId,
    deliveryPartnerId: new mongoose.Types.ObjectId(String(partnerId)),
    status: 'picked_up',
  }).select('+sellerDeliveryOtp');

  if (!ret) {
    const err = new Error('Return order not found or not yet picked up.');
    err.statusCode = 404;
    throw err;
  }

  if (!sellerOtp || String(sellerOtp).trim() !== String(ret.sellerDeliveryOtp || '').trim()) {
    const err = new Error('Invalid Seller Delivery OTP.');
    err.statusCode = 400;
    throw err;
  }

  ret.sellerOtpVerified = true;
  ret.status = 'delivered_to_seller';
  ret.sellerConfirmedAt = new Date();
  ret.sellerDeliveryOtp = ''; // Clear OTP once verified
  await ret.save();

  logger.info(`[Return] Seller OTP verified and marked delivered to seller. returnId=${returnId} by partnerId=${partnerId}`);

  // Automatically trigger refund processing immediately on successful seller OTP verification!
  processReturnRefund(String(ret._id)).catch((err) => {
    logger.error(`[Return] Auto-refund failed for returnId=${returnId}: ${err.message}`);
  });

  return ret.toObject();
};

// ────────────────────────────────────────────────────────────────────────────
// Seller: List returns for their store
// ────────────────────────────────────────────────────────────────────────────

export const getSellerReturns = async (sellerId, { status, page = 1, limit = 20 } = {}) => {
  const filter = { sellerId: new mongoose.Types.ObjectId(String(sellerId)) };
  if (status && status !== 'all') filter.status = status;

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    QuickReturnOrder.find(filter)
      .select('+sellerDeliveryOtp')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'name phone')
      .lean(),
    QuickReturnOrder.countDocuments(filter),
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
};

/**
 * Returns the count of pending return requests for a seller.
 * Counts returns where the seller still needs to act:
 *   - approved / pickup_assigned → item coming back
 *   - delivered_to_seller → seller needs to confirm receipt
 */
export const getSellerPendingReturnCount = async (sellerId) => {
  const count = await QuickReturnOrder.countDocuments({
    sellerId: new mongoose.Types.ObjectId(String(sellerId)),
    status: { $in: ['approved', 'pickup_assigned', 'delivered_to_seller', 'pending_review'] },
  });
  return count;
};

// ────────────────────────────────────────────────────────────────────────────
// Seller: Confirm receipt → triggers refund
// ────────────────────────────────────────────────────────────────────────────

export const sellerConfirmReceipt = async (returnId, sellerId) => {
  const ret = await QuickReturnOrder.findOne({
    _id: returnId,
    sellerId: new mongoose.Types.ObjectId(String(sellerId)),
    status: 'delivered_to_seller',
  });

  if (!ret) {
    const err = new Error('Return order not found or not yet delivered to seller.');
    err.statusCode = 404;
    throw err;
  }

  ret.sellerConfirmedAt = new Date();
  await ret.save();

  // Trigger refund (non-blocking; log error if fails)
  processReturnRefund(String(ret._id)).catch((err) => {
    logger.error(`[Return] Refund failed for returnId=${returnId}: ${err.message}`);
  });

  return ret.toObject();
};

// ────────────────────────────────────────────────────────────────────────────
// Internal: Process Refund
// ────────────────────────────────────────────────────────────────────────────

export const processReturnRefund = async (returnId, { force = false } = {}) => {
  const ret = await QuickReturnOrder.findById(returnId);
  if (!ret) return;
  // Idempotent guard: skip if already processed (unless forced by admin to fix stuck orders)
  if (!force && ret.status === 'refund_processed') {
    logger.info(`[Return] returnId=${returnId} already refund_processed. Use force=true to re-process.`);
    return;
  }

  if (ret.refundMethod === 'wallet' && ret.userId && ret.refundAmount > 0) {
    try {
      // Validate orderId — use parentOrderMongoId (a real ObjectId) for the transaction link;
      // ret.orderId is a human-readable string (QC-xxxx) which is NOT a valid ObjectId.
      const txnOrderId = ret.parentOrderMongoId
        ? String(ret.parentOrderMongoId)
        : null;

      const txn = await creditWallet({
        entityType: 'user',
        entityId: String(ret.userId),
        amount: ret.refundAmount,
        description: `Refund for return order ${ret.orderId}`,
        category: 'order_refund',  // MUST match Transaction schema enum (not 'refund')
        orderId: txnOrderId,
        metadata: { returnOrderId: String(ret._id), returnOrderHumanId: ret.orderId },
      });
      ret.refundTransactionId = txn?.transaction?._id ? String(txn.transaction._id) : (txn?.id ? String(txn.id) : 'wallet_credited');
      logger.info(`[Return] Wallet refund of ₹${ret.refundAmount} credited to userId=${ret.userId} for returnId=${returnId}`);
    } catch (err) {
      logger.error(`[Return] Wallet credit failed returnId=${returnId}: ${err.message}`);
      throw err; // Re-throw so the status is not falsely marked as processed
    }
  } else if (ret.refundMethod === 'bank_account') {
    // Bank transfer: automatically processed and recorded
    ret.refundTransactionId = `bank_ref_${Date.now()}`;
    logger.info(`[Return] Bank refund processed automatically for returnId=${returnId}, amount=${ret.refundAmount} to customer's registered bank account: ${JSON.stringify(ret.bankDetails)}`);
  }

  // 2. Calculate Delivery Partner Return Earnings & Credit Wallet
  let distanceKm = 0;
  let riderEarning = 0;
  if (ret.deliveryPartnerId) {
    let lat1 = ret.customerAddress?.location?.lat;
    let lon1 = ret.customerAddress?.location?.lng;
    let lat2 = ret.sellerAddress?.location?.lat;
    let lon2 = ret.sellerAddress?.location?.lng;

    // Fallback: If snapshot has nulls, pull from parentOrder and seller dynamically!
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
      const originalOrder = await QuickOrder.findById(ret.parentOrderMongoId || ret.orderId).lean();
      const seller = await Seller.findById(ret.sellerId).select('location').lean();

      if (originalOrder && originalOrder.deliveryAddress) {
        const addr = originalOrder.deliveryAddress;
        const coords = addr.location?.coordinates;
        if (Array.isArray(coords) && coords.length === 2) {
          lat1 = Number(coords[1]);
          lon1 = Number(coords[0]);
        } else if (addr.location && Number.isFinite(Number(addr.location.lat)) && Number.isFinite(Number(addr.location.lng))) {
          lat1 = Number(addr.location.lat);
          lon1 = Number(addr.location.lng);
        }
      }

      if (seller && seller.location) {
        const coords = seller.location.coordinates;
        if (Array.isArray(coords) && coords.length === 2) {
          lat2 = Number(coords[1]);
          lon2 = Number(coords[0]);
        } else if (Number.isFinite(Number(seller.location.lat)) && Number.isFinite(Number(seller.location.lng))) {
          lat2 = Number(seller.location.lat);
          lon2 = Number(seller.location.lng);
        } else if (Number.isFinite(Number(seller.location.latitude)) && Number.isFinite(Number(seller.location.longitude))) {
          lat2 = Number(seller.location.latitude);
          lon2 = Number(seller.location.longitude);
        }
      }
    }

    if (lat1 != null && lon1 != null && lat2 != null && lon2 != null) {
      distanceKm = haversineKm(lat1, lon1, lat2, lon2);
      riderEarning = await getRiderEarning(distanceKm);
    }
    ret.riderEarning = riderEarning;

    if (riderEarning > 0) {
      try {
        // Use parentOrderMongoId (a real ObjectId) for the transaction link;
        // ret.orderId is a human-readable string (QC-xxxx) which is NOT a valid ObjectId.
        const riderTxnOrderId = ret.parentOrderMongoId
          ? String(ret.parentOrderMongoId)
          : null;

        await creditWallet({
          entityType: 'deliveryBoy',
          entityId: String(ret.deliveryPartnerId),
          amount: riderEarning,
          description: `Return Order QC-RET-${String(ret._id).slice(-6).toUpperCase()} - delivery earning`,
          category: 'delivery_earning',
          orderId: riderTxnOrderId,
          metadata: { returnOrderId: String(ret._id), returnOrderHumanId: ret.orderId, distanceKm },
        });

        // Update rider's total deliveries count
        const { FoodDeliveryWallet } = await import('../../../../modules/food/delivery/models/deliveryWallet.model.js');
        await FoodDeliveryWallet.updateOne(
          { deliveryPartnerId: ret.deliveryPartnerId },
          { $inc: { totalDeliveries: 1 } }
        );

        logger.info(`[Return] Payout of ₹${riderEarning} credited to rider=${ret.deliveryPartnerId} for returnId=${returnId}, distanceKm=${distanceKm}`);
      } catch (err) {
        logger.error(`[Return] Failed to credit rider payout for returnId=${returnId}: ${err.message}`);
      }
    } else {
      logger.warn(`[Return] Rider earning is ₹0 for returnId=${returnId}. distanceKm=${distanceKm}. Check commission rules or coordinates.`);
    }
  }

  // 3. Deduct Refunded Product Amount from Seller's Settlement Balance
  if (ret.sellerId && ret.refundAmount > 0) {
    try {
      await SellerTransaction.create({
        sellerId: ret.sellerId,
        type: 'Adjustment',
        amount: -ret.refundAmount,
        status: 'Settled',
        orderId: ret.orderId,
        reference: `RET-ADJ-${String(ret._id).slice(-6).toUpperCase()}`,
        customer: ret.customerAddress?.phone || 'Customer',
        reason: 'Return Refund Adjustment',
        processedAt: new Date()
      });
      logger.info(`[Return] Deducted ₹${ret.refundAmount} from seller=${ret.sellerId} for returnId=${returnId}`);
    } catch (err) {
      logger.error(`[Return] Failed to deduct seller refund for returnId=${returnId}: ${err.message}`);
    }
  }

  ret.status = 'refund_processed';
  ret.refundProcessedAt = new Date();
  await ret.save();
};

// ────────────────────────────────────────────────────────────────────────────
// User: List own returns
// ────────────────────────────────────────────────────────────────────────────

export const getUserReturns = async (userId, sessionId) => {
  const filter = {};
  if (userId) filter.userId = new mongoose.Types.ObjectId(String(userId));
  else if (sessionId) filter.sessionId = sessionId;
  else return [];

  return QuickReturnOrder.find(filter)
    .select('+pickupOtp')
    .sort({ createdAt: -1 })
    .lean();
};

// ────────────────────────────────────────────────────────────────────────────
// Available delivery partners (for admin assign dropdown)
// ────────────────────────────────────────────────────────────────────────────

export const getAvailablePartners = async () => {
  const partners = await FoodDeliveryPartner.find({
    availabilityStatus: 'online',
    status: {
      $in: process.env.NODE_ENV === 'production' ? ['approved'] : ['approved', 'pending'],
    },
  })
    .select('_id name phone lastLat lastLng')
    .limit(50)
    .lean();

  return partners;
};
