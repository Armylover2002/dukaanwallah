import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dukaanwallah')
  .then(async () => {
    const products = await mongoose.connection.collection('quick_products').find().limit(5).toArray();
    console.log(JSON.stringify(products.map(p => ({
       id: p._id,
       name: p.name,
       stock: p.stock,
       variants: p.variants
    })), null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
