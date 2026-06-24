import { getWhatsappSettings, updateWhatsappSettings, sendWhatsAppTemplate } from '../services/whatsapp.service.js';

export const getSettings = async (req, res) => {
    try {
        const settings = await getWhatsappSettings();
        // Don't mask password here so admin can edit it if we return it as is, or we can send it and mask in UI.
        // Usually, it's better to send the password and let the frontend mask it in a password type input.
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const { username, password, senderId, defaultTemplateName } = req.body;
        const settings = await updateWhatsappSettings({
            username,
            password,
            senderId,
            defaultTemplateName
        });
        res.status(200).json({ success: true, message: 'Settings updated successfully', data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendTestMessage = async (req, res) => {
    try {
        const { mobile, customerName, orderId, items, amount, paymentMethod } = req.body;

        if (!mobile) {
            return res.status(400).json({ success: false, message: 'Mobile number is required' });
        }

        const result = await sendWhatsAppTemplate(
            mobile,
            customerName,
            orderId,
            items,
            amount,
            paymentMethod
        );

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
