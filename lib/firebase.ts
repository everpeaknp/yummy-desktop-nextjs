import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

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

export async function signInWithGoogle(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return idToken;
}

export { auth };
