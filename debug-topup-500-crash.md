# Debugging Session: topup-500-crash

**Status:** [OPEN]
**Start Time:** 2026-05-16

## 📋 Symptoms
- `POST /api/v1/food/restaurant/subscription-topup` returns `500 Server Error`.
- Occurs after recent refactor to fix `userType` mismatch.

## 🔍 Hypotheses
1. **Razorpay Configuration**: `isRazorpayConfigured()` returns true but `createRazorpayOrder` fails due to invalid keys.
2. **Controller Response Mapping**: `data.razorpay` is accessed on an object that doesn't have it or is null.
3. **User Data Access**: `req.user` might be missing or `role` might be undefined in this specific route context.
4. **Amount Type Error**: `amount` passed from frontend might be a string causing issues in service logic.

## 🛠️ Instrumentation Plan
1. Add trace logs in `subscription.controller.js` to log `req.user` and the service response.
2. Add trace logs in `wallet.service.js` to log `amount`, `userType`, and the Razorpay order creation result.

## 📝 Timeline
- **Step 1**: Initialized debug session.
- **Step 2**: Propose hypotheses.
- **Step 3**: (Next) Start Debug Server and Instrument.
