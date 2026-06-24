import mongoose from 'mongoose';

const whatsappLogSchema = new mongoose.Schema(
    {
        mobile: { type: String, required: true },
        requestParams: { type: mongoose.Schema.Types.Mixed },
        response: { type: mongoose.Schema.Types.Mixed },
        status: { type: String, enum: ['SUCCESS', 'ERROR'], required: true },
        errorMessage: { type: String }
    },
    { timestamps: true }
);

export const WhatsappLog = mongoose.model('WhatsappLog', whatsappLogSchema, 'whatsapp_logs');
