import { SubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { UserSubscription } from '../../user/models/userSubscription.model.js';
import * as razorpayHelper from '../../orders/helpers/razorpay.helper.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import dayjs from 'dayjs';
import { logger } from '../../../../utils/logger.js';

/**
 * Maps our internal duration units to Razorpay periods.
 */
const mapToRazorpayPeriod = (unit) => {
    const mapping = {
        'DAY': 'daily',
        'WEEK': 'weekly',
        'MONTH': 'monthly',
        'YEAR': 'yearly'
    };
    return mapping[unit];
};

export async function createPlan(data) {
    // 1. Determine Payment Type based on unit
    const paymentType = data.durationUnit === 'DAY' ? 'ONE_TIME' : 'RECURRING';
    
    let razorpayPlanId = null;

    // 2. Create Razorpay Plan for recurring types
    if (paymentType === 'RECURRING') {
        try {
            const rpPlan = await razorpayHelper.createRazorpayPlan({
                name: data.name,
                description: data.description,
                amountPaise: data.price * 100,
                interval: data.durationValue,
                period: mapToRazorpayPeriod(data.durationUnit)
            });
            razorpayPlanId = rpPlan.id;
        } catch (err) {
            throw new Error(`Razorpay Plan Creation Failed: ${err.message}`);
        }
    }

    // 3. Save to DB only after RP success
    const plan = await SubscriptionPlan.create({
        ...data,
        paymentType,
        razorpayPlanId
    });

    return plan;
}

export async function updatePlan(id, updates) {
    const oldPlan = await SubscriptionPlan.findOne({ _id: id, isDeleted: false });
    if (!oldPlan) throw new NotFoundError('Subscription plan not found');

    // 📂 CASE 1: RECURRING PRICE CHANGE (Versioning Required)
    const isPriceChanging = updates.price !== undefined && Number(updates.price) !== oldPlan.price;
    
    if (oldPlan.paymentType === 'RECURRING' && isPriceChanging) {
        try {
            // 1. Create NEW Razorpay Plan
            const rpPlan = await razorpayHelper.createRazorpayPlan({
                name: updates.name || oldPlan.name,
                description: updates.description || oldPlan.description,
                amountPaise: Number(updates.price) * 100,
                interval: oldPlan.durationValue,
                period: mapToRazorpayPeriod(oldPlan.durationUnit)
            });

            // 2. Mark OLD plan as inactive
            oldPlan.isActive = false;
            await oldPlan.save();

            // 3. Create NEW MongoDB document (New Version)
            const newPlan = await SubscriptionPlan.create({
                ...oldPlan.toObject(),
                ...updates,
                _id: undefined, // New ID
                razorpayPlanId: rpPlan.id,
                isActive: updates.isActive !== undefined ? updates.isActive : true,
                createdAt: undefined,
                updatedAt: undefined
            });

            return newPlan;
        } catch (err) {
            throw new Error(`Failed to version plan on Razorpay: ${err.message}`);
        }
    }

    // 📂 CASE 2: METADATA OR ONE-TIME UPDATE (Safe Mutation)
    Object.assign(oldPlan, updates);
    await oldPlan.save();
    return oldPlan;
}

export async function listPlans(query = {}) {
    const filter = { isDeleted: false };
    if (query.userType) filter.userType = query.userType;
    
    // Default: Show only active plans unless includeInactive is explicitly true
    if (query.includeInactive !== 'true') {
        filter.isActive = true;
    }

    return SubscriptionPlan.find(filter).sort({ createdAt: -1 }).lean();
}

export async function deletePlan(id) {
    const plan = await SubscriptionPlan.findByIdAndUpdate(
        id, 
        { isDeleted: true, isActive: false }, 
        { new: true }
    );
    if (!plan) throw new NotFoundError('Plan not found');
    return plan;
}

/**
 * ✅ NEW: Process Expiry and Grace Periods for all subscriptions.
 * Called hourly via Cron.
 */
export async function processSubscriptionExpiry() {
    const now = new Date();

    // 0. Cleanup stale PENDING (older than 30 mins) to avoid infinite pending records.
    // Webhook activation can still re-activate the doc if payment succeeds later.
    const pendingCutoff = dayjs(now).subtract(30, 'minutes').toDate();
    const pendingCleanup = await UserSubscription.updateMany(
        {
            status: 'pending',
            createdAt: { $lt: pendingCutoff }
        },
        {
            $set: {
                status: 'failed',
                'metadata.pendingFailedAt': now,
                'metadata.pendingFailedReason': 'pending_timeout'
            }
        }
    );
    if (pendingCleanup.modifiedCount > 0) {
        logger.info(`Subscription Lifecycle: Marked ${pendingCleanup.modifiedCount} stale PENDING as FAILED`);
    }

    // 1. Move ACTIVE -> GRACE (if expiry reached)
    const toGrace = await UserSubscription.updateMany(
        {
            status: 'active',
            expiryDate: { $lt: now }
        },
        {
            $set: {
                status: 'grace',
                gracePeriodUntil: dayjs().add(24, 'hours').toDate()
            }
        }
    );
    if (toGrace.modifiedCount > 0) {
        logger.info(`Subscription Lifecycle: Moved ${toGrace.modifiedCount} to GRACE state`);
    }

    // 2. Move GRACE -> EXPIRED (if grace window closed)
    const toExpired = await UserSubscription.updateMany(
        {
            status: 'grace',
            gracePeriodUntil: { $lt: now }
        },
        {
            $set: { status: 'expired' }
        }
    );
    if (toExpired.modifiedCount > 0) {
        logger.info(`Subscription Lifecycle: Marked ${toExpired.modifiedCount} as EXPIRED`);
    }

    return { toGrace: toGrace.modifiedCount, toExpired: toExpired.modifiedCount };
}
