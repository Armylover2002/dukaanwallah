import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env') });

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dukaanwallah';

async function checkDB() {
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to DB:', mongoURI);

        const adminDb = mongoose.connection.db.admin();
        const dbs = await adminDb.listDatabases();
        console.log('Databases on cluster:', dbs.databases.map(d => `${d.name} (${d.sizeOnDisk} bytes)`));

        // Let's connect to 'test' and list its collections
        const currentDbName = mongoose.connection.db.databaseName;
        console.log('Current connected DB name:', currentDbName);
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`Collections in '${currentDbName}':`, collections.map(c => c.name));

        // Connect to 'Dukaanwallah' database explicitly
        const dukaanDb = mongoose.connection.useDb('Dukaanwallah');
        const dukaanCollections = await dukaanDb.db.listCollections().toArray();
        console.log("Collections in 'Dukaanwallah':", dukaanCollections.map(c => c.name));

        const OnboardingFeeConfig = dukaanDb.model('OnboardingFeeConfig', new mongoose.Schema({}, { strict: false }), 'common_onboarding_fee_configs');
        const configs = await OnboardingFeeConfig.find().lean();
        console.log("Configs in 'Dukaanwallah':", configs);

        // Connect to 'test' explicitly and look for configs
        const testDb = mongoose.connection.useDb('test');
        const testConfigs = await testDb.model('OnboardingFeeConfig', new mongoose.Schema({}, { strict: false }), 'common_onboarding_fee_configs').find().lean();
        console.log("Configs in 'test':", testConfigs);

        await mongoose.disconnect();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkDB();
