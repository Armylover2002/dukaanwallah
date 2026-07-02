import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { FoodOrder } from './src/modules/food/orders/models/order.model.js';

async function checkOrder() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const order = await FoodOrder.findOne({ orderId: 'QC92895640' }).lean();
        console.log(JSON.stringify({
            items: order.items,
            pickupPoints: order.pickupPoints,
            restaurantId: order.restaurantId,
            zoneId: order.zoneId
        }, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkOrder();
