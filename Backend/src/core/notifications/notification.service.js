import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../auth/errors.js';
import { FoodNotification } from './models/notification.model.js';
import { SellerNotification } from '../../modules/quick-commerce/seller/models/sellerNotification.model.js';

const normalizePagination = ({ page = 1, limit = 20 } = {}) => {
    const nextPage = Math.max(1, Number(page) || 1);
    const nextLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    return {
        page: nextPage,
        limit: nextLimit,
        skip: (nextPage - 1) * nextLimit
    };
};

const normalizeOwnerType = (role) => {
    const normalized = String(role || '').trim().toUpperCase();
    if (normalized === 'USER') return 'USER';
    if (normalized === 'RESTAURANT') return 'RESTAURANT';
    if (normalized === 'DELIVERY_PARTNER' || normalized === 'DELIVERY') return 'DELIVERY_PARTNER';
    if (normalized === 'SELLER') return 'SELLER';
    return null;
};

const ensureObjectId = (value, fieldName) => {
    if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
        throw new ValidationError(`${fieldName} is invalid`);
    }
    return new mongoose.Types.ObjectId(String(value));
};

export const resolveNotificationOwnerFromRequest = (user = {}) => {
    const ownerType = normalizeOwnerType(user?.role);
    const ownerId = user?.userId || user?._id || null;

    if (!ownerType || !ownerId) {
        throw new ValidationError('Authenticated notification owner not found');
    }

    return {
        ownerType,
        ownerId: ensureObjectId(ownerId, 'ownerId')
    };
};

export const createInboxNotifications = async ({ notifications = [] } = {}) => {
    const rows = Array.isArray(notifications)
        ? notifications.filter((item) => item?.ownerType && item?.ownerId && item?.title && item?.message)
        : [];

    if (!rows.length) return [];

    const sellerRows = rows.filter((item) => String(item.ownerType).trim().toUpperCase() === 'SELLER');
    const otherRows = rows.filter((item) => String(item.ownerType).trim().toUpperCase() !== 'SELLER');

    if (sellerRows.length > 0) {
        const sellerOperations = sellerRows.map((item) => {
            const hasExplicitBroadcastId = item.broadcastId && mongoose.Types.ObjectId.isValid(String(item.broadcastId));
            const broadcastIdStr = hasExplicitBroadcastId ? String(item.broadcastId) : new mongoose.Types.ObjectId().toString();
            const key = `broadcast_${broadcastIdStr}`;
            return {
                updateOne: {
                    filter: {
                        sellerId: ensureObjectId(item.ownerId, 'ownerId'),
                        key
                    },
                    update: {
                        $set: {
                            type: 'system',
                            title: String(item.title).trim(),
                            message: String(item.message).trim(),
                            metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
                        },
                        $setOnInsert: {
                            isRead: false
                        }
                    },
                    upsert: true
                }
            };
        });
        await SellerNotification.collection.bulkWrite(sellerOperations, { ordered: false });
    }

    let otherResults = [];
    if (otherRows.length > 0) {
        const operations = otherRows.map((item) => {
            const hasExplicitBroadcastId = item.broadcastId && mongoose.Types.ObjectId.isValid(String(item.broadcastId));
            const payload = {
                ownerType: item.ownerType,
                ownerId: ensureObjectId(item.ownerId, 'ownerId'),
                title: String(item.title).trim(),
                message: String(item.message).trim(),
                link: String(item.link || '').trim(),
                category: String(item.category || 'broadcast').trim(),
                source: 'ADMIN_BROADCAST',
                metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {},
            };

            if (hasExplicitBroadcastId) {
                payload.broadcastId = new mongoose.Types.ObjectId(String(item.broadcastId));
            } else {
                payload.broadcastId = new mongoose.Types.ObjectId();
            }

            return {
                updateOne: {
                    filter: hasExplicitBroadcastId
                        ? {
                            broadcastId: payload.broadcastId,
                            ownerType: payload.ownerType,
                            ownerId: payload.ownerId
                        }
                        : {
                            ownerType: payload.ownerType,
                            ownerId: payload.ownerId,
                            title: payload.title,
                            message: payload.message,
                            source: payload.source
                        },
                    update: {
                        $set: {
                            ...payload,
                            dismissedAt: null
                        },
                        $setOnInsert: {
                            isRead: false,
                            readAt: null
                        }
                    },
                    upsert: true
                }
            };
        });

        await FoodNotification.collection.bulkWrite(operations, { ordered: false });

        const ids = otherRows
            .map((item) => item.broadcastId)
            .filter((value) => value && mongoose.Types.ObjectId.isValid(String(value)))
            .map((value) => new mongoose.Types.ObjectId(String(value)));

        if (ids.length > 0) {
            otherResults = await FoodNotification.find({ broadcastId: { $in: ids } }).sort({ createdAt: -1 }).lean();
        }
    }

    return otherResults;
};

export const getInboxNotifications = async ({ ownerType, ownerId, page = 1, limit = 20, contextModule } = {}) => {
    const normalizedOwnerType = normalizeOwnerType(contextModule || ownerType);
    const normalizedOwnerId = ensureObjectId(ownerId, 'ownerId');
    const { skip, ...meta } = normalizePagination({ page, limit });

    const filter = {
        ownerType: normalizedOwnerType,
        ownerId: normalizedOwnerId,
        dismissedAt: null
    };

    const [items, total, unreadCount] = await Promise.all([
        FoodNotification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(meta.limit)
            .lean(),
        FoodNotification.countDocuments(filter),
        FoodNotification.countDocuments({
            ...filter,
            isRead: false
        })
    ]);

    return {
        items,
        pagination: {
            page: meta.page,
            limit: meta.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / meta.limit))
        },
        unreadCount
    };
};

export const markNotificationAsRead = async ({ notificationId, ownerType, ownerId } = {}) => {
    const notification = await FoodNotification.findOneAndUpdate(
        {
            _id: ensureObjectId(notificationId, 'notificationId'),
            ownerType: normalizeOwnerType(ownerType),
            ownerId: ensureObjectId(ownerId, 'ownerId'),
            dismissedAt: null
        },
        {
            $set: {
                isRead: true,
                readAt: new Date()
            }
        },
        { new: true }
    ).lean();

    if (!notification) {
        throw new NotFoundError('Notification not found');
    }

    return notification;
};

export const dismissNotification = async ({ notificationId, ownerType, ownerId } = {}) => {
    const notification = await FoodNotification.findOneAndUpdate(
        {
            _id: ensureObjectId(notificationId, 'notificationId'),
            ownerType: normalizeOwnerType(ownerType),
            ownerId: ensureObjectId(ownerId, 'ownerId'),
            dismissedAt: null
        },
        {
            $set: {
                dismissedAt: new Date(),
                isRead: true,
                readAt: new Date()
            }
        },
        { new: true }
    ).lean();

    if (!notification) {
        throw new NotFoundError('Notification not found');
    }

    return notification;
};

export const dismissAllNotifications = async ({ ownerType, ownerId } = {}) => {
    const result = await FoodNotification.updateMany(
        {
            ownerType: normalizeOwnerType(ownerType),
            ownerId: ensureObjectId(ownerId, 'ownerId'),
            dismissedAt: null
        },
        {
            $set: {
                dismissedAt: new Date(),
                isRead: true,
                readAt: new Date()
            }
        }
    );

    return {
        modifiedCount: Number(result?.modifiedCount || 0)
    };
};
