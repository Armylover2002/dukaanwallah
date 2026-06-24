import mongoose from 'mongoose';

const whatsappSettingsSchema = new mongoose.Schema(
    {
        username: { type: String, default: '' },
        password: { type: String, default: '' },
        senderId: { type: String, default: 'BUZWAP' },
        defaultTemplateName: { type: String, default: 'order_confirmation' }
    },
    { timestamps: true }
);

export const WhatsappSettings = mongoose.model('WhatsappSettings', whatsappSettingsSchema, 'whatsapp_settings');
