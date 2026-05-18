import mongoose from 'mongoose';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { FoodDailyPass } from '../models/foodDailyPass.model.js';
import { FoodWalletLedger } from '../models/foodWalletLedger.model.js';
import { FoodDeliveryWallet } from '../../delivery/models/deliveryWallet.model.js';
import { FoodRestaurantWallet } from '../../restaurant/models/restaurantWallet.model.js';
import { getActiveSubscription } from './subscription.service.js';
import { SubscriptionPlan } from '../../admin/models/subscriptionPlan.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { createRazorpayOrder, isRazorpayConfigured, getRazorpayKeyId } from '../../orders/helpers/razorpay.helper.js';
import { logger } from '../../../../utils/logger.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

import http from 'http';

function reportDebug(event, data) {
    const payload = JSON.stringify({
        sessionId: 'topup-500-crash',
        runId: 'pre',
        timestamp: new Date().toISOString(),
        event,
        data
    });
    const req = http.request('http://127.0.0.1:7778/event', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    });
    req.on('error', () => {});
    req.write(payload);
    req.end();
}

/**
 * Creates a Razorpay order for subscription wallet top-up.
 */
export async function createTopupOrder(userId, userType, amount) {
    if (!amount || amount < 1) throw new ValidationError('Minimum topup amount is ₹1');
    if (!['RESTAURANT', 'DELIVERY_PARTNER'].includes(userType)) throw new ValidationError('Invalid user type');

    // PHASE 1: Minimum balance enforcement
    const MIN_BALANCE = 1000;
    const WalletModel = userType === 'RESTAURANT' ? FoodRestaurantWallet : FoodDeliveryWallet;
    const ownerFilter = userType === 'RESTAURANT' ? { restaurantId: userId } : { deliveryPartnerId: userId };

    const wallet = await WalletModel.findOne(ownerFilter).select('subscriptionBalance').lean();
    const currentBalance = wallet?.subscriptionBalance || 0;

    if (currentBalance < MIN_BALANCE) {
        const requiredTopup = Math.max(0, MIN_BALANCE - currentBalance);
        if (amount < requiredTopup) {
            throw new ValidationError(`Minimum recharge required is ₹${requiredTopup} to maintain active status`);
        }
    }

    const amountPaise = Math.round(amount * 100);
    const receipt = `tp_${String(userId).slice(-6)}_${Date.now().toString().slice(-6)}`;

    const notes = {
        type: 'subscription_wallet_topup',
        ownerId: String(userId),
        ownerType: userType,
        amount: String(amount)
    };

    if (!isRazorpayConfigured()) {
        // #region debug-point trace-razorpay-unconfigured
        reportDebug('razorpay-not-configured', { userId, userType, amount });
        // #endregion
        return {
            razorpay: {
                key: getRazorpayKeyId() || 'rzp_test_dummy',
                order_id: `order_dev_${Date.now()}`,
                amount: amountPaise,
                currency: 'INR',
                notes
            }
        };
    }

    try {
        const order = await createRazorpayOrder(amountPaise, 'INR', receipt);
        return {
            razorpay: {
                key: getRazorpayKeyId(),
                order_id: String(order.id),
                amount: Number(order.amount),
                currency: order.currency || 'INR',
                notes
            }
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Verifies the Razorpay payment and increments subscription balance.
 * This is the SOURCE OF TRUTH called by the Razorpay Webhook.
 */
export async function verifyTopup(payload) {
    const { payment, order, notes } = payload;
    const rzPaymentId = payment.id;
    const { ownerId, ownerType, amount } = notes;

    if (!ownerId || !ownerType || !amount) {
        logger.error('verifyTopup: Missing mandatory notes in Razorpay payload', { notes });
        return;
    }

    const topupAmount = Number(amount);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Check if already processed (Idempotency via Ledger)
        const existingLedger = await FoodWalletLedger.findOne({ 
            referenceId: rzPaymentId, 
            type: 'TOPUP' 
        }).session(session);

        if (existingLedger) {
            logger.info(`verifyTopup: Topup already processed for payment ${rzPaymentId}`);
            await session.commitTransaction();
            return;
        }

        // 2. Update Wallet Balance Atomically using $inc with UPSERT for first-time users
        const WalletModel = ownerType === 'RESTAURANT' ? FoodRestaurantWallet : FoodDeliveryWallet;
        const ownerFilter = ownerType === 'RESTAURANT' ? { restaurantId: ownerId } : { deliveryPartnerId: ownerId };

        const wallet = await WalletModel.findOneAndUpdate(
            ownerFilter,
            { $inc: { subscriptionBalance: topupAmount } },
            { session, new: false, upsert: true, setDefaultsOnInsert: true } // Get state BEFORE increment for ledger
        );

        // If upsert happened, wallet will be null with new:false
        const beforeBalance = wallet ? (wallet.subscriptionBalance || 0) : 0;
        const afterBalance = beforeBalance + topupAmount;

        // 3. Create Ledger Entry
        await FoodWalletLedger.create([{
            ownerId,
            ownerType,
            type: 'TOPUP',
            amount: topupAmount,
            beforeBalance,
            afterBalance,
            referenceId: rzPaymentId,
            metadata: { razorpayOrderId: order?.id, razorpayPaymentId: rzPaymentId }
        }], { session });

        await session.commitTransaction();
        logger.info(`verifyTopup: Successfully credited ₹${topupAmount} to ${ownerType} ${ownerId}`);
    } catch (error) {
        await session.abortTransaction();
        logger.error('verifyTopup: Transaction failed', { error: error.message, ownerId, rzPaymentId });
        throw error;
    } finally {
        session.endSession();
    }
}

/**
 * Activates a daily pass by deducting the fee from the subscription wallet.
 * Atomic safety, dynamic pricing, and double deduction protection.
 */
export async function activateDailyPass(userId, userType) {
    const todayIST = dayjs().tz(IST_TIMEZONE).format('YYYY-MM-DD');
    const endOfDayIST = dayjs().tz(IST_TIMEZONE).endOf('day').toDate();

    // 1. Recurring Plan Guard (MONTH/WEEK)
    // Defensive bypass if called directly without eligibility check
    const activeSub = await getActiveSubscription(userId, userType);
    if (activeSub && activeSub.planId) {
        return {
            success: true,
            deducted: false,
            reason: 'RECURRING_ACTIVE'
        };
    }

    // 2. Double Deduction Protection (Pre-check)
    const existingPass = await FoodDailyPass.findOne({ userId, userType, date: todayIST }).lean();
    if (existingPass) {
        return {
            success: true,
            deducted: false,
            reason: 'PASS_ALREADY_ACTIVE',
            expiresAt: existingPass.expiresAt,
            amountDeducted: existingPass.amountDeducted
        };
    }

    // 3. Fetch Dynamic Plan Price
    // FIX: Updated query to match actual DB schema (durationUnit instead of interval)
    const dayPlan = await SubscriptionPlan.findOne({ 
        durationUnit: 'DAY', 
        userType, 
        isActive: true, 
        isDeleted: false 
    }).lean();

    if (!dayPlan) {
        return { success: false, deducted: false, reason: 'PLAN_NOT_FOUND' };
    }
    const deductionAmount = dayPlan.price;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const WalletModel = userType === 'RESTAURANT' ? FoodRestaurantWallet : FoodDeliveryWallet;
        const ownerFilter = userType === 'RESTAURANT' ? { restaurantId: userId } : { deliveryPartnerId: userId };

        // 4. Atomic Balance Deduction with Threshold & Price Safety
        // Rule: wallet >= 1000 AND wallet >= planPrice
        const safetyThreshold = Math.max(1000, deductionAmount);
        const wallet = await WalletModel.findOneAndUpdate(
            { ...ownerFilter, subscriptionBalance: { $gte: safetyThreshold } },
            { $inc: { subscriptionBalance: -deductionAmount } },
            { session, new: false }
        );

        if (!wallet) {
            await session.abortTransaction();
            return { success: false, deducted: false, reason: 'LOW_BALANCE' };
        }

        const beforeBalance = wallet.subscriptionBalance;
        const afterBalance = beforeBalance - deductionAmount;

        // 5. Create Daily Pass with Unique Index Protection
        let newPass;
        try {
            [newPass] = await FoodDailyPass.create([{
                userId, userType, date: todayIST,
                amountDeducted: deductionAmount, expiresAt: endOfDayIST
            }], { session });
        } catch (err) {
            if (err.code === 11000) {
                await session.abortTransaction();
                const concurrentPass = await FoodDailyPass.findOne({ userId, userType, date: todayIST }).lean();
                return {
                    success: true, deducted: false, reason: 'PASS_ALREADY_ACTIVE',
                    expiresAt: concurrentPass?.expiresAt, amountDeducted: concurrentPass?.amountDeducted
                };
            }
            throw err;
        }

        // 6. Create Ledger Entry
        await FoodWalletLedger.create([{
            ownerId: userId, ownerType: userType, type: 'DAILY_DEDUCTION',
            amount: deductionAmount, beforeBalance, afterBalance,
            referenceId: String(newPass._id), metadata: { planId: dayPlan._id, date: todayIST }
        }], { session });

        await session.commitTransaction();
        return {
            success: true, deducted: true, reason: 'DAY_PASS_ACTIVATED',
            expiresAt: endOfDayIST, amountDeducted: deductionAmount
        };
    } catch (error) {
        await session.abortTransaction();
        logger.error('activateDailyPass: Failed', { error: error.message, userId, userType });
        throw error;
    } finally {
        session.endSession();
    }
}
export async function ensureDailyPassEligibility(userId, userType) {
    if (!['RESTAURANT', 'DELIVERY_PARTNER'].includes(userType)) {
        throw new ValidationError('Invalid user type for eligibility check');
    }

    // 1. Priority Check: MONTH/WEEK Subscription (MONTH > WEEK)
    const activeSub = await getActiveSubscription(userId, userType);
    if (activeSub && activeSub.planId) {
        const interval = activeSub.planId.interval; // Expected 'month' or 'week'
        const type = interval === 'month' ? 'MONTH' : 'WEEK';
        return {
            eligible: true,
            reason: 'RECURRING_ACTIVE',
            shouldDeduct: false,
            subscriptionType: type
        };
    }

    // 2. Priority Check: DAY PASS (Already active for today IST and NOT EXPIRED)
    const todayIST = dayjs().tz(IST_TIMEZONE).format('YYYY-MM-DD');
    console.log("[TRACE] ensureDailyPassEligibility starting", { userId, userType, todayIST });
    
    const existingPass = await FoodDailyPass.findOne({
        userId,
        userType,
        date: todayIST,
        expiresAt: { $gt: new Date() } // HOTFIX: Verify pass has not expired
    }).lean();

    const now = new Date();
    console.log("[TRACE] Step 2 Result:", {
        existingPassFound: !!existingPass,
        existingPassId: existingPass?._id,
        existingPassExpiresAt: existingPass?.expiresAt,
        currentTime: now,
        isExpired: existingPass ? new Date(existingPass.expiresAt) <= now : "N/A",
        comparisonResult: existingPass ? (new Date(existingPass.expiresAt) > now) : "N/A"
    });

    if (existingPass) {
        const finalResult = {
            eligible: true,
            reason: 'DAY_PASS_ACTIVE',
            shouldDeduct: false,
            subscriptionType: 'DAY'
        };
        console.log("[TRACE] ensureDailyPassEligibility final return (Step 2):", finalResult);
        return finalResult;
    }

    // 3. Balance Check: Check if deduction is possible (Min ₹1000)
    const WalletModel = userType === 'RESTAURANT' ? FoodRestaurantWallet : FoodDeliveryWallet;
    const ownerFilter = userType === 'RESTAURANT' ? { restaurantId: userId } : { deliveryPartnerId: userId };
    
    const wallet = await WalletModel.findOne(ownerFilter).select('subscriptionBalance').lean();
    const balance = wallet?.subscriptionBalance || 0;
    
    // Fetch deduction amount for UI feedback
    const dayPlan = await SubscriptionPlan.findOne({ 
        durationUnit: 'DAY', 
        userType, 
        isActive: true, 
        isDeleted: false 
    }).select('price').lean();
    const deductionAmount = dayPlan?.price || 0;

    console.log("[TRACE] Step 3 Balance Check:", { balance, minRequired: 1000, deductionAmount });

    if (balance < 1000) {
        const finalResult = {
            eligible: false,
            reason: 'LOW_BALANCE',
            shouldDeduct: false,
            subscriptionType: null,
            balance,
            threshold: 1000,
            deductionAmount
        };
        console.log("[TRACE] ensureDailyPassEligibility final return (Step 3):", finalResult);
        return finalResult;
    }

    // 4. Decision: Eligible but requires deduction
    const finalResult = {
        eligible: true,
        reason: 'REQUIRES_DAY_DEDUCTION',
        shouldDeduct: true,
        subscriptionType: 'DAY',
        balance,
        threshold: 1000,
        deductionAmount
    };
    console.log("[TRACE] ensureDailyPassEligibility final return (Step 4):", finalResult);
    return finalResult;
}
export async function getWalletLedger(ownerId, ownerType, { limit = 20, skip = 0 } = {}) {
    if (!['RESTAURANT', 'DELIVERY_PARTNER'].includes(ownerType)) throw new ValidationError('Invalid owner type');
    
    const query = { ownerId, ownerType };
    const history = await FoodWalletLedger.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const total = await FoodWalletLedger.countDocuments(query);
    
    return {
        history,
        pagination: {
            total,
            limit,
            skip
        }
    };
}
