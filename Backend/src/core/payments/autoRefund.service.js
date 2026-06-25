/**
 * autoRefund.service.js
 *
 * Centralized, idempotent automated refund engine.
 * Called whenever an order is cancelled (by user, restaurant, or seller/admin)
 * to immediately process the refund via the customer's selected method.
 *
 * Refund paths:
 *  1. Wallet payment    → always refunded back to wallet.
 *  2. Razorpay, refundTo='wallet'  → credited instantly to user wallet.
 *  3. Razorpay, refundTo='gateway' → initiated via Razorpay API; webhook confirms.
 */

import { logger } from '../../utils/logger.js';
import { initiateRazorpayRefund } from '../../modules/food/orders/helpers/razorpay.helper.js';
import { refundWalletBalance } from '../../modules/food/user/services/userWallet.service.js';

const ONLINE_METHODS = ['razorpay', 'razorpay_qr'];

/**
 * Process a refund for a cancelled order automatically.
 *
 * @param {object} order  - Mongoose document (already persisted with cancelled status).
 * @param {string} [refundToOverride] - 'wallet' | 'gateway' — caller can override.
 *                                      Defaults to order.payment.refund.requestedMethod or 'gateway'.
 * @returns {Promise<{ method: string, status: string, refundId?: string }>}
 *
 * Idempotency: Skips silently if payment.refund.status is already 'processed'.
 */
export async function autoRefundForCancelledOrder(order, refundToOverride, customDescription) {
    const paymentStatus = String(order.payment?.status || '').trim().toLowerCase();
    const paymentMethod = String(order.payment?.method || '').trim().toLowerCase();
    const existingRefundStatus = String(order.payment?.refund?.status || '').trim().toLowerCase();

    // ── Guard: already refunded ──────────────────────────────────────────────
    if (existingRefundStatus === 'processed' || paymentStatus === 'refunded') {
        logger.info(`[AutoRefund] Skipped — already refunded. Order: ${order.orderId}`);
        return { method: order.payment?.refund?.processedMethod || 'unknown', status: 'already_processed' };
    }

    // ── Guard: only refund paid orders ──────────────────────────────────────
    const isPaid = paymentStatus === 'paid' || paymentStatus === 'refunded';
    const isOnlinePaid = ONLINE_METHODS.includes(paymentMethod) && isPaid;
    const isWalletPaid = paymentMethod === 'wallet' && isPaid;

    if (!isOnlinePaid && !isWalletPaid) {
        logger.info(`[AutoRefund] Skipped — not a paid prepaid order. Order: ${order.orderId}, Method: ${paymentMethod}, Status: ${paymentStatus}`);
        return { method: 'none', status: 'not_applicable' };
    }

    const refundAmount = Number(order.pricing?.total || 0);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        logger.warn(`[AutoRefund] Skipped — invalid refund amount. Order: ${order.orderId}`);
        return { method: 'none', status: 'invalid_amount' };
    }

    // ── Determine refund method ──────────────────────────────────────────────
    // Wallet-paid orders always go back to wallet.
    // Online-paid orders use customer's choice (requestedMethod or override), default 'gateway'.
    let refundMethod;
    if (isWalletPaid) {
        refundMethod = 'wallet';
    } else {
        const requested = refundToOverride || order.payment?.refund?.requestedMethod;
        refundMethod = (requested === 'wallet' || requested === 'gateway') ? requested : 'gateway';
    }

    const processedAt = new Date();

    // ── PATH 1: Wallet refund ────────────────────────────────────────────────
    if (refundMethod === 'wallet') {
        try {
            await refundWalletBalance(
                order.userId,
                refundAmount,
                customDescription || `Refund for cancelled order #${order.orderId}`,
                {
                    orderId: String(order._id),
                    orderReadableId: String(order.orderId || ''),
                    source: 'auto_refund_on_cancel'
                }
            );

            // Update order payment fields in-memory (caller must .save())
            order.payment.status = 'refunded';
            order.payment.refund = {
                ...(order.payment.refund || {}),
                status: 'processed',
                amount: refundAmount,
                refundId: `wallet_refund_${Date.now()}`,
                requestedMethod: order.payment.refund?.requestedMethod || 'wallet',
                processedMethod: 'wallet',
                requestedAt: order.payment.refund?.requestedAt || processedAt,
                requestedByUser: Boolean(order.payment.refund?.requestedByUser),
                reason: order.payment.refund?.reason || '',
                processedAt,
            };

            logger.info(`[AutoRefund] Wallet refund of ₹${refundAmount} processed. Order: ${order.orderId}`);
            return { method: 'wallet', status: 'processed' };

        } catch (err) {
            logger.error(`[AutoRefund] Wallet refund FAILED for Order ${order.orderId}: ${err.message}`);
            order.payment.refund = {
                ...(order.payment.refund || {}),
                status: 'failed',
                amount: refundAmount,
                processedMethod: 'wallet',
                requestedAt: order.payment.refund?.requestedAt || processedAt,
            };
            return { method: 'wallet', status: 'failed', error: err.message };
        }
    }

    // ── PATH 2: Gateway (Razorpay) refund ───────────────────────────────────
    const paymentId = order.payment?.razorpay?.paymentId;
    if (!paymentId) {
        logger.warn(`[AutoRefund] Gateway refund skipped — no Razorpay paymentId. Order: ${order.orderId}`);
        order.payment.refund = {
            ...(order.payment.refund || {}),
            status: 'failed',
            amount: refundAmount,
            processedMethod: 'gateway',
        };
        return { method: 'gateway', status: 'failed', error: 'No paymentId found' };
    }

    try {
        const refundResult = await initiateRazorpayRefund(paymentId, refundAmount);

        if (refundResult.success) {
            order.payment.status = 'refunded';
            order.payment.refund = {
                ...(order.payment.refund || {}),
                status: 'processed',
                amount: refundAmount,
                refundId: refundResult.refundId || '',
                requestedMethod: order.payment.refund?.requestedMethod || 'gateway',
                processedMethod: 'gateway',
                requestedAt: order.payment.refund?.requestedAt || processedAt,
                requestedByUser: Boolean(order.payment.refund?.requestedByUser),
                reason: order.payment.refund?.reason || '',
                processedAt,
            };
            logger.info(`[AutoRefund] Gateway refund of ₹${refundAmount} initiated. Order: ${order.orderId}, RefundId: ${refundResult.refundId}`);
            return { method: 'gateway', status: 'processed', refundId: refundResult.refundId };

        } else {
            order.payment.refund = {
                ...(order.payment.refund || {}),
                status: 'failed',
                amount: refundAmount,
                requestedMethod: order.payment.refund?.requestedMethod || 'gateway',
                processedMethod: 'gateway',
                requestedAt: order.payment.refund?.requestedAt || processedAt,
            };
            logger.error(`[AutoRefund] Gateway refund API returned failure. Order: ${order.orderId}, Error: ${refundResult.error}`);
            return { method: 'gateway', status: 'failed', error: refundResult.error };
        }

    } catch (err) {
        logger.error(`[AutoRefund] Gateway refund EXCEPTION for Order ${order.orderId}: ${err.message}`);
        order.payment.refund = {
            ...(order.payment.refund || {}),
            status: 'failed',
            amount: refundAmount,
            processedMethod: 'gateway',
        };
        return { method: 'gateway', status: 'failed', error: err.message };
    }
}
