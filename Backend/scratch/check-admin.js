import mongoose from 'mongoose';
import { FoodAdmin } from '../src/core/admin/admin.model.js';
import { config } from '../src/config/env.js';

async function run() {
    try {
        await mongoose.connect(config.mongodbUri);
        const admins = await FoodAdmin.find({}, 'email roleId').lean();
        console.log('Admins found:', admins);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
