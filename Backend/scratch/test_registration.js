import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env') });

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dukaanwallah';

async function testRegistration() {
    try {
        await mongoose.connect(mongoURI);
        
        // Find a zone
        const testDb = mongoose.connection.useDb('test');
        const FoodZone = testDb.model('FoodZone', new mongoose.Schema({}, { strict: false }), 'food_zones');
        const zone = await FoodZone.findOne().lean();
        
        if (!zone) {
            console.error('No food zone found in DB.');
            await mongoose.disconnect();
            return;
        }
        
        console.log('Using Zone ID:', zone._id, 'Name:', zone.name);
        
        // Calculate the centroid to get a point strictly inside the polygon
        let lat = 0;
        let lng = 0;
        if (zone.coordinates && zone.coordinates.length > 0) {
            let sumLat = 0;
            let sumLng = 0;
            zone.coordinates.forEach(pt => {
                sumLat += (pt.latitude || pt.lat || 0);
                sumLng += (pt.longitude || pt.lng || 0);
            });
            lat = sumLat / zone.coordinates.length;
            lng = sumLng / zone.coordinates.length;
        }
        
        console.log('Centroid coordinates:', lat, lng);
        
        // Prepare FormData
        const formData = new FormData();
        formData.append("restaurantName", "Test Restaurant");
        formData.append("pureVegRestaurant", "true");
        formData.append("ownerName", "John Doe");
        formData.append("ownerEmail", "john.doe@gmail.com");
        formData.append("ownerPhone", "9876543210");
        formData.append("primaryContactNumber", "9876543210");
        formData.append("zoneId", String(zone._id));
        formData.append("addressLine1", "123 Street");
        formData.append("area", "Sector 1");
        formData.append("city", "Test City");
        formData.append("pincode", "123456");
        formData.append("formattedAddress", "123 Street, Sector 1, Test City, 123456");
        formData.append("latitude", String(lat));
        formData.append("longitude", String(lng));
        formData.append("cuisines", "North Indian, South Indian");
        formData.append("openingTime", "09:00");
        formData.append("closingTime", "21:00");
        formData.append("openDays", "Mon,Tue,Wed,Thu,Fri,Sat,Sun");
        
        // 1x1 transparent PNG buffer
        const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        const emptyFile = new Blob([pngBuffer], { type: 'image/png' });
        
        formData.append("profileImage", emptyFile, "profile.png");
        formData.append("panImage", emptyFile, "pan.png");
        formData.append("gstImage", emptyFile, "gst.png");
        formData.append("fssaiImage", emptyFile, "fssai.png");
        formData.append("menuImages", emptyFile, "menu1.png");
        
        formData.append("panNumber", "ABCDE1234F");
        formData.append("nameOnPan", "John Doe");
        formData.append("gstRegistered", "false");
        formData.append("fssaiNumber", "12345678901234");
        formData.append("fssaiExpiry", "2030-12-31");
        formData.append("accountNumber", "1234567890");
        formData.append("ifscCode", "ABCD0123456");
        formData.append("accountHolderName", "John Doe");
        formData.append("accountType", "Saving");
        formData.append("estimatedDeliveryTime", "30-40 mins");
        formData.append("featuredDish", "Paneer Tikka");
        
        const response = await fetch('http://localhost:5000/api/v1/food/restaurant/register', {
            method: 'POST',
            body: formData
        });
        
        const resJson = await response.json();
        console.log('Registration Response Status:', response.status);
        console.log('Response body:', JSON.stringify(resJson, null, 2));
        
        await mongoose.disconnect();
    } catch (e) {
        console.error('Error testing registration:', e);
    }
}

testRegistration();
