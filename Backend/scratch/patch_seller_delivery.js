import fs from 'fs';

// Patch Seller
const sellerFile = 'c:\\Users\\vivek\\Desktop\\AppZeto\\dukaanwallah\\itzo\\Backend\\src\\modules\\quick-commerce\\seller\\controllers\\seller.controller.js';
let sellerContent = fs.readFileSync(sellerFile, 'utf8');
sellerContent = sellerContent.replace(
    'const existingSeller = await QuickSeller.findOne({ ownerPhoneDigits });',
    `const existingSeller = await QuickSeller.findOne({ 
      $or: [
        { ownerPhoneDigits },
        ...(ownerPhoneLast10 ? [{ ownerPhoneLast10 }] : [])
      ]
    });`
);
fs.writeFileSync(sellerFile, sellerContent);

// Patch Delivery
const deliveryFile = 'c:\\Users\\vivek\\Desktop\\AppZeto\\dukaanwallah\\itzo\\Backend\\src\\modules\\food\\delivery\\services\\delivery.service.js';
let deliveryContent = fs.readFileSync(deliveryFile, 'utf8');
deliveryContent = deliveryContent.replace(
    'const existingPartner = await FoodDeliveryPartner.findOne({ phoneDigits });',
    `const existingPartner = await FoodDeliveryPartner.findOne({ 
      $or: [
        { phoneDigits },
        ...(phoneLast10 ? [{ phoneLast10 }] : [])
      ]
    });`
);
fs.writeFileSync(deliveryFile, deliveryContent);

console.log("Patched Seller and Delivery");
