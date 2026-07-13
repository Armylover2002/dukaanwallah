// import React, { useEffect, useState, useMemo } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { User, MapPin, FastForward, Clock, Phone, ChefHat, ChevronDown } from 'lucide-react';
// import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
// import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
// import { getHaversineDistance, calculateETA } from '@/modules/DeliveryV2/utils/geo';
// import { isMixedOrder, normalizePickupPoints } from '@/modules/DeliveryV2/utils/orderRouting';

// /**
//  * NewOrderModal - Ported to Original 1:1 Theme with Slider Accept.
//  * Matches the Zomato/Swiggy style Green Header + White Card.
//  */
// export const NewOrderModal = ({ order, onAccept, onReject, onMinimize }) => {
//   const { riderLocation } = useDeliveryStore();
//   const [timeLeft, setTimeLeft] = useState(() => {
//     if (!order) return 30;
//     const orderId = order.orderId || order._id || 'unknown';
//     const storageKey = `delivery_timer_${orderId}`;
//     const storedTime = localStorage.getItem(storageKey);
//     const now = Date.now();
//     if (storedTime) {
//       const elapsed = Math.floor((now - parseInt(storedTime, 10)) / 1000);
//       const remaining = Math.max(0, 30 - elapsed);
//       return remaining;
//     } else {
//       localStorage.setItem(storageKey, now.toString());
//       return 30;
//     }
//   });

//   const pickupPoints = normalizePickupPoints(order);
//   const primaryPickup = pickupPoints[0] || null;
//   const mixedOrder = isMixedOrder(order);

//   const clearTimerStorage = () => {
//     const orderId = order?.orderId || order?._id || 'unknown';
//     localStorage.removeItem(`delivery_timer_${orderId}`);
//   };

//   useEffect(() => {
//     if (timeLeft <= 0) {
//       clearTimerStorage();
//       onReject();
//       return;
//     }
//     const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
//     return () => clearInterval(timer);
//   }, [timeLeft, onReject, order]);

//   // Ensure we clear the timer when the component unmounts intentionally 
//   // after an action (accept/reject). We can wrap the onAccept/onReject calls.
//   const handleAccept = (order) => {
//     clearTimerStorage();
//     onAccept(order);
//   };

//   const handleReject = () => {
//     clearTimerStorage();
//     onReject();
//   };

//   const { distanceKm, etaMins } = useMemo(() => {
//     if (!order) return { distanceKm: null, etaMins: null };

//     // A. Use provided data if available (Direct distance from socket)
//     const rawDist = order.pickupDistanceKm || order.distanceKm;
//     const rawEta = order.estimatedTime || order.duration || order.eta;

//     if (rawDist != null) {
//       return {
//         distanceKm: Number(rawDist).toFixed(1),
//         etaMins: rawEta && rawEta > 0 ? Math.ceil(rawEta) : Math.ceil((rawDist * 1000) / 416) + 5
//       };
//     }

//     // B. Calculate from locations (Local calculation fallback)
//     const rest = primaryPickup?.location || order.restaurantLocation || order.restaurantId?.location || {};
//     const resLat = parseFloat(order.restaurant_lat || order.restaurantLat || rest.latitude || rest.lat);
//     const resLng = parseFloat(order.restaurant_lng || order.restaurantLng || rest.longitude || rest.lng);

//     if (riderLocation && !isNaN(resLat) && !isNaN(resLng)) {
//       const distM = getHaversineDistance(
//         riderLocation.lat, riderLocation.lng,
//         resLat, resLng
//       );
//       const km = distM / 1000;
//       // Assume 25km/h avg for initial estimate (roughly 416m/min)
//       const mins = Math.ceil(distM / 416) + (order.prepTime || 5);

//       return {
//         distanceKm: km.toFixed(1),
//         etaMins: mins
//       };
//     }

//     return { distanceKm: '??', etaMins: order.prepTime || 15 };
//   }, [order, primaryPickup, riderLocation]);

//   if (!order) return null;

//   const earnings = order.earnings || order.riderEarning || (order.orderAmount ? order.orderAmount * 0.1 : 0);
//   const isQuickOrder = String(order?.orderType || order?.serviceType || order?.type || '').trim().toLowerCase() === 'quick';
//   const restaurantName =
//     order?.dispatchLeg?.sourceName ||
//     (isQuickOrder
//       ? order?.storeName || order?.sellerName || order?.seller?.shopName || order?.seller?.name || 'Seller store'
//       : order?.restaurantName || order?.restaurant_name || order?.restaurantId?.restaurantName || order?.restaurantId?.name || 'Restaurant');
//   const restaurantAddressRaw =
//     (isQuickOrder
//       ? order?.sellerAddress || order?.storeAddress || order?.sellerAddress || order?.restaurantAddress || order?.restaurantLocation?.address || order?.seller?.location?.address || order?.seller?.location?.formattedAddress || order?.seller?.address || order?.restaurantId?.location?.address || order?.restaurantId?.address
//       : order?.restaurantAddress || order?.restaurant_address || order?.restaurantId?.location?.address || order?.restaurantId?.address) ||
//     'Address not available';

//   const isCoordinates = (str) => {
//     if (Array.isArray(str)) return true;
//     if (typeof str === 'string' && str.includes(',') && !/[a-zA-Z]/.test(str)) return true;
//     return false;
//   };

//   const restaurantAddress = isCoordinates(restaurantAddressRaw) 
//     ? (isQuickOrder ? order?.restaurantAddress || order?.seller?.address || order?.restaurantId?.address || 'Address not available' : order?.restaurantId?.address || 'Address not available')
//     : restaurantAddressRaw;

//   const deliveryAddress = order?.deliveryAddress || {};

//   const geoCoords =
//     Array.isArray(deliveryAddress?.location?.coordinates) &&
//       deliveryAddress.location.coordinates.length >= 2
//       ? {
//         lng: deliveryAddress.location.coordinates[0],
//         lat: deliveryAddress.location.coordinates[1],
//       }
//       : null;

//   const customerLocation = order.customerLocation || order.deliveryLocation || geoCoords || null;

//   const addressPartsFromSchema = [
//     deliveryAddress.street,
//     deliveryAddress.additionalDetails,
//     deliveryAddress.city,
//     deliveryAddress.state,
//     deliveryAddress.zipCode,
//   ]
//     .map((v) => String(v || '').trim())
//     .filter(Boolean);

//   const customerAddress =
//     order.customerAddress ||
//     order.customer_address ||
//     (addressPartsFromSchema.length ? addressPartsFromSchema.join(', ') : '') ||
//     (customerLocation?.lat != null && customerLocation?.lng != null
//       ? `Lat ${Number(customerLocation.lat).toFixed(5)}, Lng ${Number(customerLocation.lng).toFixed(5)}`
//       : 'Location not available');

//   const mapsLink =
//     customerLocation?.lat != null && customerLocation?.lng != null
//       ? `https://www.google.com/maps?q=${encodeURIComponent(
//         `${customerLocation.lat},${customerLocation.lng}`,
//       )}`
//       : null;

//   const pickupStops = pickupPoints.length
//     ? pickupPoints
//     : [
//       {
//         id: order?.dispatchLeg?.legId || 'food:primary',
//         pickupType: order?.dispatchLeg?.pickupType === 'quick' || isQuickOrder ? 'quick' : 'food',
//         sourceName: order?.dispatchLeg?.sourceName || restaurantName,
//         address: order?.dispatchLeg?.address || restaurantAddress,
//       },
//     ];

//   return (
//     <motion.div
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       exit={{ opacity: 0 }}
//       className="absolute inset-x-0 bottom-0 h-full z-150 bg-black/60 flex items-end justify-center p-0"
//     >
//       <motion.div
//         initial={{ y: '100%' }}
//         animate={{ y: 0 }}
//         exit={{ y: '100%' }}
//         className="w-full max-w-lg bg-white rounded-t-[3rem] overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.5)] flex flex-col pt-2"
//       >
//         {/* Handle / Minimize */}
//         <div className="w-full flex justify-center pb-1 pt-1 bg-white relative z-10 rounded-t-[2rem] -mb-[2px]">
//           <button onClick={onMinimize} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
//             <ChevronDown className="w-5 h-5 text-gray-400 stroke-[3px]" />
//           </button>
//         </div>

//         {/* Header Ribbon (Old Green Style) */}
//         <div className="bg-green-500 p-5 flex justify-between items-center text-white border-b border-green-600/20">
//           <div>
//             <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-0.5">Incoming Request</p>
//             {mixedOrder && (
//               <div className="mb-2 inline-flex items-center rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
//                 Mixed Order
//               </div>
//             )}
//             <h2 className="text-3xl font-extrabold tracking-tight">₹{Number(earnings || 0).toFixed(2)}</h2>
//           </div>
//           <div className="bg-white/20 border border-white/30 rounded-2xl px-4 py-2 text-white font-bold text-xl shadow-inner tabular-nums">
//             {timeLeft}s
//           </div>
//         </div>

//         {/* Info Body */}
//         <div className="p-5 pb-8 space-y-6">
//           <div className="flex gap-4">
//             <div className="flex flex-col items-center gap-1 mt-1.5 py-0.5">
//               <div className="w-4 h-4 rounded-full bg-green-500 border-[3px] border-green-50 shadow-lg shadow-green-500/20" />
//               <div className={`w-0.5 ${pickupStops.length > 1 ? 'h-24' : 'h-14'} bg-dashed border-l-2 border-gray-100`} />
//               <div className="w-4 h-4 rounded-full bg-blue-500 border-[3px] border-blue-50 shadow-lg shadow-blue-500/20" />
//             </div>
//             <div className="flex-1 space-y-6">
//               <div className="space-y-4">
//                 {pickupStops.map((pickup, index) => {
//                   const isQuickStore = pickup.pickupType === 'quick';
//                   const pickupLabel = isQuickStore ? 'Store Pickup' : 'Restaurant Pickup';
//                   const pickupAccent = isQuickStore ? 'text-orange-600' : 'text-green-600';
//                   const pickupAddress = pickup.address || 'Address not available';
//                   return (
//                     <div key={pickup.id || `${pickup.pickupType}-${index}`}>
//                       <div className={`flex items-center gap-2 mb-1.5 font-bold text-[9px] uppercase tracking-widest ${pickupAccent}`}>
//                         <ChefHat className="w-3.5 h-3.5" />
//                         <span>{pickupStops.length > 1 ? `${pickupLabel} ${index + 1}` : pickupLabel}</span>
//                       </div>
//                       <p className="text-gray-950 font-bold text-lg leading-tight">{pickup.sourceName || (isQuickStore ? 'Seller store' : 'Restaurant')}</p>
//                       <p className="text-gray-500 text-xs font-medium leading-relaxed line-clamp-1">{pickupAddress}</p>
//                     </div>
//                   );
//                 })}
//               </div>
//               <div>
//                 <div className="flex items-center gap-2 mb-1.5 font-bold text-[9px] uppercase tracking-widest text-blue-600">
//                   <MapPin className="w-3.5 h-3.5" />
//                   <span>Customer Drop</span>
//                 </div>
//                 <p className="text-gray-950 font-bold text-lg leading-tight">Customer Location</p>
//                 <p className="text-gray-500 text-xs font-medium line-clamp-1">{customerAddress}</p>

//                 {mapsLink && (
//                   <a
//                     href={mapsLink}
//                     target="_blank"
//                     rel="noreferrer"
//                     className="inline-flex mt-1 text-[9px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700"
//                   >
//                     Open in Google Maps
//                   </a>
//                 )}

//                 {/* Delivery Instructions */}
//                 {order?.note && (
//                   <div className="flex items-start gap-3 w-full bg-orange-50/50 rounded-xl p-3 shadow-sm border border-orange-100 relative z-10 mt-4">
//                     <div className="w-6 flex flex-col items-center justify-center shrink-0">
//                       <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
//                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
//                       </div>
//                     </div>
//                     <div>
//                       <p className="text-orange-600 text-[10px] font-bold uppercase tracking-wider mb-0.5">Delivery Instructions</p>
//                       <p className="text-gray-900 text-xs font-bold capitalize">"{order.note}"</p>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
//               <Clock className="w-4 h-4 text-orange-500" />
//               <div className="flex flex-col">
//                 <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Time</span>
//                 <span className="text-xs font-bold text-gray-900">{etaMins} MINS</span>
//               </div>
//             </div>
//             <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
//               <MapPin className="w-4 h-4 text-gray-400" />
//               <div className="flex flex-col">
//                 <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Distance</span>
//                 <span className="text-xs font-bold text-gray-900">{distanceKm} KM</span>
//               </div>
//             </div>
//           </div>

//           {/* Action Area */}
//           <div className="space-y-4">
//             <ActionSlider
//               label="Slide to Accept"
//               onConfirm={() => handleAccept(order)}
//               color="bg-[#F26522]"
//               successLabel="Order Accepted ✓"
//             />

//             <button
//               onClick={handleReject}
//               className="w-full text-gray-400 font-bold text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors py-1 active:scale-95"
//             >
//               Pass this task
//             </button>
//           </div>
//         </div>
//       </motion.div>
//     </motion.div>
//   );
// };




import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, MapPin, FastForward, Clock, Phone, ChefHat, ChevronDown } from 'lucide-react';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { getHaversineDistance, calculateETA } from '@/modules/DeliveryV2/utils/geo';
import { isMixedOrder, normalizePickupPoints } from '@/modules/DeliveryV2/utils/orderRouting';

/**
 * NewOrderModal - Ported to Original 1:1 Theme with Slider Accept.
 * Matches the Zomato/Swiggy style Green Header + White Card.
 *
 * FIX (resend bug):
 * Previously the 30s countdown was persisted in localStorage keyed only by
 * orderId. When a seller/restaurant "resent" the same order after the rider
 * missed/ignored it once, the modal would remount with the SAME orderId,
 * read the OLD stale timestamp from localStorage, compute that >30s had
 * already elapsed, set timeLeft to 0, and instantly call onReject() before
 * the rider ever saw the popup — so the request silently vanished from the
 * UI even though the backend/socket had sent fresh data.
 *
 * The fix: build the storage key (and the "this is a new attempt" identity)
 * from something that actually changes on resend — prefer an explicit
 * backend field (dispatchAttemptId / resendId / resendCount / sentAt /
 * updatedAt) if present, and fall back to a locally-generated attempt id
 * the very first time we ever see this order. This guarantees every resend
 * gets its own fresh 30s window, while a normal remount of the SAME
 * still-open attempt (e.g. app minimize -> reopen) still correctly resumes
 * the countdown instead of resetting it.
 */

// Build a stable id that uniquely represents THIS dispatch attempt.
// If the backend sends any of these fields, use them (preferred, since a
// resend should change at least one of them). Otherwise fall back to just
// the orderId (best effort when backend gives us nothing else to key on).
const getAttemptId = (order) => {
  const orderId = order?.orderId || order?._id || 'unknown';
  const attemptSignal =
    order?.dispatchAttemptId ||
    order?.resendId ||
    order?.dispatchLeg?.attemptId ||
    (order?.resendCount != null ? order.resendCount : null) ||
    order?.sentAt ||
    order?.updatedAt ||
    order?.dispatchLeg?.sentAt ||
    order?.dispatchLeg?.updatedAt ||
    null;

  return attemptSignal ? `${orderId}_${attemptSignal}` : orderId;
};

export const NewOrderModal = ({ order, onAccept, onReject, onMinimize }) => {
  const { riderLocation } = useDeliveryStore();

  const orderId = order?.orderId || order?._id || 'unknown';
  const attemptId = order ? getAttemptId(order) : null;

  // Track which attemptId we've already initialized a timer for, so that
  // re-renders of the SAME attempt (e.g. parent re-passing the same order
  // object) don't reset the countdown, but a genuinely NEW attempt
  // (resend) does.
  const initializedAttemptRef = useRef(null);

  const [timeLeft, setTimeLeft] = useState(() => {
    if (!order) return 30;
    return 30;
  });

  // (Re)initialize the timer whenever we detect a NEW attempt for this
  // order (fresh order, or a resend that changed the attempt signal).
  useEffect(() => {
    if (!order || !attemptId) return;

    if (initializedAttemptRef.current === attemptId) {
      // Same attempt as before — don't reset, just let the interval keep going.
      return;
    }

    const storageKey = `delivery_timer_${attemptId}`;
    const storedTime = localStorage.getItem(storageKey);
    const now = Date.now();

    let initialTimeLeft;
    if (storedTime) {
      // Same attempt was already shown before (e.g. minimize -> reopen),
      // resume the countdown instead of resetting it.
      const elapsed = Math.floor((now - parseInt(storedTime, 10)) / 1000);
      initialTimeLeft = Math.max(0, 30 - elapsed);
    } else {
      // Brand new attempt (first time OR a genuine resend) -> fresh 30s.
      localStorage.setItem(storageKey, now.toString());
      initialTimeLeft = 30;
    }

    // Clean up any stale timer keys from previous attempts of this same
    // order so localStorage doesn't accumulate garbage across resends.
    try {
      const prefix = `delivery_timer_${orderId}`;
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix) && k !== storageKey)
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      // non-fatal, ignore storage errors
    }

    initializedAttemptRef.current = attemptId;
    setTimeLeft(initialTimeLeft);
  }, [order, attemptId, orderId]);

  const pickupPoints = order ? normalizePickupPoints(order) : [];
  const primaryPickup = pickupPoints[0] || null;
  const mixedOrder = order ? isMixedOrder(order) : false;

  // Countdown ticker
  useEffect(() => {
    if (!order) return;

    if (timeLeft <= 0) {
      // Clean up this attempt's storage key before auto-rejecting so a
      // future resend (new attempt) never sees this stale timestamp.
      if (attemptId) {
        localStorage.removeItem(`delivery_timer_${attemptId}`);
      }
      onReject();
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onReject, attemptId, order]);

  // Clean up storage key on unmount / when this specific attempt is done,
  // to prevent the exact bug described above: a stale timestamp being read
  // by the next resend.
  useEffect(() => {
    return () => {
      if (attemptId) {
        localStorage.removeItem(`delivery_timer_${attemptId}`);
      }
    };
  }, [attemptId]);

  const handleAccept = () => {
    if (attemptId) {
      localStorage.removeItem(`delivery_timer_${attemptId}`);
    }
    onAccept(order);
  };

  const handleReject = () => {
    if (attemptId) {
      localStorage.removeItem(`delivery_timer_${attemptId}`);
    }
    onReject();
  };

  const { distanceKm, etaMins } = useMemo(() => {
    if (!order) return { distanceKm: null, etaMins: null };

    // A. Use actual store→customer delivery distance (preferred for display)
    //    pickupDistanceKm = rider→store distance (not shown to delivery boy as main distance)
    const deliveryDist = order.distanceKm;  // store → customer (actual delivery distance)
    const rawEta = order.estimatedTime || order.duration || order.eta;

    if (deliveryDist != null) {
      return {
        distanceKm: Number(deliveryDist).toFixed(1),
        etaMins: rawEta && rawEta > 0 ? Math.ceil(rawEta) : Math.ceil((Number(deliveryDist) * 1000) / 416) + 5
      };
    }

    // B. Calculate from locations (Local calculation fallback - rider to customer)
    const rest = primaryPickup?.location || order.restaurantLocation || order.restaurantId?.location || {};
    const resLat = parseFloat(order.restaurant_lat || order.restaurantLat || rest.latitude || rest.lat);
    const resLng = parseFloat(order.restaurant_lng || order.restaurantLng || rest.longitude || rest.lng);

    if (riderLocation && !isNaN(resLat) && !isNaN(resLng)) {
      const distM = getHaversineDistance(
        riderLocation.lat, riderLocation.lng,
        resLat, resLng
      );
      const km = distM / 1000;
      // Assume 25km/h avg for initial estimate (roughly 416m/min)
      const mins = Math.ceil(distM / 416) + (order.prepTime || 5);

      return {
        distanceKm: km.toFixed(1),
        etaMins: mins
      };
    }

    return { distanceKm: '??', etaMins: order.prepTime || 15 };
  }, [order, primaryPickup, riderLocation]);

  if (!order) return null;

  const earnings = order.earnings || order.riderEarning || (order.orderAmount ? order.orderAmount * 0.1 : 0);
  const isQuickOrder = String(order?.orderType || order?.serviceType || order?.type || '').trim().toLowerCase() === 'quick';
  const restaurantName =
    order?.dispatchLeg?.sourceName ||
    (isQuickOrder
      ? order?.storeName || order?.sellerName || order?.seller?.shopName || order?.seller?.name || 'Seller store'
      : order?.restaurantName || order?.restaurant_name || order?.restaurantId?.restaurantName || order?.restaurantId?.name || 'Restaurant');
  const restaurantAddressRaw =
    (isQuickOrder
      ? order?.sellerAddress || order?.storeAddress || order?.sellerAddress || order?.restaurantAddress || order?.restaurantLocation?.address || order?.seller?.location?.address || order?.seller?.location?.formattedAddress || order?.seller?.address || order?.restaurantId?.location?.address || order?.restaurantId?.address
      : order?.restaurantAddress || order?.restaurant_address || order?.restaurantId?.location?.address || order?.restaurantId?.address) ||
    'Address not available';

  const isCoordinates = (str) => {
    if (Array.isArray(str)) return true;
    if (typeof str === 'string' && str.includes(',') && !/[a-zA-Z]/.test(str)) return true;
    return false;
  };

  const restaurantAddress = isCoordinates(restaurantAddressRaw)
    ? (isQuickOrder ? order?.restaurantAddress || order?.seller?.address || order?.restaurantId?.address || 'Address not available' : order?.restaurantId?.address || 'Address not available')
    : restaurantAddressRaw;

  const deliveryAddress = order?.deliveryAddress || {};

  const geoCoords =
    Array.isArray(deliveryAddress?.location?.coordinates) &&
      deliveryAddress.location.coordinates.length >= 2
      ? {
        lng: deliveryAddress.location.coordinates[0],
        lat: deliveryAddress.location.coordinates[1],
      }
      : null;

  const customerLocation = order.customerLocation || order.deliveryLocation || geoCoords || null;

  const addressPartsFromSchema = [
    deliveryAddress.street,
    deliveryAddress.additionalDetails,
    deliveryAddress.city,
    deliveryAddress.state,
    deliveryAddress.zipCode,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  const customerAddress =
    order.customerAddress ||
    order.customer_address ||
    (addressPartsFromSchema.length ? addressPartsFromSchema.join(', ') : '') ||
    (customerLocation?.lat != null && customerLocation?.lng != null
      ? `Lat ${Number(customerLocation.lat).toFixed(5)}, Lng ${Number(customerLocation.lng).toFixed(5)}`
      : 'Location not available');

  const mapsLink =
    customerLocation?.lat != null && customerLocation?.lng != null
      ? `https://www.google.com/maps?q=${encodeURIComponent(
        `${customerLocation.lat},${customerLocation.lng}`,
      )}`
      : null;

  const pickupStops = pickupPoints.length
    ? pickupPoints
    : [
      {
        id: order?.dispatchLeg?.legId || 'food:primary',
        pickupType: order?.dispatchLeg?.pickupType === 'quick' || isQuickOrder ? 'quick' : 'food',
        sourceName: order?.dispatchLeg?.sourceName || restaurantName,
        address: order?.dispatchLeg?.address || restaurantAddress,
      },
    ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-x-0 bottom-0 h-full z-150 bg-black/60 flex items-end justify-center p-0"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full max-w-lg bg-white rounded-t-[3rem] overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.5)] flex flex-col pt-2"
      >
        {/* Handle / Minimize */}
        <div className="w-full flex justify-center pb-1 pt-1 bg-white relative z-10 rounded-t-[2rem] -mb-[2px]">
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
            <ChevronDown className="w-5 h-5 text-gray-400 stroke-[3px]" />
          </button>
        </div>

        {/* Header Ribbon (Old Green Style) */}
        <div className="bg-green-500 p-5 flex justify-between items-center text-white border-b border-green-600/20">
          <div>
            <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-0.5">Incoming Request</p>
            {mixedOrder && (
              <div className="mb-2 inline-flex items-center rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                Mixed Order
              </div>
            )}
            <h2 className="text-3xl font-extrabold tracking-tight">₹{Number(earnings || 0).toFixed(2)}</h2>
          </div>
          <div className="bg-white/20 border border-white/30 rounded-2xl px-4 py-2 text-white font-bold text-xl shadow-inner tabular-nums">
            {timeLeft}s
          </div>
        </div>

        {/* Info Body */}
        <div className="p-5 pb-8 space-y-6">
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1 mt-1.5 py-0.5">
              <div className="w-4 h-4 rounded-full bg-green-500 border-[3px] border-green-50 shadow-lg shadow-green-500/20" />
              <div className={`w-0.5 ${pickupStops.length > 1 ? 'h-24' : 'h-14'} bg-dashed border-l-2 border-gray-100`} />
              <div className="w-4 h-4 rounded-full bg-blue-500 border-[3px] border-blue-50 shadow-lg shadow-blue-500/20" />
            </div>
            <div className="flex-1 space-y-6">
              <div className="space-y-4">
                {pickupStops.map((pickup, index) => {
                  const isQuickStore = pickup.pickupType === 'quick';
                  const pickupLabel = isQuickStore ? 'Store Pickup' : 'Restaurant Pickup';
                  const pickupAccent = isQuickStore ? 'text-orange-600' : 'text-green-600';
                  const pickupAddress = pickup.address || 'Address not available';
                  return (
                    <div key={pickup.id || `${pickup.pickupType}-${index}`}>
                      <div className={`flex items-center gap-2 mb-1.5 font-bold text-[9px] uppercase tracking-widest ${pickupAccent}`}>
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>{pickupStops.length > 1 ? `${pickupLabel} ${index + 1}` : pickupLabel}</span>
                      </div>
                      <p className="text-gray-950 font-bold text-lg leading-tight">{pickup.sourceName || (isQuickStore ? 'Seller store' : 'Restaurant')}</p>
                      <p className="text-gray-500 text-xs font-medium leading-relaxed line-clamp-1">{pickupAddress}</p>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5 font-bold text-[9px] uppercase tracking-widest text-blue-600">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Customer Drop</span>
                </div>
                <p className="text-gray-950 font-bold text-lg leading-tight">Customer Location</p>
                <p className="text-gray-500 text-xs font-medium line-clamp-1">{customerAddress}</p>

                {mapsLink && (
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex mt-1 text-[9px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700"
                  >
                    Open in Google Maps
                  </a>
                )}

                {/* Delivery Instructions */}
                {order?.note && (
                  <div className="flex items-start gap-3 w-full bg-orange-50/50 rounded-xl p-3 shadow-sm border border-orange-100 relative z-10 mt-4">
                    <div className="w-6 flex flex-col items-center justify-center shrink-0">
                      <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      </div>
                    </div>
                    <div>
                      <p className="text-orange-600 text-[10px] font-bold uppercase tracking-wider mb-0.5">Delivery Instructions</p>
                      <p className="text-gray-900 text-xs font-bold capitalize">"{order.note}"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
              <Clock className="w-4 h-4 text-orange-500" />
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Time</span>
                <span className="text-xs font-bold text-gray-900">{etaMins} MINS</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Distance</span>
                <span className="text-xs font-bold text-gray-900">{distanceKm} KM</span>
              </div>
            </div>
          </div>

          {/* Action Area */}
          <div className="space-y-4">
            <ActionSlider
              label="Slide to Accept"
              onConfirm={handleAccept}
              color="bg-[#F26522]"
              successLabel="Order Accepted ✓"
            />

            <button
              onClick={handleReject}
              className="w-full text-gray-400 font-bold text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors py-1 active:scale-95"
            >
              Pass this task
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};