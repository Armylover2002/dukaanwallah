const mongoose = require('mongoose');
const fs = require('fs');

mongoose.connect('mongodb://localhost:27017/dukaanwallah', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  const db = mongoose.connection.useDb('dukaanwallah');
  const rules = await db.collection('quick_delivery_commission_rules').find({}).toArray();
  fs.writeFileSync('rules_output.json', JSON.stringify(rules, null, 2));
  console.log("Done");
  mongoose.disconnect();
}).catch(console.error);
