import mongoose from 'mongoose';
import { ChatbotNode } from '../models/chatbotNode.model.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const seedData = [
    {
        nodeId: 'root',
        message: 'Hello! I am your Dukaanwallah Assistant. How can I help you today?',
        options: [
            { text: 'Orders & Tracking', nextNodeId: 'orders_menu' },
            { text: 'Payments & Refunds', nextNodeId: 'payments_menu' },
            { text: 'FAQs', nextNodeId: 'faqs_menu' },
            { text: 'Talk to an Agent', nextNodeId: 'agent' }
        ],
        keywords: ['hi', 'hello', 'hey', 'start', 'menu', 'help']
    },
    {
        nodeId: 'orders_menu',
        message: 'What do you need help with regarding your orders?',
        options: [
            { text: 'Track my recent order', nextNodeId: 'track_order', action: 'FETCH_RECENT_ORDER' },
            { text: 'Report an issue with an order', nextNodeId: 'order_issue' },
            { text: 'Go Back', nextNodeId: 'root' }
        ],
        keywords: ['order', 'orders', 'tracking', 'where is my order']
    },
    {
        nodeId: 'track_order',
        message: 'Fetching your most recent order status...',
        options: [
            { text: 'Main Menu', nextNodeId: 'root' }
        ],
        isTerminal: true
    },
    {
        nodeId: 'order_issue',
        message: 'We apologize for the inconvenience. Please select the order you have an issue with from your orders page, or type your issue here and an agent will contact you.',
        options: [
            { text: 'Main Menu', nextNodeId: 'root' }
        ],
        isTerminal: true
    },
    {
        nodeId: 'payments_menu',
        message: 'Do you need help with payments or refunds?',
        options: [
            { text: 'Where is my refund?', nextNodeId: 'refund_status' },
            { text: 'Payment failed', nextNodeId: 'payment_failed' },
            { text: 'Go Back', nextNodeId: 'root' }
        ],
        keywords: ['payment', 'payments', 'refund', 'money']
    },
    {
        nodeId: 'refund_status',
        message: 'Refunds usually take 5-7 business days to reflect in your original payment method. If it has been longer, please contact support.',
        options: [
            { text: 'Main Menu', nextNodeId: 'root' }
        ],
        isTerminal: true
    },
    {
        nodeId: 'payment_failed',
        message: 'If money was deducted but the order failed, it will be automatically refunded within 24-48 hours.',
        options: [
            { text: 'Main Menu', nextNodeId: 'root' }
        ],
        isTerminal: true
    },
    {
        nodeId: 'faqs_menu',
        message: 'Here are some frequently asked questions:',
        options: [
            { text: 'How do I use a coupon?', nextNodeId: 'faq_coupon' },
            { text: 'Delivery timings', nextNodeId: 'faq_delivery' },
            { text: 'Go Back', nextNodeId: 'root' }
        ],
        keywords: ['faq', 'questions', 'how to']
    },
    {
        nodeId: 'faq_coupon',
        message: 'You can apply coupons at the checkout page. Valid coupons will be displayed based on your cart.',
        options: [
            { text: 'Main Menu', nextNodeId: 'root' }
        ],
        isTerminal: true,
        keywords: ['coupon', 'discount', 'promo']
    },
    {
        nodeId: 'faq_delivery',
        message: 'Food delivery usually takes 30-45 minutes. Quick commerce (pantry) items are delivered in 10-20 minutes.',
        options: [
            { text: 'Main Menu', nextNodeId: 'root' }
        ],
        isTerminal: true,
        keywords: ['delivery', 'time', 'how long']
    },
    {
        nodeId: 'agent',
        message: 'Connecting you to the next available human agent. Please wait...',
        options: [],
        isTerminal: true,
        keywords: ['agent', 'human', 'customer care', 'support']
    },
    {
        nodeId: 'fallback',
        message: 'I am sorry, I didn\'t quite understand that. Please select one of the options below.',
        options: [
            { text: 'Orders', nextNodeId: 'orders_menu' },
            { text: 'Payments', nextNodeId: 'payments_menu' },
            { text: 'FAQs', nextNodeId: 'faqs_menu' }
        ]
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        await ChatbotNode.deleteMany({});
        console.log('Cleared existing Chatbot Nodes');

        await ChatbotNode.insertMany(seedData);
        console.log('Successfully seeded Chatbot Nodes');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedDB();
