import { SubscriptionPlan } from '../../admin/models/subscriptionPlan.model.js';
import { UserSubscription } from '../../user/models/userSubscription.model.js';
import * as razorpayHelper from '../../orders/helpers/razorpay.helper.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import crypto from 'crypto';

export async function initiatePurchase(userId, userType, { planId }) {
    const plan = await SubscriptionPlan.findOne({ _id: planId, isDeleted: false, isActive: true });
    if (!plan) throw new NotFoundError('Subscription plan not found or inactive');

    const restaurantId = userType === 'RESTAURANT' ? userId : null;
    const deliveryBoyId = userType === 'DELIVERY_PARTNER' ? userId : null;
    const ownerFilter = { $or: [{ restaurantId }, { deliveryBoyId }].filter(Boolean) };

    // 1. Check if already has an active subscription
    const existing = await UserSubscription.findOne({
        ...ownerFilter,
        status: { $in: ['active', 'grace'] }
    });
    if (existing) throw new ValidationError('You already have an active subscription');

    const PENDING_REUSE_MS = 30 * 60 * 1000;
    const lockWindowMs = 2 * 60 * 1000;
    const lockWaitMs = 5 * 1000;
    const lockPollMs = 250;
    const nowMs = Date.now();

    const getPendingForPlan = async () => {
        return UserSubscription.findOne({ ...ownerFilter, planId: plan._id, status: 'pending' })
            .sort({ createdAt: -1 })
            .exec();
    };

    let pendingDoc = await getPendingForPlan();
    if (pendingDoc?.createdAt) {
        const ageMs = nowMs - new Date(pendingDoc.createdAt).getTime();
        if (ageMs < PENDING_REUSE_MS) {
            if (plan.paymentType === 'ONE_TIME') {
                const pendingOrderId = pendingDoc?.metadata?.razorpayOrderId;
                const pendingAmount = pendingDoc?.metadata?.razorpayOrderAmount;
                if (pendingOrderId && pendingAmount) {
                    return {
                        orderId: pendingOrderId,
                        amount: pendingAmount,
                        key: razorpayHelper.getRazorpayKeyId()
                    };
                }
            } else {
                if (pendingDoc?.razorpaySubscriptionId) {
                    return {
                        subscriptionId: pendingDoc.razorpaySubscriptionId,
                        key: razorpayHelper.getRazorpayKeyId()
                    };
                }
            }
        }
    }

    if (!pendingDoc) {
        try {
            pendingDoc = await UserSubscription.create({
                planId: plan._id,
                userType,
                restaurantId,
                deliveryBoyId,
                status: 'pending',
                metadata: {}
            });
        } catch (e) {
            if (e?.code === 11000) {
                pendingDoc = await getPendingForPlan();
            } else {
                throw e;
            }
        }
    }

    if (!pendingDoc) {
        throw new ValidationError('Unable to create purchase intent');
    }

    const lockId = crypto.randomBytes(16).toString('hex');
    const lockUntil = new Date(Date.now() + lockWindowMs);

    const lockResult = await UserSubscription.updateOne(
        {
            _id: pendingDoc._id,
            status: 'pending',
            planId: plan._id,
            $or: [
                { 'metadata.purchaseLockUntil': { $exists: false } },
                { 'metadata.purchaseLockUntil': null },
                { 'metadata.purchaseLockUntil': { $lt: new Date() } }
            ]
        },
        {
            $set: {
                'metadata.purchaseLockId': lockId,
                'metadata.purchaseLockUntil': lockUntil
            }
        }
    );

    if (lockResult.modifiedCount === 0) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < lockWaitMs) {
            const fresh = await getPendingForPlan();
            if (fresh) {
                if (plan.paymentType === 'ONE_TIME') {
                    const pendingOrderId = fresh?.metadata?.razorpayOrderId;
                    const pendingAmount = fresh?.metadata?.razorpayOrderAmount;
                    if (pendingOrderId && pendingAmount) {
                        return {
                            orderId: pendingOrderId,
                            amount: pendingAmount,
                            key: razorpayHelper.getRazorpayKeyId()
                        };
                    }
                } else {
                    if (fresh?.razorpaySubscriptionId) {
                        return {
                            subscriptionId: fresh.razorpaySubscriptionId,
                            key: razorpayHelper.getRazorpayKeyId()
                        };
                    }
                }
            }
            await new Promise((r) => setTimeout(r, lockPollMs));
        }
        throw new ValidationError('Purchase is already in progress. Please retry.');
    }

    let razorpayData = {};

    // 2. Handle One-Time vs Recurring
    if (plan.paymentType === 'ONE_TIME') {
        const order = await razorpayHelper.createRazorpayOrder({
            amountPaise: plan.price * 100,
            notes: {
                type: 'subscription',
                planId: String(plan._id),
                restaurantId: restaurantId ? String(restaurantId) : undefined,
                deliveryBoyId: deliveryBoyId ? String(deliveryBoyId) : undefined,
                userType
            }
        });

        // 📂 CRITICAL: Create PENDING subscription record for One-Time too (idempotency)
        await UserSubscription.updateOne(
            { _id: pendingDoc._id, status: 'pending', planId: plan._id, 'metadata.purchaseLockId': lockId },
            {
                $set: {
                    razorpayPaymentId: null,
                    'metadata.razorpayOrderId': order.id,
                    'metadata.razorpayOrderAmount': order.amount
                },
                $unset: {
                    'metadata.purchaseLockId': 1,
                    'metadata.purchaseLockUntil': 1
                }
            }
        );

        razorpayData = {
            orderId: order.id,
            amount: order.amount,
            key: razorpayHelper.getRazorpayKeyId()
        };
    } else {
        const sub = await razorpayHelper.createRazorpaySubscription({
            planId: plan.razorpayPlanId,
            customerNotes: {
                planId: String(plan._id),
                restaurantId: restaurantId ? String(restaurantId) : undefined,
                deliveryBoyId: deliveryBoyId ? String(deliveryBoyId) : undefined,
                userType
            }
        });

        // 📂 CRITICAL: Create PENDING subscription record for Recurring
        await UserSubscription.updateOne(
            { _id: pendingDoc._id, status: 'pending', planId: plan._id, 'metadata.purchaseLockId': lockId },
            {
                $set: {
                    razorpaySubscriptionId: sub.id,
                    'metadata.razorpaySubscriptionId': sub.id
                },
                $unset: {
                    'metadata.purchaseLockId': 1,
                    'metadata.purchaseLockUntil': 1
                }
            }
        );

        razorpayData = {
            subscriptionId: sub.id,
            key: razorpayHelper.getRazorpayKeyId()
        };
    }

    return razorpayData;
}

export async function verifyPurchase(userId, userType, data) {
    const { razorpayPaymentId, razorpaySignature, razorpayOrderId, razorpaySubscriptionId } = data;

    // 1. Verify Signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const verified = razorpayHelper.verifyPaymentSignature(
        razorpayOrderId || razorpaySubscriptionId,
        razorpayPaymentId,
        razorpaySignature
    );

    if (!verified) throw new ValidationError('Payment signature verification failed');

    // Webhook will handle the actual DB update for production robustness,
    // but we can do a quick check/update here for better UX response.
    return { verified: true };
}

export async function getActiveSubscription(userId, userType) {
    const restaurantId = userType === 'RESTAURANT' ? userId : null;
    const deliveryBoyId = userType === 'DELIVERY_PARTNER' ? userId : null;

    return UserSubscription.findOne({
        $or: [{ restaurantId }, { deliveryBoyId }].filter(Boolean),
        status: { $in: ['active', 'grace'] }
    }).populate('planId').lean();
}
