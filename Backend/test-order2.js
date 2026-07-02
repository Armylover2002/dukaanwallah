import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { FoodOrder } from './src/modules/food/orders/models/order.model.js';

async function checkOrder() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const order = await FoodOrder.findOne({ orderId: 'QC92895640' })
            .populate('restaurantId')
            .lean();
        console.log('restaurantId populated:', JSON.stringify(order.restaurantId, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkOrder();
