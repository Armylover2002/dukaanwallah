import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI;

const quickCategorySchema = new mongoose.Schema({
  name: { type: String },
  type: { type: String },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'quick_category' }
});

const QuickCategory = mongoose.model('quick_category', quickCategorySchema, 'quick_categories');

async function main() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'Dukaanwallah' });
    
    const categories = await QuickCategory.find({}).lean();
    
    // Group by type
    const headers = categories.filter(c => c.type === 'header' || !c.type || c.type === 'main');
    const specificCategories = categories.filter(c => c.type === 'category');
    const subCategories = categories.filter(c => c.type === 'subcategory');
    
    // Let's print hierarchical tree
    console.log('--- HIERARCHY TREE ---');
    headers.forEach(h => {
      console.log(`* ${h.name}`);
      const children = specificCategories.filter(c => String(c.parentId) === String(h._id));
      children.forEach(c => {
        console.log(`   └─ ${c.name}`);
        const subChildren = subCategories.filter(s => String(s.parentId) === String(c._id));
        subChildren.forEach(s => {
          console.log(`       └─ ${s.name}`);
        });
      });
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
