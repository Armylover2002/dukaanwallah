
import mongoose from 'mongoose';
import { createTopupOrder } from './Backend/src/modules/food/subscriptions/services/wallet.service.js';
import { FoodDeliveryWallet } from './Backend/src/modules/delivery/models/deliveryWallet.model.js';

async function runTest() {
    console.log("=== WALLET PARITY RUNTIME TEST ===");
    
    // Connect to DB
    await mongoose.connect('mongodb://localhost:27017/itzo');
    
    const testPartnerId = new mongoose.Types.ObjectId();
    const userType = 'DELIVERY_PARTNER';

    try {
        // Setup: Balance = 500
        console.log("\n[SETUP] Setting balance to ₹500 for test partner...");
        await FoodDeliveryWallet.create({
            deliveryPartnerId: testPartnerId,
            subscriptionBalance: 500
        });

        const testCases = [
            { amount: 400, expected: 'fail', label: 'CASE 2: Balance 500 + Add 400 = 900 (Below 1000)' },
            { amount: 500, expected: 'pass', label: 'CASE 3: Balance 500 + Add 500 = 1000 (Exact 1000)' },
            { amount: 600, expected: 'pass', label: 'CASE 4: Balance 500 + Add 600 = 1100 (Above 1000)' }
        ];

        for (const tc of testCases) {
            console.log(`\n[TEST] ${tc.label}`);
            try {
                const order = await createTopupOrder(testPartnerId, userType, tc.amount);
                if (tc.expected === 'fail') {
                    console.error("❌ FAILED: Expected validation error but request passed.");
                } else {
                    console.log("✅ PASSED: Order created successfully.");
                }
            } catch (err) {
                if (tc.expected === 'fail') {
                    console.log(`✅ PASSED: Blocked as expected. Error: ${err.message}`);
                } else {
                    console.error(`❌ FAILED: Expected success but got error: ${err.message}`);
                }
            }
        }

        // Setup: Balance = 1200
        console.log("\n[SETUP] Setting balance to ₹1200 (Already above 1000)...");
        await FoodDeliveryWallet.updateOne({ deliveryPartnerId: testPartnerId }, { subscriptionBalance: 1200 });

        console.log("\n[TEST] CASE 5: Balance 1200 + Add 200 = 1400 (Any amount allowed)");
        try {
            await createTopupOrder(testPartnerId, userType, 200);
            console.log("✅ PASSED: Order created successfully.");
        } catch (err) {
            console.error(`❌ FAILED: Expected success but got error: ${err.message}`);
        }

    } finally {
        // Cleanup
        await FoodDeliveryWallet.deleteOne({ deliveryPartnerId: testPartnerId });
        await mongoose.disconnect();
    }
}

runTest();
