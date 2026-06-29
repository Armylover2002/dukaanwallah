import { useState, useEffect, useRef } from "react";
import { deliveryAPI } from "@food/api";
import { toast } from "sonner";
import { useDeliveryStore } from "../store/useDeliveryStore";

export function useDeliveryReturnNotifier() {
  const [returnCount, setReturnCount] = useState(0);
  const prevCountRef = useRef(null);
  const isOnline = useDeliveryStore((state) => state.isOnline);

  useEffect(() => {
    if (!isOnline) return;

    const checkReturnPickups = async () => {
      try {
        const res = await deliveryAPI.getReturnPickups();
        let pickups = [];
        if (res?.data?.success && Array.isArray(res?.data?.result)) {
          pickups = res.data.result;
        } else if (Array.isArray(res?.data)) {
          pickups = res.data;
        } else if (res?.data?.result) {
          pickups = res.data.result;
        }

        // Count pending pickups assigned to the rider
        const pendingPickups = pickups.filter(p => p.status === 'pickup_assigned');
        const count = pendingPickups.length;

        if (prevCountRef.current !== null && count > prevCountRef.current) {
          const added = count - prevCountRef.current;
          toast.warning(
            `📦 ${added} new Return Pickup${added > 1 ? "s" : ""} Assigned!`,
            {
              description: "Check the Returns tab for details.",
              duration: 8000,
            }
          );
          
          // Try to vibrate
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
        }

        prevCountRef.current = count;
        setReturnCount(count);
      } catch (err) {
        // silently ignore polling errors
      }
    };

    checkReturnPickups(); // Initial fetch
    const intervalId = setInterval(checkReturnPickups, 60_000); // Check every 60 seconds

    return () => clearInterval(intervalId);
  }, [isOnline]);

  return returnCount;
}
