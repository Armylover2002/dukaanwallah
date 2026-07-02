import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Seller } from './src/modules/quick-commerce/seller/models/seller.model.js';
import { FoodRestaurant } from './src/modules/food/restaurants/models/restaurant.model.js';

async function checkSeller() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const seller = await Seller.findById('6a43b691f9e00bca72c7202d').lean();
        const restaurant = await FoodRestaurant.findById('6a43b691f9e00bca72c7202d').lean();
        console.log('Seller:', seller ? seller.storeName || seller.name || seller.businessName : 'Not found');
        console.log('Restaurant:', restaurant ? restaurant.name : 'Not found');
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkSeller();
