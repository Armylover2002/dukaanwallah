import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const FoodRestaurant = mongoose.connection.collection('food_restaurants');
        const ownerPhoneDigits = "918450062012";
        const ownerPhoneLast10 = "8450062012";
        
        const existingRestaurant = await FoodRestaurant.findOne({ 
            $or: [
                { ownerPhoneDigits },
                ...(ownerPhoneLast10 ? [{ ownerPhoneLast10 }] : [])
            ]
        });
        
        console.log("Found:", existingRestaurant ? "YES" : "NO");
        if (existingRestaurant) console.log(existingRestaurant);
        
        mongoose.disconnect();
    })
    .catch(err => {
        console.error("DB error:", err);
        process.exit(1);
    });
