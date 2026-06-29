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

        // Credentials: env vars take priority, DB settings are fallback
        const username = process.env.WHATSAPP_USERNAME || settings.username;
        const password = process.env.WHATSAPP_PASSWORD || settings.password;
        const senderId = process.env.WHATSAPP_SENDER_ID || settings.senderId;

        if (!username || !password || !senderId) {
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
            user: username,
            pass: password,
            sender: senderId,
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

/**
 * Send the `coupon_code_alert` WhatsApp template to a list of users.
 * Params order: CustomerName, BrandName, CouponCode, DiscountValue, ExpiryDate
 *
 * @param {Array<{name:string, phone:string}>} users
 * @param {object} coupon  – must have: couponCode, discountValue, expiryDate
 */
export const sendPromotionalOfferToUsers = async (users, coupon) => {
    try {
        if (!Array.isArray(users) || users.length === 0) return;

        const { couponCode, discountValue, expiryDate } = coupon || {};
        if (!couponCode || discountValue == null || !expiryDate) return;

        const settings = await getWhatsappSettings();
        const apiUrl   = process.env.WHATSAPP_API_URL || 'http://bhashsms.com/api/sendmsg.php';
        const username = process.env.WHATSAPP_USERNAME || settings.username;
        const password = process.env.WHATSAPP_PASSWORD || settings.password;
        const senderId = process.env.WHATSAPP_SENDER_ID || settings.senderId;

        if (!username || !password || !senderId) {
            console.error('[WhatsApp] Promotional offer skipped: credentials not configured');
            return;
        }

        const formattedExpiry = (() => {
            try {
                const d = new Date(expiryDate);
                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
            } catch { return String(expiryDate); }
        })();

        const brandName = process.env.BRAND_NAME || process.env.APP_NAME || 'Dukaanwallah';

        // Batch send — fire and forget per user
        for (const user of users) {
            const rawMobile = String(user.phone || '').replace(/\D/g, '');
            if (!rawMobile) continue;
            const mobile = rawMobile.length === 10 ? '91' + rawMobile : rawMobile;
            if (mobile.length < 12) continue;

            const customerName = String(user.name || 'Customer').trim() || 'Customer';
            const templateParams = [customerName, brandName, couponCode, discountValue, formattedExpiry].join(',');

            const requestParams = {
                user: username,
                pass: password,
                sender: senderId,
                phone: mobile,
                text: 'coupon_code_alert',
                priority: 'wa',
                stype: 'normal',
                Params: templateParams
            };

            // Non-blocking — log and move on
            axios.get(apiUrl, { params: requestParams })
                .then(async (res) => {
                    const responseStr = typeof res.data === 'string'
                        ? res.data.toLowerCase()
                        : JSON.stringify(res.data).toLowerCase();
                    const isError = responseStr.includes('error') || responseStr.includes('invalid') || responseStr.includes('failed');
                    await WhatsappLog.create({
                        mobile: user.phone,
                        requestParams: { ...requestParams, pass: '***' },
                        response: res.data,
                        status: isError ? 'ERROR' : 'SUCCESS',
                        errorMessage: isError ? 'API returned failure response' : undefined
                    });
                })
                .catch(async (err) => {
                    console.error(`[WhatsApp] Promotional offer failed for ${mobile}: ${err.message}`);
                    try {
                        await WhatsappLog.create({
                            mobile: user.phone,
                            requestParams: { ...requestParams, pass: '***' },
                            response: err.message,
                            status: 'ERROR',
                            errorMessage: err.message
                        });
                    } catch { /* ignore log error */ }
                });
        }
    } catch (err) {
        console.error(`[WhatsApp] sendPromotionalOfferToUsers error: ${err.message}`);
    }
};

