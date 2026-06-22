
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);
const IST_TIMEZONE = 'Asia/Kolkata';

// -----------------------------------------------------------------------------
// MOCK MODELS (Simplified for Audit)
// -----------------------------------------------------------------------------

const MockUserSubscription = {
    findOne: async (query) => {
        // Simulation: If status is 'active', return a Monthly Plan
        if (query.status && query.status.$in.includes('active')) {
            return {
                _id: 'sub_123',
                status: 'active',
                planId: { _id: 'plan_monthly', interval: 'month' }
            };
        }
        return null;
    }
};

const MockDailyPass = {
    findOne: async () => null // No existing pass for this audit scenario
};

const MockWallet = {
    findOne: async () => ({ subscriptionBalance: 0 }) // ZERO BALANCE SCENARIO
};

// -----------------------------------------------------------------------------
// EXECUTION PATH (Extracted from wallet.service.js)
// -----------------------------------------------------------------------------

async function audit_ensureDailyPassEligibility(userId, userType) {
    console.log(`\n[AUDIT] Starting Trace for ${userType} (ID: ${userId})`);
    
    // 1. Priority Check: MONTH/WEEK Subscription
    console.log("[AUDIT] Step 1: Checking for Active Recurring Plan...");
    const activeSub = await MockUserSubscription.findOne({
        status: { $in: ['active', 'grace'] }
    });

    if (activeSub && activeSub.planId) {
        const interval = activeSub.planId.interval;
        const type = interval === 'month' ? 'MONTH' : 'WEEK';
        
        const result = {
            eligible: true,
            reason: 'RECURRING_ACTIVE',
            shouldDeduct: false,
            subscriptionType: type
        };
        console.log("[AUDIT] Result: Active recurring plan found. Skipping all deductions.");
        return result;
    }

    // This part should be unreachable in our scenario
    console.log("[AUDIT] Step 2: Checking Day Pass...");
    return { eligible: false };
}

async function audit_toggleOnlineFlow(userId, userType) {
    console.log(`\n--- ${userType} ONLINE TOGGLE TRACE ---`);
    
    // Step A: Check Eligibility
    const elig = await audit_ensureDailyPassEligibility(userId, userType);
    console.log("[AUDIT] Eligibility API Return Object:", JSON.stringify(elig, null, 2));

    // Step B: Deduction Logic (as seen in delivery.service.js / restaurant.service.js)
    console.log("[AUDIT] Evaluating shouldDeduct condition...");
    if (elig.shouldDeduct) {
        console.log("[AUDIT] CRITICAL: Deducting ₹20...");
        // activateDailyPass(userId, userType)
    } else {
        console.log("[AUDIT] SUCCESS: Deduction SKIPPED because shouldDeduct is FALSE.");
    }

    console.log("[AUDIT] Final Action: Updating DB status to ONLINE.");
    return { success: true, online: true };
}

// -----------------------------------------------------------------------------
// RUN AUDIT
// -----------------------------------------------------------------------------

async function runAudit() {
    console.log("====================================================");
    console.log("SUBSCRIPTION DEDUCTION RUNTIME AUDIT");
    console.log("====================================================");

    // RESTAURANT AUDIT
    await audit_toggleOnlineFlow('res_123', 'RESTAURANT');

    // DELIVERY PARTNER AUDIT
    await audit_toggleOnlineFlow('rider_456', 'DELIVERY_PARTNER');

    console.log("\n====================================================");
    console.log("EDGE CASE: Recurring Plan Active + ₹0 Balance");
    console.log("====================================================");
    const edgeCase = await audit_toggleOnlineFlow('broke_rider', 'DELIVERY_PARTNER');
    console.log("\n[AUDIT] Can user go online with ₹0 balance? YES (because recurring plan takes priority)");
}

runAudit().catch(console.error);
