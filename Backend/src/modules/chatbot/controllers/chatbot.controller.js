import mongoose from 'mongoose';
import { ChatbotNode } from '../models/chatbotNode.model.js';
import { ChatSession } from '../models/chatSession.model.js';
import { FoodOrder } from '../../food/orders/models/order.model.js';
import { GlobalSettings } from '../../common/models/settings.model.js';

// =====================================================================
// STATUS DISPLAY MAPS
// =====================================================================
const ORDER_STATUS_MAP = {
    placed:                 { label: 'Order Placed',            emoji: '✅' },
    created:                { label: 'Order Created',           emoji: '📝' },
    scheduled:              { label: 'Scheduled',               emoji: '🗓️' },
    confirmed:              { label: 'Confirmed by Restaurant', emoji: '✅' },
    preparing:              { label: 'Being Prepared',          emoji: '👨‍🍳' },
    ready_for_pickup:       { label: 'Ready for Pickup',        emoji: '📦' },
    picked_up:              { label: 'Picked Up',               emoji: '🛵' },
    delivered:              { label: 'Delivered',               emoji: '🏠' },
    cancelled_by_user:      { label: 'Cancelled by You',        emoji: '❌' },
    cancelled_by_restaurant:{ label: 'Cancelled by Restaurant', emoji: '❌' },
    cancelled_by_admin:     { label: 'Cancelled by Admin',      emoji: '❌' },
};

// Statuses that are "active" / in-progress
const ACTIVE_STATUSES = ['placed', 'created', 'scheduled', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up'];

// =====================================================================
// HARDCODED DECISION TREE (works even if DB not seeded)
// =====================================================================
const NODES = {
    root: {
        nodeId: 'root',
        message: "Hello! 👋 I'm your Dukaanwallah Assistant. How can I help you today?",
        options: [
            { text: '📦 Orders & Tracking', nextNodeId: 'orders_menu', action: null },
            { text: '💳 Payments & Refunds', nextNodeId: 'payments_menu', action: null },
            { text: '🏷️ Coupons & Offers', nextNodeId: 'coupons_menu', action: null },
            { text: '🛒 Pantry & Delivery', nextNodeId: 'pantry_menu', action: null },
            { text: '❓ FAQs', nextNodeId: 'faqs_menu', action: null },
            { text: '🧑‍💼 Talk to an Agent', nextNodeId: 'agent', action: 'FETCH_AGENT_CONTACT' },
        ],
        keywords: ['hi', 'hello', 'hey', 'start', 'menu', 'help', 'back', 'main'],
        isTerminal: false,
    },

    // ── ORDERS ─────────────────────────────────────────────────────────
    orders_menu: {
        nodeId: 'orders_menu',
        message: '📦 What do you need help with regarding your orders?',
        options: [
            { text: '🔍 Track my latest order', nextNodeId: 'track_order', action: 'FETCH_LATEST_ORDER' },
            { text: '❌ Cancel an order', nextNodeId: 'cancel_order', action: null },
            { text: '⚠️ Wrong / missing items', nextNodeId: 'wrong_items', action: null },
            { text: '📋 View order history', nextNodeId: 'order_history', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['order', 'orders', 'track', 'tracking', 'where is my order', 'delivery status'],
        isTerminal: false,
    },
    track_order: {
        nodeId: 'track_order',
        message: '🔍 Fetching your latest order details...',
        options: [
            { text: '📦 More Order Help', nextNodeId: 'orders_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['track', 'status', 'location', 'where', 'live'],
        isTerminal: false,
    },
    cancel_order: {
        nodeId: 'cancel_order',
        message: '❌ Orders can be cancelled within **5 minutes** of placing them.\n\nGo to My Orders → Select Order → Cancel.\n\nIf the window has passed, please contact our support team.',
        options: [
            { text: '📦 More Order Help', nextNodeId: 'orders_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['cancel', 'cancellation', 'abort', 'stop order'],
        isTerminal: true,
    },
    wrong_items: {
        nodeId: 'wrong_items',
        message: "⚠️ We're sorry about the incorrect or missing items!\n\nPlease tap **Report Issue** on your order in the app. Our team will review and issue a refund or replacement within 24 hours.",
        options: [
            { text: '💰 Refund Status', nextNodeId: 'refund_status', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['wrong item', 'missing item', 'incorrect', 'not delivered', 'damaged'],
        isTerminal: true,
    },
    order_history: {
        nodeId: 'order_history',
        message: '📋 You can view all your past orders by going to **Profile → My Orders**. Each order shows its status, items, and invoice.',
        options: [
            { text: '📦 More Order Help', nextNodeId: 'orders_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['history', 'past orders', 'previous orders', 'old orders'],
        isTerminal: true,
    },

    // ── PAYMENTS & REFUNDS ─────────────────────────────────────────────
    payments_menu: {
        nodeId: 'payments_menu',
        message: '💳 Do you need help with payments or refunds?',
        options: [
            { text: '💰 Where is my refund?', nextNodeId: 'refund_status', action: null },
            { text: '❌ Payment failed', nextNodeId: 'payment_failed', action: null },
            { text: '📄 Download invoice', nextNodeId: 'invoice', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['payment', 'payments', 'refund', 'money', 'pay', 'paid', 'charge', 'billing'],
        isTerminal: false,
    },
    refund_status: {
        nodeId: 'refund_status',
        message: '💰 Refunds are processed within **5–7 business days** to your original payment method.\n\n• UPI / Wallets: 1–3 days\n• Credit/Debit Card: 5–7 days\n• Net Banking: 3–5 days\n\nFor further help, contact support.',
        options: [
            { text: '💳 More Payment Help', nextNodeId: 'payments_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['refund', 'money back', 'when refund', 'refund status', 'return money'],
        isTerminal: true,
    },
    payment_failed: {
        nodeId: 'payment_failed',
        message: '❌ If your payment failed but money was deducted:\n\n• The amount is **automatically refunded within 24–48 hours**.\n• Check your bank statement after 48 hours.\n• If still not resolved, please contact your bank or our support.',
        options: [
            { text: '💳 More Payment Help', nextNodeId: 'payments_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['payment failed', 'transaction failed', 'money deducted', 'charged twice', 'double charge'],
        isTerminal: true,
    },
    invoice: {
        nodeId: 'invoice',
        message: '📄 You can download your invoice by going to **My Orders → Select Order → Download Invoice**. It is available as a PDF.',
        options: [
            { text: '💳 More Payment Help', nextNodeId: 'payments_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['invoice', 'bill', 'receipt', 'gst', 'download bill'],
        isTerminal: true,
    },

    // ── COUPONS & OFFERS ───────────────────────────────────────────────
    coupons_menu: {
        nodeId: 'coupons_menu',
        message: '🏷️ What do you need help with for coupons and offers?',
        options: [
            { text: '🎟️ How to apply a coupon', nextNodeId: 'apply_coupon', action: null },
            { text: '❌ Coupon not working', nextNodeId: 'coupon_not_working', action: null },
            { text: '🎁 Current offers', nextNodeId: 'current_offers', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['coupon', 'coupons', 'discount', 'promo', 'offer', 'code', 'voucher'],
        isTerminal: false,
    },
    apply_coupon: {
        nodeId: 'apply_coupon',
        message: '🎟️ To apply a coupon:\n\n1. Add items to your cart.\n2. Go to the **Checkout** page.\n3. Tap **Apply Coupon**.\n4. Enter or select a valid coupon code.\n5. Discount is applied instantly!',
        options: [
            { text: '🏷️ More Coupon Help', nextNodeId: 'coupons_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['how to use coupon', 'apply coupon', 'use code', 'enter promo'],
        isTerminal: true,
    },
    coupon_not_working: {
        nodeId: 'coupon_not_working',
        message: '❌ Coupons may not work if:\n\n• The coupon has **expired**.\n• Minimum order value is not met.\n• The coupon is not applicable to items in your cart.\n• You already used a one-time coupon.\n\nCheck the coupon terms and try again.',
        options: [
            { text: '🏷️ More Coupon Help', nextNodeId: 'coupons_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['coupon not working', 'invalid coupon', 'coupon expired', 'code not valid'],
        isTerminal: true,
    },
    current_offers: {
        nodeId: 'current_offers',
        message: '🎁 Check our **Offers** page in the app for the latest deals! We regularly update coupons for new users, festive seasons, and specific categories like Food and Pantry.',
        options: [
            { text: '🏷️ More Coupon Help', nextNodeId: 'coupons_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['offers', 'deals', 'sale', 'discount today', 'best offers'],
        isTerminal: true,
    },

    // ── PANTRY & DELIVERY ──────────────────────────────────────────────
    pantry_menu: {
        nodeId: 'pantry_menu',
        message: '🛒 What do you need help with for Pantry or Delivery?',
        options: [
            { text: '⏱️ Delivery time', nextNodeId: 'delivery_time', action: null },
            { text: '🗺️ Delivery area', nextNodeId: 'delivery_area', action: null },
            { text: '📦 Out of stock items', nextNodeId: 'out_of_stock', action: null },
            { text: '🔁 Return an item', nextNodeId: 'return_item', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['pantry', 'grocery', 'delivery', 'quick commerce', 'instant delivery', 'items'],
        isTerminal: false,
    },
    delivery_time: {
        nodeId: 'delivery_time',
        message: '⏱️ Delivery timings:\n\n• 🍔 **Food Delivery**: 30–45 minutes\n• 🛒 **Pantry / Quick Commerce**: 10–20 minutes\n\nTimes may vary based on location and demand.',
        options: [
            { text: '🛒 More Pantry Help', nextNodeId: 'pantry_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['delivery time', 'how long', 'eta', 'how fast', 'minutes', 'hours'],
        isTerminal: true,
    },
    delivery_area: {
        nodeId: 'delivery_area',
        message: '🗺️ We currently deliver to select areas. Open the app and enter your pincode on the home screen to check if your area is serviceable.',
        options: [
            { text: '🛒 More Pantry Help', nextNodeId: 'pantry_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['delivery area', 'serviceable', 'pincode', 'location', 'my area', 'available area'],
        isTerminal: true,
    },
    out_of_stock: {
        nodeId: 'out_of_stock',
        message: '📦 If an item is out of stock, you can tap **Notify Me** on the product page and we will alert you when it is back in stock!',
        options: [
            { text: '🛒 More Pantry Help', nextNodeId: 'pantry_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['out of stock', 'not available', 'sold out', 'item unavailable'],
        isTerminal: true,
    },
    return_item: {
        nodeId: 'return_item',
        message: '🔁 To return a pantry item:\n\n• Items can be returned within **24 hours** of delivery.\n• Go to **My Orders → Select Order → Return Item**.\n• A pickup will be scheduled and your refund processed within 48 hours.',
        options: [
            { text: '💰 Refund Status', nextNodeId: 'refund_status', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['return', 'return item', 'send back', 'return policy'],
        isTerminal: true,
    },

    // ── FAQs ───────────────────────────────────────────────────────────
    faqs_menu: {
        nodeId: 'faqs_menu',
        message: '❓ Here are some frequently asked questions:',
        options: [
            { text: '🔐 Account & Login', nextNodeId: 'faq_account', action: null },
            { text: '📍 Change Delivery Address', nextNodeId: 'faq_address', action: null },
            { text: '📱 App not working', nextNodeId: 'faq_app', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['faq', 'questions', 'how to', 'problem', 'issue', 'help'],
        isTerminal: false,
    },
    faq_account: {
        nodeId: 'faq_account',
        message: '🔐 Account & Login issues:\n\n• **Forgot password?** Tap "Forgot Password" on the login screen.\n• **OTP not received?** Check your network and retry after 60 seconds.\n• **Account locked?** Contact support after multiple failed attempts.',
        options: [
            { text: '❓ More FAQs', nextNodeId: 'faqs_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['account', 'login', 'password', 'otp', 'sign in', 'locked'],
        isTerminal: true,
    },
    faq_address: {
        nodeId: 'faq_address',
        message: '📍 To change your delivery address:\n\n• **Before ordering:** Select a different saved address or add a new one at checkout.\n• **After ordering:** Addresses cannot be changed once the order is placed.',
        options: [
            { text: '❓ More FAQs', nextNodeId: 'faqs_menu', action: null },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['address', 'change address', 'delivery address', 'location'],
        isTerminal: true,
    },
    faq_app: {
        nodeId: 'faq_app',
        message: '📱 If the app is not working:\n\n1. Force close and reopen the app.\n2. Check your internet connection.\n3. Clear app cache (Settings → App → Clear Cache).\n4. Update the app to the latest version.\n5. Reinstall if the issue persists.',
        options: [
            { text: '❓ More FAQs', nextNodeId: 'faqs_menu', action: null },
            { text: '🧑‍💼 Talk to an Agent', nextNodeId: 'agent', action: 'FETCH_AGENT_CONTACT' },
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['app not working', 'crash', 'bug', 'slow', 'error', 'freeze'],
        isTerminal: true,
    },

    // ── AGENT ──────────────────────────────────────────────────────────
    agent: {
        nodeId: 'agent',
        message: '🧑‍💼 Please hold on while we fetch our support contact details...',
        options: [
            { text: '🏠 Main Menu', nextNodeId: 'root', action: null },
        ],
        keywords: ['agent', 'human', 'customer care', 'support', 'speak', 'talk', 'call', 'contact'],
        isTerminal: true,
    },

    // ── FALLBACK ───────────────────────────────────────────────────────
    fallback: {
        nodeId: 'fallback',
        message: "🤔 Sorry, I didn't quite understand that. Please choose one of the options below:",
        options: [
            { text: '📦 Orders & Tracking', nextNodeId: 'orders_menu', action: null },
            { text: '💳 Payments & Refunds', nextNodeId: 'payments_menu', action: null },
            { text: '🏷️ Coupons & Offers', nextNodeId: 'coupons_menu', action: null },
            { text: '❓ FAQs', nextNodeId: 'faqs_menu', action: null },
        ],
        keywords: [],
        isTerminal: false,
    },
};

// =====================================================================
// ACTION HANDLERS
// =====================================================================
const handleAction = async (action, userId) => {
    switch (action) {

        case 'FETCH_LATEST_ORDER': {
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return '⚠️ Please log in to view your order details.';
            }

            try {
                // First look for any active/in-progress order
                let order = await FoodOrder.findOne({
                    userId: new mongoose.Types.ObjectId(userId),
                    orderStatus: { $in: ACTIVE_STATUSES },
                }).sort({ createdAt: -1 }).lean();

                // Fall back to the absolute latest order (delivered/cancelled)
                if (!order) {
                    order = await FoodOrder.findOne({
                        userId: new mongoose.Types.ObjectId(userId),
                    }).sort({ createdAt: -1 }).lean();
                }

                if (!order) {
                    return "📭 You don't have any orders yet. Start ordering now!";
                }

                const statusInfo = ORDER_STATUS_MAP[order.orderStatus] || { label: order.orderStatus, emoji: '📋' };
                const isActive = ACTIVE_STATUSES.includes(order.orderStatus);

                const itemsSummary = order.items
                    .slice(0, 3)
                    .map((i) => `• ${i.name} × ${i.quantity}`)
                    .join('\n');
                const moreItems = order.items.length > 3 ? `\n• ...and ${order.items.length - 3} more item(s)` : '';

                const deliveryPhase = order.deliveryState?.currentPhase;
                const phaseLabel = deliveryPhase
                    ? deliveryPhase.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                    : null;

                return [
                    isActive ? '🔴 **Active Order Found!**' : '📋 **Your Latest Order**',
                    `\n🆔 Order ID: **${order.orderId}**`,
                    `📌 Status: ${statusInfo.emoji} **${statusInfo.label}**`,
                    phaseLabel && isActive ? `🚚 Delivery Phase: ${phaseLabel}` : null,
                    `💰 Total: ₹${order.pricing?.total || 0}`,
                    `\n🛍️ Items:\n${itemsSummary}${moreItems}`,
                ].filter(Boolean).join('\n');

            } catch (err) {
                console.error('FETCH_LATEST_ORDER error:', err);
                return '⚠️ Unable to fetch your order right now. Please try again in a moment.';
            }
        }

        case 'FETCH_AGENT_CONTACT': {
            try {
                const settings = await GlobalSettings.findOne().lean();
                const phone = settings?.phone;
                const email = settings?.email || 'support@dukaanwallah.com';

                if (phone?.number) {
                    return `📞 **Support Contact:**\n\nPhone: ${phone.countryCode || '+91'} ${phone.number}\nEmail: ${email}\n\n🕐 Available: **9 AM – 9 PM**, 7 days a week.`;
                }
                return `📧 **Support Contact:**\n\nEmail: ${email}\n\n🕐 Available: **9 AM – 9 PM**, 7 days a week.`;
            } catch (err) {
                console.error('FETCH_AGENT_CONTACT error:', err);
                return '📧 Please email us at **support@dukaanwallah.com** for assistance.\n\n🕐 Available: **9 AM – 9 PM**, 7 days a week.';
            }
        }

        default:
            return null;
    }
};

// =====================================================================
// HELPERS
// =====================================================================

// Resolve a node: DB first, then hardcoded map
const resolveNode = async (nodeId) => {
    if (!nodeId) return null;
    try {
        const dbNode = await ChatbotNode.findOne({ nodeId }).lean();
        if (dbNode) return dbNode;
    } catch (_) {}
    return NODES[nodeId] || null;
};

// Score-based keyword matching across DB + hardcoded nodes
const findBestMatchingNode = async (message) => {
    const lowerMessage = message.toLowerCase().trim();
    const words = lowerMessage.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return null;

    const dbMatches = await ChatbotNode.find({ keywords: { $in: words } }).lean();

    const allNodes = [
        ...dbMatches,
        ...Object.values(NODES).filter((n) => !dbMatches.find((m) => m.nodeId === n.nodeId)),
    ];

    let best = null;
    let bestScore = 0;

    for (const node of allNodes) {
        if (!node.keywords || node.keywords.length === 0) continue;
        const score = node.keywords.filter((kw) => lowerMessage.includes(kw)).length;
        if (score > bestScore) {
            bestScore = score;
            best = node;
        }
    }

    return bestScore > 0 ? best : null;
};

// =====================================================================
// CONTROLLERS
// =====================================================================

// POST /api/v1/chat/message
export const processMessage = async (req, res) => {
    try {
        const { message, nodeId, userId, action: incomingAction } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'UserId is required' });
        }

        // Find or create session
        let session = await ChatSession.findOne({ userId, isActive: true });
        if (!session) {
            session = new ChatSession({ userId });
        }

        let responseNode = null;
        let dynamicMessage = null;

        // 1. Button click → navigate by nodeId
        if (nodeId) {
            responseNode = await resolveNode(nodeId);
        }

        // 2. Free-text → keyword matching
        if (!responseNode && message) {
            responseNode = await findBestMatchingNode(message);
        }

        // 3. Nothing matched → fallback
        if (!responseNode) {
            responseNode = NODES.fallback;
        }

        // Resolve action: prefer the explicitly sent action, else check the matched node's
        // own options for any auto-action (e.g. agent node calls FETCH_AGENT_CONTACT)
        const actionToRun = incomingAction || null;
        if (actionToRun) {
            dynamicMessage = await handleAction(actionToRun, userId);
        }

        // Persist messages
        if (message) {
            session.messages.push({ sender: 'user', text: message });
        }

        const finalMessageText = dynamicMessage
            ? `${responseNode.message}\n\n${dynamicMessage}`
            : responseNode.message;

        session.messages.push({ sender: 'bot', text: finalMessageText });
        session.currentNodeId = responseNode.nodeId;
        await session.save();

        return res.status(200).json({
            success: true,
            data: {
                message: finalMessageText,
                options: responseNode.options || [],
                nodeId: responseNode.nodeId,
                isTerminal: responseNode.isTerminal || false,
            },
        });
    } catch (error) {
        console.error('Chatbot processMessage Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// GET /api/v1/chat/session/:userId
export const getSession = async (req, res) => {
    try {
        const { userId } = req.params;
        let session = await ChatSession.findOne({ userId, isActive: true });

        const rootNode = (await resolveNode('root')) || NODES.root;

        if (!session) {
            session = new ChatSession({ userId });
            session.messages.push({ sender: 'bot', text: rootNode.message });
            session.currentNodeId = 'root';
            await session.save();

            return res.status(200).json({
                success: true,
                data: {
                    messages: session.messages,
                    currentOptions: rootNode.options,
                },
            });
        }

        const currentNode = (await resolveNode(session.currentNodeId)) || rootNode;

        return res.status(200).json({
            success: true,
            data: {
                messages: session.messages,
                currentOptions: currentNode.options || [],
            },
        });
    } catch (error) {
        console.error('Chatbot getSession Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
