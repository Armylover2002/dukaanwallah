import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dukaanwallah';

async function inspect() {
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to DB:', mongoURI);

        const db = mongoose.connection;
        const FoodDeliveryPartner = db.model(
            'FoodDeliveryPartner',
            new mongoose.Schema({}, { strict: false }),
            'food_delivery_partners'
        );

        // Find recent partners
        const partners = await FoodDeliveryPartner.find().sort({createdAt: -1}).limit(5).lean();
        console.log('Recent delivery partners:');
        console.log(JSON.stringify(partners.map(p => ({
            _id: p._id,
            name: p.name,
            phone: p.phone,
            status: p.status,
            createdAt: p.createdAt
        })), null, 2));

        // Search specifically for Vivek's phone numbers
        const phones = ['8494646464', '6464666494', '4994646794'];
        for (const phone of phones) {
            const match = await FoodDeliveryPartner.findOne({ phone }).lean();
            console.log(`Search for phone ${phone}:`, match ? {
                _id: match._id,
                name: match.name,
                phone: match.phone,
                status: match.status
            } : 'Not found');
        }

        await mongoose.disconnect();
    } catch (e) {
        console.error('Error:', e);
    }
}

inspect();
