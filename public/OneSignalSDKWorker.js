importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Minimal fetch handler required for PWA installability on Chrome/Edge (Windows).
// Does not call event.respondWith() so it won't interfere with OneSignal's handlers.
self.addEventListener('fetch', function(event) {
  return;
});
