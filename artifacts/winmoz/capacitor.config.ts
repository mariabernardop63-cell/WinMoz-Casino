import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.mozbet.app",
  appName: "MozBet",
  webDir: "dist/public",

  // If CAPACITOR_SERVER_URL is set (production CI), loads directly from the
  // live Vercel server — all /api calls work natively, updates are instant.
  // If not set (local testing), the bundled dist/public assets are used instead.
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: false,
          androidScheme: "https",
          iosScheme: "https",
        },
      }
    : {}),

  android: {
    // Disable JS debugging in WebView (critical for production APK)
    webContentsDebuggingEnabled: false,
    // Prevent mixed content (HTTP inside HTTPS)
    allowMixedContent: false,
    // Capture input for better keyboard handling
    captureInput: true,
    // Use hardware back button for navigation
    backForceQuit: false,
  },

  plugins: {},
};

export default config;
