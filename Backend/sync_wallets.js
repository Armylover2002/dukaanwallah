import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FoodTransaction } from './src/modules/Food/orders/models/foodTransaction.model.js';
import { FoodRestaurantWallet } from './src/modules/Food/restaurant/models/restaurantWallet.model.js';
import { FoodDeliveryWallet } from './src/modules/Food/delivery/models/deliveryWallet.model.js';

dotenv.config();

async function syncWallets() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dukaanwallah');
        console.log('Connected to DB');

        // Aggregate total earnings for each restaurant
        const restaurantEarnings = await FoodTransaction.aggregate([
            { $match: { status: { $in: ['captured', 'authorized'] } } },
            { $group: { _id: '$restaurantId', total: { $sum: '$amounts.restaurantShare' } } }
        ]);

        console.log(`Found ${restaurantEarnings.length} restaurants with earnings.`);

        for (const earning of restaurantEarnings) {
            if (earning._id && earning.total > 0) {
                await FoodRestaurantWallet.updateOne(
                    { restaurantId: earning._id },
                    { $set: { totalEarnings: earning.total } },
                    { upsert: true }
                );
            }
        }
        
        // Aggregate total earnings for each delivery partner
        const riderEarnings = await FoodTransaction.aggregate([
            { $match: { status: { $in: ['captured', 'authorized'] } } },
            { $group: { _id: '$deliveryPartnerId', total: { $sum: '$amounts.riderShare' } } }
        ]);

        console.log(`Found ${riderEarnings.length} riders with earnings.`);

        for (const earning of riderEarnings) {
            if (earning._id && earning.total > 0) {
                await FoodDeliveryWallet.updateOne(
                    { deliveryPartnerId: earning._id },
                    { $set: { totalEarnings: earning.total } },
                    { upsert: true }
                );
            }
        }

        console.log('Successfully synced total earnings to wallets!');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing:', error);
        process.exit(1);
    }
}

syncWallets();
