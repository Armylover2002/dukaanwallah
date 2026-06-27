import axios from 'axios';
import { WhatsappSettings } from '../models/whatsappSettings.model.js';
import { WhatsappLog } from '../models/whatsappLog.model.js';

export const getWhatsappSettings = async () => {
    let settings = await WhatsappSettings.findOne();
    if (!settings) {
        settings = await WhatsappSettings.create({
            username: '',
            password: '',
            senderId: 'BUZWAP',
            defaultTemplateName: 'order_confirmation'
        });
    }
    return settings;
};

export const updateWhatsappSettings = async (data) => {
    let settings = await WhatsappSettings.findOne();
    if (settings) {
        Object.assign(settings, data);
        await settings.save();
    } else {
        settings = await WhatsappSettings.create(data);
    }
    return settings;
};

export const sendWhatsAppTemplate = async (
    mobile,
    customerName,
    orderId,
    items,
    totalAmount,
    paymentMethod
) => {
    try {
        // Validate mobile
        if (!mobile) {
            throw new Error('Mobile number is required');
        }

        const settings = await getWhatsappSettings();
        const apiUrl = process.env.WHATSAPP_API_URL || 'http://bhashsms.com/api/sendmsg.php';

        if (!settings.username || !settings.password || !settings.senderId) {
            throw new Error('WhatsApp API credentials are not fully configured');
        }

        // Format mobile number to ensure it has country code (e.g., 91)
        let formattedMobile = String(mobile).replace(/\D/g, '');
        if (formattedMobile.length === 10) {
            formattedMobile = '91' + formattedMobile;
        }

        // Build Params string (comma separated)
        const templateParams = [
            customerName || '',
            orderId || '',
            items || '',
            totalAmount || '',
            paymentMethod || ''
        ].join(',');

        const requestParams = {
            user: settings.username,
            pass: settings.password,
            sender: settings.senderId,
            phone: formattedMobile,
            text: process.env.WHATSAPP_DEFAULT_TEMPLATE_NAME || 'order_confirmation',
            priority: 'wa',
            stype: 'normal',
            Params: templateParams
        };

        let apiResponse = null;
        try {
            const response = await axios.get(apiUrl, { params: requestParams });
            apiResponse = response.data;

            const responseStr = typeof apiResponse === 'string' ? apiResponse.toLowerCase() : JSON.stringify(apiResponse).toLowerCase();
            const isErrorResponse = responseStr.includes('error') || responseStr.includes('not activated') || responseStr.includes('failed') || responseStr.includes('invalid');

            if (isErrorResponse) {
                // Log failure based on response body
                await WhatsappLog.create({
                    mobile,
                    requestParams: { ...requestParams, pass: '***' },
                    response: apiResponse,
                    status: 'ERROR',
                    errorMessage: 'API returned failure response'
                });

                return {
                    success: false,
                    message: `BhashSMS API Error: ${apiResponse}`,
                    response: apiResponse
                };
            }

            // Log success
            await WhatsappLog.create({
                mobile,
                requestParams: { ...requestParams, pass: '***' }, // Mask password in logs
                response: apiResponse,
                status: 'SUCCESS'
            });

            return {
                success: true,
                message: 'WhatsApp message sent successfully',
                response: apiResponse
            };
        } catch (apiError) {
            // Log API error
            await WhatsappLog.create({
                mobile,
                requestParams: { ...requestParams, pass: '***' },
                response: apiError.response?.data || apiError.message,
                status: 'ERROR',
                errorMessage: apiError.message
            });
            throw new Error(`WhatsApp API Error: ${apiError.message}`);
        }
    } catch (error) {
        return {
            success: false,
            message: error.message,
            response: null
        };
    }
};
