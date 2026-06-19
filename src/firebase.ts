import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from "firebase/storage";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  runTransaction, 
  query, 
  orderBy, 
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  increment,
  writeBatch
} from "firebase/firestore";

// REPLACE THESE WITH YOUR KEYS FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

import { getAnalytics, isSupported } from "firebase/analytics";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Initialize Analytics conditionally (it can fail if adblockers are active or environments don't support it)
export const analytics = typeof window !== 'undefined' ? isSupported().then(yes => yes ? getAnalytics(app) : null) : null;

export { 
  signInWithEmailAndPassword, 
  signOut, 
  signInAnonymously, 
  onAuthStateChanged,
  collection,
  addDoc,
  deleteDoc,
  doc,
  runTransaction,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  increment,
  writeBatch,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
};