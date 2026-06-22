import mongoose from 'mongoose';

const quickReturnSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true, trim: true, index: true },
    returnWindowDays: { type: Number, default: 7, min: 1, max: 90 },
    isReturnEnabled: { type: Boolean, default: true },
    updatedByAdminId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { collection: 'quick_return_settings', timestamps: true },
);

export const QuickReturnSettings = mongoose.model(
  'QuickReturnSettings',
  quickReturnSettingsSchema,
  'quick_return_settings',
);
