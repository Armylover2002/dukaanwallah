
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { FoodDailyPass } from './src/modules/food/subscriptions/models/foodDailyPass.model.js';
import { UserSubscription } from './src/modules/food/user/models/userSubscription.model.js';
import { FoodDeliveryPartner } from './src/modules/food/delivery/models/deliveryPartner.model.js';
import { FoodDeliveryWallet } from './src/modules/food/delivery/models/deliveryWallet.model.js';
import * as walletService from './src/modules/food/subscriptions/services/wallet.service.js';
import * as dispatchService from './src/modules/food/orders/services/order-dispatch.service.js';
import * as deliveryOrderService from './src/modules/food/orders/services/order-delivery.service.js';
import { config } from './src/config/env.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TIMEZONE = 'Asia/Kolkata';

async function runTests() {
    console.log("--- STARTING FINAL RUNTIME AUDIT ---");
    
    const MONGO_URI = config.mongodbUri;
    try {
        await mongoose.connect(MONGO_URI, { family: 4 });
    } catch (e) {
        console.log("Could not connect to MongoDB. Error: " + e.message);
        return;
    }
    console.log("Connected to MongoDB.");

    const TEST_RIDER_ID = new mongoose.Types.ObjectId();
    const TODAY_STR = dayjs().tz(IST_TIMEZONE).format('YYYY-MM-DD');

    try {
        // --- TEST 1: STALE ONLINE BUG (Dispatcher Filter) ---
        console.log("\n[TEST 1] STALE ONLINE BUG (EXPIRED PASS)");
        
        // Setup: Create a pass that is for "TODAY" but EXPIRED 1 hour ago
        const expiredTime = new Date(Date.now() - 3600000); 
        await FoodDailyPass.create({
            userId: TEST_RIDER_ID,
            userType: 'DELIVERY_PARTNER',
            date: TODAY_STR,
            amountDeducted: 20,
            expiresAt: expiredTime
        });
        console.log(`Created Expired Pass for ${TEST_RIDER_ID} (Expires: ${expiredTime.toISOString()})`);

        const partners = [{ partnerId: TEST_RIDER_ID, distanceKm: 5 }];
        const filtered = await dispatchService.filterEligiblePartners(partners);
        
        console.log("Dispatcher Filter Result Count:", filtered.length);
        if (filtered.length === 0) {
            console.log("✅ SUCCESS: Expired pass rider filtered out. (Stale Online Bug Fixed)");
        } else {
            console.log("❌ FAILED: Expired pass rider STILL INCLUDED. (Stale Online Bug Persistent)");
        }

        // --- TEST 2: ACCEPT ORDER BLOCK ---
        console.log("\n[TEST 2] ACCEPT ORDER BLOCK");
        try {
            // Balance is 0 here by default since we haven't created a wallet yet
            await deliveryOrderService.acceptOrderDelivery(new mongoose.Types.ObjectId(), TEST_RIDER_ID);
            console.log("❌ FAILED: Acceptance NOT blocked.");
        } catch (err) {
            console.log("Caught Error:", err.message);
            if (err.message.includes("Subscription expired") || err.message.includes("activate a pass")) {
                console.log("✅ SUCCESS: Acceptance blocked correctly.");
            } else {
                console.log("❌ FAILED: Blocked but with wrong message.");
            }
        }

        // --- TEST 3: DUPLICATE DEDUCTION PROTECTION ---
        console.log("\n[TEST 3] DUPLICATE DEDUCTION PROTECTION (Concurrency Test)");
        
        // Clean up previous pass
        await FoodDailyPass.deleteMany({ userId: TEST_RIDER_ID });
        
        // Setup Wallet with enough balance
        await FoodDeliveryWallet.create({
            deliveryPartnerId: TEST_RIDER_ID,
            subscriptionBalance: 2000
        });

        console.log("Simulating 5 CONCURRENT activateDailyPass calls...");
        // activateDailyPass usually does the actual deduction and pass creation
        const results = await Promise.allSettled([
            walletService.activateDailyPass(TEST_RIDER_ID, 'DELIVERY_PARTNER'),
            walletService.activateDailyPass(TEST_RIDER_ID, 'DELIVERY_PARTNER'),
            walletService.activateDailyPass(TEST_RIDER_ID, 'DELIVERY_PARTNER'),
            walletService.activateDailyPass(TEST_RIDER_ID, 'DELIVERY_PARTNER'),
            walletService.activateDailyPass(TEST_RIDER_ID, 'DELIVERY_PARTNER')
        ]);

        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');
        
        console.log("Fulfilled (Success):", fulfilled.length);
        console.log("Rejected (Blocked):", rejected.length);
        
        const passCountInDb = await FoodDailyPass.countDocuments({ userId: TEST_RIDER_ID, date: TODAY_STR });
        console.log("Final Passes in DB:", passCountInDb);
        
        if (passCountInDb === 1) {
            console.log("✅ SUCCESS: Duplicate deduction prevented. Only 1 pass created.");
        } else {
            console.log("❌ FAILED: Multiple passes created!");
        }

    } finally {
        // Cleanup
        await FoodDailyPass.deleteMany({ userId: TEST_RIDER_ID });
        await FoodDeliveryWallet.deleteMany({ deliveryPartnerId: TEST_RIDER_ID });
        await mongoose.disconnect();
        console.log("\n--- AUDIT COMPLETE ---");
    }
}

runTests().catch(err => {
    console.error("Audit Runtime Error:", err);
    process.exit(1);
});
