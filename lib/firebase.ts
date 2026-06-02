import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCfqttcWmCqNd4IYagLXMiVzJpluwHw2Ts",
  authDomain: "yummy-de17e.firebaseapp.com",
  projectId: "yummy-de17e",
  storageBucket: "yummy-de17e.firebasestorage.app",
  messagingSenderId: "193921174442",
  appId: "1:193921174442:web:a32db6445f89afbcdd39d3",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

type ElectronBridge = { isDesktopShell?: boolean };

function getElectronBridge(): ElectronBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { electronAPI?: ElectronBridge }).electronAPI;
}

/**
 * Firebase blocks signInWithPopup in Electron (auth/popup-blocked).
 * Redirect flow is required for the desktop app.
 */
export function isElectronRuntime(): boolean {
  if (getElectronBridge()?.isDesktopShell) return true;
  if (typeof navigator !== "undefined" && /\bElectron\b/i.test(navigator.userAgent)) {
    return true;
  }
  return false;
}

function shouldUseGoogleRedirect(): boolean {
  return isElectronRuntime();
}

function buildGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.addScope("openid");
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

async function ensureAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Already configured or unsupported — safe to ignore.
  }
}

/**
 * After signInWithRedirect, call on the login page when it reloads.
 * Returns an ID token if the user just completed Google sign-in, else null.
 */
export async function completeGoogleRedirectIfNeeded(): Promise<string | null> {
  try {
    await ensureAuthPersistence();
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    return result.user.getIdToken(true);
  } catch (err) {
    console.error("[firebase] getRedirectResult failed", err);
    throw err;
  }
}

async function signInWithGoogleRedirect(provider: GoogleAuthProvider): Promise<null> {
  await ensureAuthPersistence();
  await signInWithRedirect(auth, provider);
  return null;
}

function isPopupBlockedError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "auth/popup-blocked" || code === "auth/cancelled-popup-request";
}

/**
 * Returns Firebase ID token, or null when a full-page redirect was started.
 */
export async function signInWithGoogle(): Promise<string | null> {
  const provider = buildGoogleProvider();

  if (shouldUseGoogleRedirect()) {
    return signInWithGoogleRedirect(provider);
  }

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user.getIdToken(true);
  } catch (err) {
    if (isPopupBlockedError(err)) {
      return signInWithGoogleRedirect(provider);
    }
    throw err;
  }
}

export { auth };
