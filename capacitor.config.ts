import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iOS app is a native shell around the live site: it loads production
 * over the network, so a web deploy updates the app too. Only changes under
 * ios/ (or to this file, or to a native plugin) need a new App Store build,
 * which .github/workflows/ios.yml produces.
 */
const config: CapacitorConfig = {
  appId: "com.kkrwhofrags.hellblazer",
  appName: "Fatty",
  // Bundled into the app. Only offline.html is ever shown: when the site
  // can't load at launch and the service worker has nothing cached yet.
  webDir: "app-shell",
  backgroundColor: "#000000",
  // Lets the server tell app traffic apart from the website's.
  appendUserAgent: "Fatty",
  server: {
    url: "https://hellblazer.vercel.app",
    errorPath: "offline.html",
  },
  ios: {
    // The page already pads for the notch and home bar (viewport-fit=cover).
    contentInset: "never",
    // Required for the service worker to run in WKWebView. The domains are
    // listed under WKAppBoundDomains in ios/App/App/Info.plist.
    limitsNavigationsToAppBoundDomains: true,
    // Lets Safari's Web Inspector attach to TestFlight builds over USB.
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    // Compile in only the providers we use; the rest pull in large SDKs.
    SocialLogin: {
      providers: {
        google: "implementation",
        apple: "implementation",
        facebook: "compileOnly",
        twitter: "compileOnly",
      },
    },
    // A push that arrives while the app is open still shows as a banner.
    PushNotifications: {
      presentationOptions: ["banner", "sound", "list"],
    },
  },
};

export default config;
