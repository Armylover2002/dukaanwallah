import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env') });

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dukaanwallah';

async function activateFees() {
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to DB:', mongoURI);

        const testDb = mongoose.connection.useDb('test');
        const OnboardingFeeConfig = testDb.model(
            'OnboardingFeeConfig',
            new mongoose.Schema({}, { strict: false }),
            'common_onboarding_fee_configs'
        );

        const result = await OnboardingFeeConfig.updateMany(
            {},
            { $set: { isActive: true } }
        );

        console.log('Update result:', result);

        const configs = await OnboardingFeeConfig.find().lean();
        console.log('Updated configurations:', configs);

        await mongoose.disconnect();
    } catch (e) {
        console.error('Error:', e);
    }
}

activateFees();
