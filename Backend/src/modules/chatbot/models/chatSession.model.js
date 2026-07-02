import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
    sender: { type: String, enum: ['user', 'bot'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const chatSessionSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true
        },
        module: {
            type: String,
            enum: ['user', 'restaurant', 'seller', 'admin', 'delivery'],
            default: 'user'
        },
        userType: {
            type: String,
            enum: ['FoodUser', 'Seller', 'DeliveryPartner'],
            default: 'FoodUser'
        },
        messages: {
            type: [chatMessageSchema],
            default: []
        },
        currentNodeId: {
            type: String,
            default: 'root'
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        collection: 'chatbot_sessions',
        timestamps: true
    }
);

export const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
