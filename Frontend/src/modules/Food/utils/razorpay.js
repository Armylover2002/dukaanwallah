/**
 * Razorpay Payment Integration Utility
 * Handles Razorpay payment initialization and verification
 */

let razorpayLoaded = false;

/**
 * Load Razorpay checkout script
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (razorpayLoaded) {
      resolve();
      return;
    }

    if (window.Razorpay) {
      razorpayLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      razorpayLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Razorpay script'));
    };
    document.body.appendChild(script);
  });
};

/**
 * Initialize Razorpay payment
 * @param {Object} options - Payment options
 * @param {String} options.key - Razorpay key ID
 * @param {String} options.amount - Amount in paise
 * @param {String} options.currency - Currency code
 * @param {String} options.order_id - Razorpay order ID
 * @param {String} options.name - Company/App name
 * @param {String} options.description - Payment description
 * @param {String} options.prefill.name - Customer name
 * @param {String} options.prefill.email - Customer email
 * @param {String} options.prefill.contact - Customer phone
 * @param {Object} options.notes - Additional notes
 * @param {Function} options.handler - Success callback
 * @param {Function} options.onError - Error callback
 * @param {Function} options.onClose - Close callback
 */
export const initRazorpayPayment = async (options) => {
  try {
    // Load Razorpay script if not already loaded
    await loadRazorpayScript();

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not available');
    }

    const razorpayOptions = {
      key: options.key,
      amount: options.amount,
      currency: options.currency || 'INR',
      order_id: options.order_id,
      name: options.name || 'Appzeto Food',
      description: options.description || 'Order Payment',
      image: options.image || '/logo.png',
      prefill: {
        name: options.prefill?.name || '',
        email: options.prefill?.email || '',
        contact: options.prefill?.contact || ''
      },
      notes: options.notes || {},
      theme: {
        color: '#F26522'
      },
      handler: function(response) {
        if (options.handler) {
          options.handler(response);
        }
      },
      modal: {
        ondismiss: function() {
          if (options.onClose) {
            options.onClose();
          }
        },
        // Ensure modal is clickable
        escape: true,
        animation: true
      },
      // Ensure proper z-index
      retry: {
        enabled: true,
        max_count: 3
      }
    };

    const razorpay = new window.Razorpay(razorpayOptions);
    
    // Handle payment failures
    razorpay.on('payment.failed', function(response) {
      console.error('Razorpay payment failed:', response);
      if (options.onError) {
        options.onError(response.error || { description: 'Payment failed. Please try again.' });
      }
    });

    // Handle payment method selection failures
    razorpay.on('payment.method_selection_failed', function(response) {
      console.error('Razorpay payment method selection failed:', response);
      if (options.onError) {
        options.onError(response.error || { description: 'Please select another payment method.' });
      }
    });

    // Open Razorpay modal
    razorpay.open();
    
    console.log('✅ Razorpay checkout opened successfully');
    console.log('Razorpay options:', {
      key: razorpayOptions.key ? 'Present' : 'Missing',
      amount: razorpayOptions.amount,
      order_id: razorpayOptions.order_id
    });

    return razorpay;
  } catch (error) {
    console.error('Error initializing Razorpay:', error);
    if (options.onError) {
      options.onError(error);
    }
    throw error;
  }
};

/**
 * ✅ NEW: Initialize Razorpay Subscription checkout
 * @param {Object} options 
 */
export const initRazorpaySubscription = async (options) => {
  try {
    await loadRazorpayScript();

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not available');
    }

    const razorpayOptions = {
      key: options.key,
      subscription_id: options.subscription_id,
      name: options.name || 'Appzeto Subscriptions',
      description: options.description || 'Plan Subscription',
      image: options.image || '/logo.png',
      prefill: {
        name: options.prefill?.name || '',
        email: options.prefill?.email || '',
        contact: options.prefill?.contact || ''
      },
      theme: {
        color: '#F26522'
      },
      handler: function(response) {
        if (options.handler) {
          options.handler(response);
        }
      },
      modal: {
        ondismiss: function() {
          if (options.onClose) {
            options.onClose();
          }
        }
      },
      retry: {
        enabled: true,
        max_count: 3
      }
    };

    const rzp = new window.Razorpay(razorpayOptions);
    rzp.on('payment.failed', function(response) {
      console.error('Razorpay subscription payment failed:', response);
      if (options.onError) {
        options.onError(response.error || { description: 'Payment failed. Please try again.' });
      }
    });
    rzp.open();
    return rzp;
  } catch (error) {
    if (options.onError) {
      options.onError(error);
    }
    throw error;
  }
};

/**
 * Format amount for display
 * @param {Number} amount - Amount in paise
 * @returns {String} Formatted amount string
 */
export const formatAmount = (amount) => {
  return `₹${(amount / 100).toFixed(2)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Flutter WebView Bridge Utilities
// Shared between SignupStep2, Cart and any other page that needs Razorpay
// inside a flutter_inappwebview WebView.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect if the page is running inside a Flutter InAppWebView.
 * @returns {boolean}
 */
export const isFlutterWebView = () => {
  return (
    typeof window !== 'undefined' &&
    !!window.flutter_inappwebview &&
    typeof window.flutter_inappwebview.callHandler === 'function'
  );
};

/**
 * Trigger a Razorpay payment via the native Flutter Razorpay SDK.
 *
 * Strategy:
 *  1. Register global JS callbacks so Flutter can call back on success/failure.
 *  2. Listen to window.postMessage for apps that use that channel instead.
 *  3. Race each possible handler name against a 600 ms timeout.
 *     - If the race resolves (handler registered + returned immediately) → invoked.
 *     - If the race times out → handler not registered, try next name.
 *  4. Also attach a .then() on the raw callPromise so a handler that resolves
 *     AFTER payment completion (long-lived promise) is still captured.
 *  5. After invoking any handler, wait up to 5 minutes for the payment result.
 *
 * @param {Object} rzpOptions - Same shape as initRazorpayPayment options
 * @returns {Promise<{razorpay_payment_id, razorpay_order_id, razorpay_signature}>}
 */
export const handleFlutterRazorpayPayment = (rzpOptions) => {
  return new Promise((resolve, reject) => {
    try {
      // Build payload with both snake_case and camelCase keys for compatibility
      const payload = {
        key: rzpOptions.key,
        order_id: rzpOptions.order_id,
        keyId: rzpOptions.key,
        orderId: rzpOptions.order_id,
        amount: rzpOptions.amount,
        currency: rzpOptions.currency || 'INR',
        name: rzpOptions.name,
        description: rzpOptions.description,
        prefill: rzpOptions.prefill,
        notes: rzpOptions.notes || {},
      };

      let settled = false;
      let timeoutId = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        ['onRazorpaySuccess', 'onRazorpayPaymentSuccess', 'onPaymentSuccess', 'razorpayPaymentSuccess']
          .forEach((name) => { if (window[name] === handleSuccess) delete window[name]; });
        ['onRazorpayFailure', 'onRazorpayPaymentFailure', 'onPaymentFailure', 'onPaymentError', 'razorpayPaymentFailure']
          .forEach((name) => { if (window[name] === handleFailure) delete window[name]; });
        window.removeEventListener('message', handleMessage);
      };

      const finishSuccess = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        const paymentId = result?.razorpay_payment_id || result?.paymentId || result?.payment_id;
        const orderId = result?.razorpay_order_id || result?.orderId || result?.order_id || rzpOptions.order_id;
        const signature = result?.razorpay_signature || result?.signature || '';
        if (!paymentId) {
          reject(new Error('Payment succeeded but payment ID missing from Flutter response'));
          return;
        }
        resolve({ razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature });
      };

      const finishFailure = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        const msg = (typeof err === 'string' ? err : err?.error?.description || err?.description || err?.message) || 'Payment failed or cancelled';
        reject(new Error(msg));
      };

      // Register global callbacks Flutter can call after native payment
      const handleSuccess = (result) => finishSuccess(result);
      const handleFailure = (err) => finishFailure(err);
      ['onRazorpaySuccess', 'onRazorpayPaymentSuccess', 'onPaymentSuccess', 'razorpayPaymentSuccess']
        .forEach((name) => { window[name] = handleSuccess; });
      ['onRazorpayFailure', 'onRazorpayPaymentFailure', 'onPaymentFailure', 'onPaymentError', 'razorpayPaymentFailure']
        .forEach((name) => { window[name] = handleFailure; });

      // Also handle apps that use window.postMessage
      const handleMessage = (event) => {
        let data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { return; }
        }
        if (!data || typeof data !== 'object') return;
        const type = data.type || data.event || '';
        if (/razorpay/i.test(type) && /success/i.test(type)) {
          finishSuccess(data.payload || data.result || data);
        } else if (/razorpay/i.test(type) && /(fail|error|cancel)/i.test(type)) {
          finishFailure(data.payload || data.result || data);
        } else if (data.razorpay_payment_id || data.paymentId || data.payment_id) {
          finishSuccess(data);
        }
      };
      window.addEventListener('message', handleMessage);

      // Try each possible Flutter handler name
      const handlerNames = [
        'initRazorpayPayment',
        'initRazorpay',
        'razorpayPayment',
        'startRazorpay',
        'openRazorpayCheckout',
        'openRazorpay',
        'startPayment',
        'razorpayCheckout',
      ];

      const tryHandlers = async () => {
        let invoked = false;

        for (const handlerName of handlerNames) {
          if (settled) return;

          try {
            const callPromise = window.flutter_inappwebview.callHandler(handlerName, payload);

            // Attach listener for handlers that resolve AFTER payment (long-lived)
            callPromise.then((res) => {
              if (res && typeof res === 'object') {
                const paymentId = res.razorpay_payment_id || res.paymentId || res.payment_id;
                if (paymentId) finishSuccess(res);
                else if (res.error || res.cancelled) finishFailure(res.error || 'Payment cancelled');
              }
            }).catch(() => { /* handled below */ });

            // Race against 600 ms — if it times out the handler is not registered
            const result = await Promise.race([
              callPromise,
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 600)),
            ]);

            invoked = true;

            if (result && typeof result === 'object') {
              const paymentId = result.razorpay_payment_id || result.paymentId || result.payment_id;
              if (paymentId) { finishSuccess(result); return; }
              if (result.error || result.cancelled) { finishFailure(result.error || 'Payment cancelled'); return; }
            }

            // Handler responded quickly (void/null) — it accepted the call
            break;

          } catch (err) {
            if (err.message === 'timeout') continue; // not registered, try next
            // Handler explicitly rejected
            console.warn(`[Razorpay Flutter] Handler "${handlerName}" rejected:`, err);
          }
        }

        if (settled) return;

        if (!invoked) {
          console.warn('[Razorpay Flutter] No handler found quickly — waiting for async callback.');
        }

        // Safety timeout: 5 minutes for the user to complete payment
        timeoutId = setTimeout(() => {
          finishFailure(new Error('Payment timed out. Please try again.'));
        }, 5 * 60 * 1000);
      };

      tryHandlers();
    } catch (e) {
      reject(new Error('Flutter payment bridge unavailable'));
    }
  });
};
