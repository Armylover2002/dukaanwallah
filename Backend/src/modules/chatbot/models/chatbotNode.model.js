import mongoose from 'mongoose';

const chatbotOptionSchema = new mongoose.Schema({
    text: { type: String, required: true }, // Text displayed on the button
    nextNodeId: { type: String, default: null }, // ID of the next node to trigger
    action: { type: String, default: null }, // Optional backend action string
});

const chatbotNodeSchema = new mongoose.Schema(
    {
        nodeId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        message: {
            type: String,
            required: true
        },
        options: {
            type: [chatbotOptionSchema],
            default: []
        },
        keywords: {
            type: [String],
            default: []
        },
        isTerminal: {
            type: Boolean,
            default: false
        }
    },
    {
        collection: 'chatbot_nodes',
        timestamps: true
    }
);

export const ChatbotNode = mongoose.model('ChatbotNode', chatbotNodeSchema);
