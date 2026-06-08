import { OnboardingFeeConfig } from '../models/onboardingFeeConfig.model.js';
import { OnboardingPaymentLog } from '../models/onboardingPaymentLog.model.js';
import { verifyPaymentSignature } from '../../food/orders/helpers/razorpay.helper.js';
import { ValidationError } from '../../../core/auth/errors.js';
import mongoose from 'mongoose';

/**
 * Verifies and consumes the onboarding payment for a given role and profile ID.
 * If onboarding fee configuration is inactive or fee is 0, this check is bypassed.
 * 
 * @param {Object} params
 * @param {string} params.role - 'RESTAURANT' | 'SELLER' | 'DELIVERY_PARTNER'
 * @param {Object} params.paymentDetails - { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 * @param {Object} params.userDetails - { name, phone, email }
 * @param {string} params.entityId - Mongoose ObjectId of the created partner profile
 */
export async function verifyAndConsumeOnboardingPayment({ role, paymentDetails = {}, userDetails = {}, entityId = null }) {
    // 1. Check if onboarding fee is active and price is greater than 0
    const config = await OnboardingFeeConfig.findOne({ role });
    if (!config || !config.isActive || config.price <= 0) {
        return { success: true, bypassed: true };
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = paymentDetails;
    if (!razorpayOrderId) {
        throw new ValidationError('razorpayOrderId is required for onboarding fee payment');
    }
    if (!razorpayPaymentId) {
        throw new ValidationError('razorpayPaymentId is required for onboarding fee payment');
    }
    if (!razorpaySignature) {
        throw new ValidationError('razorpaySignature is required for onboarding fee payment');
    }

    // 2. Check if this is a mock order ID
    const isMock = String(razorpayOrderId).startsWith('mock_ord_');
    let isValid = false;

    if (isMock) {
        // Automatically validate mock order IDs for developer convenience
        isValid = true;
    } else {
        // Validate signature using standard Razorpay helper
        isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    }

    if (!isValid) {
        // Record failed payment attempt
        await OnboardingPaymentLog.findOneAndUpdate(
            { razorpayOrderId },
            {
                $set: {
                    status: 'failed',
                    razorpayPaymentId,
                    razorpaySignature,
                    errorDetails: 'Payment signature verification failed.'
                }
            },
            { upsert: true, new: true }
        );
        throw new ValidationError('Onboarding payment verification failed. Invalid signature.');
    }

    // 3. Mark payment log as successful and associate with created entity (Restaurant, Seller, Delivery Partner)
    await OnboardingPaymentLog.findOneAndUpdate(
        { razorpayOrderId },
        {
            $set: {
                status: 'success',
                razorpayPaymentId,
                razorpaySignature,
                entityId: entityId ? new mongoose.Types.ObjectId(entityId) : null,
                amount: config.price,
                userDetails: {
                    name: userDetails.name || 'N/A',
                    phone: userDetails.phone || 'N/A',
                    email: userDetails.email || ''
                }
            }
        },
        { upsert: true, new: true }
    );

    return { success: true, bypassed: false };
}
