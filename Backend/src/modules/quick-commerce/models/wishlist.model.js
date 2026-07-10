import mongoose from 'mongoose';

const quickWishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      default: null,
    },
    sessionId: {
      type: String,
      default: '',
      trim: true,
    },
    products: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'quick_product',
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

quickWishlistSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $type: "objectId" } },
  }
);

quickWishlistSchema.index(
  { sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: { $type: "string", $gt: "" } },
  }
);

export const QuickWishlist = mongoose.model('quick_wishlist', quickWishlistSchema, 'quick_wishlists');
