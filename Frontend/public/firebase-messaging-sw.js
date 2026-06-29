/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// ─── FIX #1: Load Firebase config synchronously ──────────────────────────────
// firebase-web-config.js is generated at build time by scripts/generate-firebase-config.js
// and sets self.FIREBASE_WEB_CONFIG. Using importScripts here guarantees the Firebase
// app is initialized *synchronously* during SW evaluation, so the browser correctly
// sees a push handler before any push events arrive.
// (The old approach used an async fetch + IIFE which deferred handler registration
//  past the synchronous evaluation window, silently dropping all background pushes.)
try {
  importScripts("/firebase-web-config.js");
} catch (e) {
  // If the config JS is missing (old build), log clearly and stop — don't crash the SW.
  console.error("[push-sw] firebase-web-config.js not found. Background push is disabled.", e);
}

const sanitize = (value) => String(value || "").trim().replace(/^['\"]|['\"]$/g, "");
const PUSH_DEBUG_PREFIX = "[push-sw]";
const pushDebugLog = () => { };

const getNotificationKey = (payload) =>
  payload?.data?.notificationId ||
  payload?.data?.messageId ||
  payload?.messageId ||
  [
    payload?.notification?.title || payload?.data?.title || "",
    payload?.notification?.body || payload?.data?.body || "",
    payload?.data?.orderId || "",
    payload?.data?.targetUrl || payload?.data?.link || "",
  ].join("::");

async function notifyOpenClients(payload) {
  pushDebugLog(PUSH_DEBUG_PREFIX, "Broadcasting push to open clients", { payload });
  const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
  windowClients.forEach((client) => {
    client.postMessage({
      type: "push-notification-received",
      payload,
    });
  });
}

function getTargetPathFromPayload(payload = {}) {
  const rawTarget =
    payload?.data?.targetUrl ||
    payload?.data?.link ||
    payload?.data?.click_action ||
    payload?.fcmOptions?.link ||
    "/";

  try {
    const url = new URL(rawTarget, self.location.origin);
    return url.pathname || "/";
  } catch {
    return "/";
  }
}

async function hasVisibleClientForTarget(payload = {}) {
  const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
  const targetPath = getTargetPathFromPayload(payload);
  const targetRoot = `/${String(targetPath).split("/").filter(Boolean)[0] || ""}`;
  const visibleClient = windowClients.find((client) => {
    const isVisible = client.visibilityState === "visible" || client.focused;
    if (!isVisible) return false;
    try {
      const clientUrl = new URL(client.url);
      if (targetRoot === "/" || !targetRoot) {
        return true;
      }
      return clientUrl.pathname.startsWith(targetRoot);
    } catch {
      return false;
    }
  });
  return Boolean(visibleClient);
}

// ─── FIX #1 (continued): Synchronous Firebase init ───────────────────────────
// self.FIREBASE_WEB_CONFIG is set by the importScripts call above.
// We initialize Firebase synchronously here so the push handler is registered
// before the browser finishes evaluating this script.
const _swConfig = self.FIREBASE_WEB_CONFIG || {};

if (
  _swConfig.VITE_FIREBASE_API_KEY &&
  _swConfig.VITE_FIREBASE_PROJECT_ID &&
  _swConfig.VITE_FIREBASE_APP_ID &&
  _swConfig.VITE_FIREBASE_MESSAGING_SENDER_ID
) {
  const firebaseConfig = {
    apiKey: sanitize(_swConfig.VITE_FIREBASE_API_KEY),
    authDomain: sanitize(_swConfig.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: sanitize(_swConfig.VITE_FIREBASE_PROJECT_ID),
    appId: sanitize(_swConfig.VITE_FIREBASE_APP_ID),
    messagingSenderId: sanitize(_swConfig.VITE_FIREBASE_MESSAGING_SENDER_ID),
    storageBucket: sanitize(_swConfig.VITE_FIREBASE_STORAGE_BUCKET),
    measurementId: sanitize(_swConfig.VITE_FIREBASE_MEASUREMENT_ID),
  };

  firebase.initializeApp(firebaseConfig);
  pushDebugLog(PUSH_DEBUG_PREFIX, "Firebase messaging service worker initialized (synchronous)");
  const messaging = firebase.messaging();

  // ─── FIX #2: Only one push handler — the Firebase SDK's own ─────────────────
  // The old code had BOTH messaging.onBackgroundMessage() AND a manual
  // self.addEventListener("push", ...) that called event.waitUntil(Promise.resolve()).
  // That instant resolve told the browser to kill the SW immediately, terminating
  // Firebase's handler before it could call showNotification().
  // Now we only use onBackgroundMessage() — the SDK manages the event lifecycle.
  messaging.onBackgroundMessage(async (payload) => {
    pushDebugLog(PUSH_DEBUG_PREFIX, "Received Firebase background message", { payload });

    // Always show a system OS notification — even if the app tab is open.
    const title =
      payload?.notification?.title ||
      payload?.data?.title ||
      "New Notification";
    const body =
      payload?.notification?.body ||
      payload?.data?.body ||
      "";
    const image =
      payload?.notification?.image ||
      payload?.data?.image ||
      payload?.data?.imageUrl ||
      undefined;
    const notificationKey = getNotificationKey(payload);

    pushDebugLog(PUSH_DEBUG_PREFIX, "Showing service worker notification", {
      title,
      body,
      image,
      notificationKey,
    });

    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      image,
      tag: notificationKey,
      renotify: true,
      silent: false,
      requireInteraction: false,
      vibrate: [200, 100, 200, 100, 300],
      data: payload?.data || {},
    });

    // Also notify open clients for in-app sound playback
    await notifyOpenClients(payload);
  });
} else {
  console.warn("[push-sw] Firebase config missing or incomplete. Background push disabled.");
}

// ─── FIX #2: Manual push listener REMOVED ────────────────────────────────────
// The old self.addEventListener("push", ...) with event.waitUntil(Promise.resolve())
// was causing the SW to be killed before Firebase could show the notification.
// Firebase SDK handles push events internally via onBackgroundMessage above.

self.addEventListener("notificationclick", (event) => {
  pushDebugLog(PUSH_DEBUG_PREFIX, "Notification click received", {
    data: event?.notification?.data || {},
  });
  event.notification.close();
  const rawLink =
    event?.notification?.data?.link ||
    event?.notification?.data?.click_action ||
    event?.notification?.data?.targetUrl ||
    "/";
  const targetUrl = String(rawLink || "/").startsWith("/") ? String(rawLink || "/") : "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const client = windowClients.find((c) => c.url.includes(self.location.origin));
      if (client) {
        client.focus();
        return client.navigate(targetUrl);
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
