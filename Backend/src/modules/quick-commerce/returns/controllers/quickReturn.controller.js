import * as returnService from '../services/quickReturn.service.js';
import mongoose from 'mongoose';

// helper to send error response
const handleError = (res, err, context = 'Return Order') => {
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || `An error occurred in ${context}.`,
  });
};

// resolve user or session ID
const resolveId = (req) => {
  const userId = req.user?.userId || null;
  const sessionId = String(req.headers['x-quick-session'] || req.query.sessionId || req.body.sessionId || '').trim();
  return { userId, sessionId };
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = async (req, res) => {
  try {
    const settings = await returnService.getReturnSettings();
    return res.json({ success: true, result: settings });
  } catch (err) {
    return handleError(res, err, 'getSettings');
  }
};

export const updateSettings = async (req, res) => {
  try {
    const adminId = req.user?.userId || null;
    const settings = await returnService.updateReturnSettings(req.body, adminId);
    return res.json({ success: true, result: settings });
  } catch (err) {
    return handleError(res, err, 'updateSettings');
  }
};

// ─── Eligibility ─────────────────────────────────────────────────────────────

export const checkEligibility = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId, sessionId } = resolveId(req);
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const check = await returnService.checkReturnEligibility(orderId, userId, sessionId);
    if (!check.eligible) {
      return res.json({ success: false, eligible: false, message: check.reason, returnId: check.returnId });
    }

    return res.json({
      success: true,
      eligible: true,
      result: {
        orderId: check.order.orderId,
        refundAmount: check.order.items
          ?.filter((i) => i.type === 'quick')
          ?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0,
        returnWindowDays: check.settings.returnWindowDays,
      },
    });
  } catch (err) {
    return handleError(res, err, 'checkEligibility');
  }
};

// ─── User actions ─────────────────────────────────────────────────────────────

export const userCreateReturn = async (req, res) => {
  try {
    const { userId, sessionId } = resolveId(req);
    const { orderId, reason, proofImageUrl, refundMethod, bankDetails } = req.body;

    if (!orderId || !reason || !proofImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'orderId, reason, and proofImageUrl are required.',
      });
    }

    if (refundMethod === 'bank_account' && (!bankDetails || !bankDetails.accountHolderName || !bankDetails.accountNumber || !bankDetails.ifscCode)) {
      return res.status(400).json({
        success: false,
        message: 'Bank details (accountHolderName, accountNumber, ifscCode) are required for bank refunds.',
      });
    }

    const returnOrder = await returnService.createReturnRequest({
      orderId,
      userId,
      sessionId,
      reason,
      proofImageUrl,
      refundMethod,
      bankDetails,
    });

    return res.status(212).json({ success: true, result: returnOrder });
  } catch (err) {
    return handleError(res, err, 'userCreateReturn');
  }
};

export const userGetReturns = async (req, res) => {
  try {
    const { userId, sessionId } = resolveId(req);
    const returns = await returnService.getUserReturns(userId, sessionId);
    return res.json({ success: true, result: returns });
  } catch (err) {
    return handleError(res, err, 'userGetReturns');
  }
};

// ─── Admin actions ────────────────────────────────────────────────────────────

export const adminGetReturns = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const data = await returnService.getAdminReturns({ status, page, limit });
    return res.json({ success: true, result: data });
  } catch (err) {
    return handleError(res, err, 'adminGetReturns');
  }
};

export const adminGetReturnById = async (req, res) => {
  try {
    const { id } = req.params;
    const returnOrder = await returnService.getAdminReturnById(id);
    return res.json({ success: true, result: returnOrder });
  } catch (err) {
    return handleError(res, err, 'adminGetReturnById');
  }
};

export const adminApproveReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { partnerId } = req.body;
    const adminId = req.user?.userId || null;

    const result = await returnService.approveReturnRequest(id, adminId, partnerId);
    return res.json({ success: true, result });
  } catch (err) {
    return handleError(res, err, 'adminApproveReturn');
  }
};

export const adminRejectReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.userId || null;

    const result = await returnService.rejectReturnRequest(id, adminId, reason);
    return res.json({ success: true, result });
  } catch (err) {
    return handleError(res, err, 'adminRejectReturn');
  }
};

export const adminAssignPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { partnerId } = req.body;

    const result = await returnService.assignPickupPartner(id, partnerId);
    return res.json({ success: true, result });
  } catch (err) {
    return handleError(res, err, 'adminAssignPartner');
  }
};

export const adminGetAvailablePartners = async (req, res) => {
  try {
    const partners = await returnService.getAvailablePartners();
    return res.json({ success: true, result: partners });
  } catch (err) {
    return handleError(res, err, 'adminGetAvailablePartners');
  }
};

// ─── Delivery Partner actions ─────────────────────────────────────────────────

export const partnerGetPickups = async (req, res) => {
  try {
    // Delivery partner auth sets partner info on req.user or similar
    const partnerId = req.user?.partnerId || req.user?.userId;
    if (!partnerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized delivery partner.' });
    }

    const pickups = await returnService.getPartnerPickups(partnerId);
    return res.json({ success: true, result: pickups });
  } catch (err) {
    return handleError(res, err, 'partnerGetPickups');
  }
};

export const partnerVerifyOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const partnerId = req.user?.partnerId || req.user?.userId;

    if (!partnerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized delivery partner.' });
    }

    const result = await returnService.verifyPickupOtp(id, partnerId, otp);
    return res.json({ success: true, result });
  } catch (err) {
    return handleError(res, err, 'partnerVerifyOtp');
  }
};

export const partnerConfirmPickup = async (req, res) => {
  try {
    const { id } = req.params;
    const { pickupProofImageUrl } = req.body;
    const partnerId = req.user?.partnerId || req.user?.userId;

    if (!partnerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized delivery partner.' });
    }

    const result = await returnService.confirmPickup(id, partnerId, pickupProofImageUrl);
    return res.json({ success: true, result });
  } catch (err) {
    return handleError(res, err, 'partnerConfirmPickup');
  }
};

export const partnerMarkDeliveredToSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const { sellerOtp } = req.body;
    const partnerId = req.user?.partnerId || req.user?.userId;

    if (!partnerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized delivery partner.' });
    }

    const result = await returnService.markDeliveredToSeller(id, partnerId, sellerOtp);
    return res.json({ success: true, result });
  } catch (err) {
    return handleError(res, err, 'partnerMarkDeliveredToSeller');
  }
};

// ─── Seller actions ───────────────────────────────────────────────────────────

export const sellerGetReturns = async (req, res) => {
  try {
    // Seller auth sets seller info on req.user or similar
    const sellerId = req.user?.sellerId || req.user?.userId;
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized seller.' });
    }

    const { status, page, limit } = req.query;
    const data = await returnService.getSellerReturns(sellerId, { status, page, limit });
    return res.json({ success: true, result: data });
  } catch (err) {
    return handleError(res, err, 'sellerGetReturns');
  }
};

export const sellerConfirmReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user?.sellerId || req.user?.userId;

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized seller.' });
    }

    const result = await returnService.sellerConfirmReceipt(id, sellerId);
    return res.json({ success: true, result });
  } catch (err) {
    return handleError(res, err, 'sellerConfirmReceipt');
  }
};

// ─── Admin: Re-trigger stuck refund ──────────────────────────────────────────

export const adminRetriggerRefund = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid return order ID.' });
    }

    // Use force=true to bypass idempotency guard — fixes orders stuck as 'refund_processed'
    // but without the actual wallet credit (caused by old enum bug).
    await returnService.processReturnRefund(id, { force: true });
    return res.json({ success: true, message: `Refund and payout re-triggered for return order ${id}.` });
  } catch (err) {
    return handleError(res, err, 'adminRetriggerRefund');
  }
};

