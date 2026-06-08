import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const FoodRestaurant = mongoose.connection.collection('food_restaurants');
        const rests = await FoodRestaurant.find({status: 'rejected'}).sort({_id: -1}).toArray();
        console.log("\nAll rejected restaurants FULL data:");
        rests.forEach(r => {
            console.log(`ID: ${r._id}, ownerPhoneDigits: ${r.ownerPhoneDigits}, ownerPhoneLast10: ${r.ownerPhoneLast10}, primaryContactNumber: ${r.primaryContactNumber}, ownerPhone: ${r.ownerPhone}`);
        });
        mongoose.disconnect();
    })
    .catch(err => {
        console.error("DB error:", err);
        process.exit(1);
    });
