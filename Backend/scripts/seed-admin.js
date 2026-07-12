import mongoose from 'mongoose';
import 'dotenv/config';
import { FoodAdmin } from '../src/core/admin/admin.model.js';

const seedAdmin = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dukaanwallah';
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const adminEmail = 'admin@gmail.com';
        const password = 'admin123';

        let admin = await FoodAdmin.findOne({ email: adminEmail });
        if (admin) {
            console.log(`Admin user ${adminEmail} already exists.`);
            admin.password = password;

            if (!admin.servicesAccess || !admin.servicesAccess.includes('quickCommerce')) {
                admin.servicesAccess = ['food', 'quickCommerce'];
            }

            await admin.save();
            console.log(`Admin password reset to: ${password}`);
        } else {
            admin = new FoodAdmin({
                name: 'Super Admin',
                email: adminEmail,
                password: password,
                role: 'ADMIN',
                isActive: true,
                servicesAccess: ['food', 'quickCommerce']
            });
            await admin.save();
            console.log(`Successfully created admin user: ${adminEmail} with password: ${password}`);
        }

    } catch (error) {
        console.error('Error seeding admin:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

seedAdmin();
