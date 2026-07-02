import { FoodOrder } from '../../../food/orders/models/order.model.js';
import { Seller } from '../../seller/models/seller.model.js';
import mongoose from 'mongoose';

export async function getSellerOrderTransactions(query = {}) {
    const { page = 1, limit = 50, search = '' } = query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build the query to get all quick commerce orders
    const filter = {
        orderType: { $in: ['quick', 'mixed'] }
    };

    if (search) {
        filter.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            { 'pickupPoints.sourceName': { $regex: search, $options: 'i' } }
        ];
    }

    // Calculate Summary Stats
    const summaryAgg = await FoodOrder.aggregate([
        { $match: { orderType: { $in: ['quick', 'mixed'] } } },
        {
            $group: {
                _id: null,
                totalAdminEarnings: { $sum: { $add: [{ $ifNull: ["$pricing.platformFee", 0] }, { $ifNull: ["$restaurantCommission", 0] }] } },
                totalDeliveryBoyEarnings: { $sum: { $ifNull: ["$riderEarning", 0] } },
                totalRefundedAmount: {
                    $sum: {
                        $cond: [
                            { $eq: ["$payment.status", "refunded"] },
                            { $ifNull: ["$pricing.total", 0] },
                            0
                        ]
                    }
                },
                totalOrderSubtotal: { $sum: { $ifNull: ["$pricing.subtotal", 0] } },
                totalCouponDiscount: { $sum: { $ifNull: ["$pricing.discount", 0] } }
            }
        }
    ]);

    const stats = summaryAgg[0] || {
        totalAdminEarnings: 0,
        totalDeliveryBoyEarnings: 0,
        totalRefundedAmount: 0,
        totalOrderSubtotal: 0,
        totalCouponDiscount: 0
    };

    // Calculate total Seller Earnings based on subtotal - discount - adminEarnings
    const totalSellerEarnings = stats.totalOrderSubtotal - stats.totalCouponDiscount - stats.totalAdminEarnings;

    const summaryCards = {
        adminEarnings: stats.totalAdminEarnings,
        sellerEarnings: totalSellerEarnings > 0 ? totalSellerEarnings : 0,
        deliveryBoyEarnings: stats.totalDeliveryBoyEarnings,
        refundedAmount: stats.totalRefundedAmount
    };

    // Fetch Orders for Table
    const orders = await FoodOrder.find(filter)
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

    // For quick commerce orders, restaurantId holds the Seller _id.
    // We manually look up sellers because the FoodOrder schema refs 'FoodRestaurant',
    // causing populate() to silently return null for Seller documents.
    const sellerIds = [...new Set(
        orders.filter(o => o.restaurantId).map(o => o.restaurantId.toString())
    )];
    const sellerMap = {};
    if (sellerIds.length > 0) {
        const sellers = await Seller.find(
            { _id: { $in: sellerIds.map(id => new mongoose.Types.ObjectId(id)) } },
            'shopName name'
        ).lean();
        sellers.forEach(s => {
            sellerMap[s._id.toString()] = s.shopName || s.name || '';
        });
    }

    const total = await FoodOrder.countDocuments(filter);

    // Map the orders for the frontend table
    const mappedOrders = orders.map((order, index) => {
        // Try Seller lookup first, then pickupPoints, then items sourceName
        let sellerName = 'Unknown Seller';
        if (order.restaurantId) {
            const mapped = sellerMap[order.restaurantId.toString()];
            if (mapped) sellerName = mapped;
        }
        if (sellerName === 'Unknown Seller' && order.pickupPoints?.length > 0 && order.pickupPoints[0].sourceName) {
            sellerName = order.pickupPoints[0].sourceName;
        }
        if (sellerName === 'Unknown Seller' && order.items?.length > 0 && order.items[0].sourceName) {
            sellerName = order.items[0].sourceName;
        }

        return {
            _id: order._id,
            si: skip + index + 1,
            orderId: order.orderId,
            seller: sellerName,
            customerName: order.userId ? order.userId.name : 'Guest User',
            totalItemAmount: order.pricing?.subtotal || 0,
            couponDiscount: order.pricing?.discount || 0,
            vatTax: order.pricing?.tax || 0,
            deliveryCharge: order.pricing?.deliveryFee || 0,
            platformFee: order.pricing?.platformFee || 0,
            orderAmount: order.pricing?.total || 0,
            status: order.orderStatus,
            paymentStatus: order.payment?.status,
            createdAt: order.createdAt
        };
    });

    return {
        summary: summaryCards,
        transactions: mappedOrders,
        total,
        page: parseInt(page),
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
    };
}
