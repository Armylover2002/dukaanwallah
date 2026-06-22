import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: '', trim: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 1, default: 1 },
    price: { type: Number, min: 0, default: 0 },
    image: { type: String, default: '' },
  },
  { _id: false },
);

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    ifscCode: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const quickReturnOrderSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    orderId: { type: String, required: true, trim: true, index: true }, // FoodOrder.orderId (string like QC-xxxx)
    parentOrderMongoId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', default: null, index: true },
    sessionId: { type: String, default: '', trim: true, index: true }, // guest fallback
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null, index: true },

    // ── Request details ───────────────────────────────────────────────────────
    returnItems: { type: [returnItemSchema], default: [] },
    reason: { type: String, required: true, trim: true },
    proofImageUrl: { type: String, default: '', trim: true }, // customer-uploaded product photo

    // ── Refund preference ─────────────────────────────────────────────────────
    refundMethod: {
      type: String,
      enum: ['wallet', 'bank_account'],
      required: true,
      default: 'wallet',
    },
    bankDetails: { type: bankDetailsSchema, default: undefined }, // only when refundMethod=bank_account

    // ── Refund amounts ────────────────────────────────────────────────────────
    refundAmount: { type: Number, min: 0, default: 0 },
    refundTransactionId: { type: String, default: '', trim: true }, // wallet txn ID after credit

    // ── Workflow status machine ────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'pending_review',     // User submitted, awaiting admin
        'approved',           // Admin approved, pending partner assignment
        'rejected',           // Admin rejected
        'pickup_assigned',    // Delivery partner assigned for pickup
        'picked_up',          // Partner verified OTP + picked up from customer
        'delivered_to_seller', // Partner delivered to seller location
        'refund_processed',   // Refund credited/recorded
      ],
      default: 'pending_review',
      index: true,
    },

    // ── Admin actions ─────────────────────────────────────────────────────────
    rejectionReason: { type: String, default: '', trim: true },
    adminNote: { type: String, default: '', trim: true },
    reviewedByAdminId: { type: mongoose.Schema.Types.ObjectId, default: null },
    reviewedAt: { type: Date, default: null },

    // ── Pickup assignment ─────────────────────────────────────────────────────
    deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodDeliveryPartner', default: null, index: true },
    assignedAt: { type: Date, default: null },
    riderEarning: { type: Number, default: 0 },

    // ── Pickup confirmation ───────────────────────────────────────────────────
    pickupOtp: { type: String, default: '', select: false }, // 4-digit OTP sent to customer
    otpVerified: { type: Boolean, default: false },
    pickupProofImageUrl: { type: String, default: '' },      // partner-uploaded proof photo
    pickedUpAt: { type: Date, default: null },

    // ── Seller delivery confirmation ──────────────────────────────────────────
    sellerDeliveryOtp: { type: String, default: '', select: false }, // 4-digit OTP shown to seller
    sellerOtpVerified: { type: Boolean, default: false },

    // ── Seller confirmation ───────────────────────────────────────────────────
    sellerConfirmedAt: { type: Date, default: null },

    // ── Refund confirmation ───────────────────────────────────────────────────
    refundProcessedAt: { type: Date, default: null },

    // ── Customer address snapshot (for partner navigation) ─────────────────────
    customerAddress: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      phone: { type: String, default: '' },
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },

    // ── Seller address snapshot ────────────────────────────────────────────────
    sellerAddress: {
      shopName: { type: String, default: '' },
      address: { type: String, default: '' },
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },

    // ── Settings snapshot at time of request ──────────────────────────────────
    returnWindowDays: { type: Number, default: 7 },
  },
  { collection: 'quick_return_orders', timestamps: true },
);

// ── Compound indexes ─────────────────────────────────────────────────────────
quickReturnOrderSchema.index({ userId: 1, createdAt: -1 });
quickReturnOrderSchema.index({ sellerId: 1, createdAt: -1 });
quickReturnOrderSchema.index({ deliveryPartnerId: 1, status: 1 });
quickReturnOrderSchema.index({ orderId: 1, userId: 1 });
quickReturnOrderSchema.index({ status: 1, createdAt: -1 });

export const QuickReturnOrder = mongoose.model(
  'QuickReturnOrder',
  quickReturnOrderSchema,
  'quick_return_orders',
);
