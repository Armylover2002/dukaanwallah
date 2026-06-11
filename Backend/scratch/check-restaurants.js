import mongoose from 'mongoose';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodRestaurantOutletTimings } from '../src/modules/food/restaurant/models/outletTimings.model.js';
import { config } from '../src/config/env.js';

async function run() {
    try {
        await mongoose.connect(config.mongodbUri);
        const r = await FoodRestaurant.findOne({ restaurantId: 'REST000005' }).lean();
        if (r) {
            const timing = await FoodRestaurantOutletTimings.findOne({ restaurantId: r._id }).lean();
            console.log('Restaurant:', r.restaurantName);
            console.log('Timings:', JSON.stringify(timing, null, 2));
        } else {
            console.log('Restaurant not found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
