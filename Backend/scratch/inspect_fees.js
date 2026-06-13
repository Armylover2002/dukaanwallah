import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';

try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (dnsErr) {
    console.warn(`Failed to set DNS servers: ${dnsErr.message}`);
}

dotenv.config({ path: path.resolve('.env') });

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dukaanwallah';

async function inspect() {
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to DB:', mongoURI);

        const db = mongoose.connection;
        const OnboardingFeeConfig = db.model(
            'OnboardingFeeConfig',
            new mongoose.Schema({}, { strict: false }),
            'common_onboarding_fee_configs'
        );

        const configs = await OnboardingFeeConfig.find().lean();
        console.log('Onboarding configs:');
        console.log(JSON.stringify(configs, null, 2));

        const OnboardingPaymentLog = db.model(
            'OnboardingPaymentLog',
            new mongoose.Schema({}, { strict: false }),
            'common_onboarding_payment_logs'
        );
        const logs = await OnboardingPaymentLog.find().sort({createdAt: -1}).limit(5).lean();
        console.log('Recent payment logs:');
        console.log(JSON.stringify(logs, null, 2));

        await mongoose.disconnect();
    } catch (e) {
        console.error('Error:', e);
    }
}

inspect();
