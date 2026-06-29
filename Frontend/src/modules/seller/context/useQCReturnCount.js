import { useState, useEffect, useRef, useCallback } from "react";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 60_000; // poll every 60 seconds

/**
 * useQCReturnCount
 *
 * Polls the seller's pending QC return count every 60 seconds.
 * Shows a toast notification when the count increases (new returns came in).
 *
 * Returns: { count: number, loading: boolean }
 */
export function useQCReturnCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const prevCountRef = useRef(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await sellerApi.getQCReturnCount();
      const newCount = Number(res?.data?.count ?? 0);

      // Notify seller only when count *increases* (new returns arrived)
      // Skip notification on the very first load (prevCountRef.current === null)
      if (prevCountRef.current !== null && newCount > prevCountRef.current) {
        const added = newCount - prevCountRef.current;
        toast.warning(
          `📦 ${added} new QC return request${added > 1 ? "s" : ""} received!`,
          {
            description: "Go to QC Returns to review and confirm.",
            duration: 8000,
            action: {
              label: "View Returns",
              onClick: () => {
                window.location.href = "/seller/return-orders";
              },
            },
          }
        );
      }

      prevCountRef.current = newCount;
      setCount(newCount);
    } catch {
      // silently ignore poll errors — don't distract the seller
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount(); // initial fetch on mount

    const intervalId = setInterval(fetchCount, POLL_INTERVAL_MS);

    // Also refresh when the seller comes back to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCount();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchCount]);

  return { count, loading };
}
