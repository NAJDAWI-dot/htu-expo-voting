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
   apiKey: "AIzaSyDBgdySfhJF7ST6cZy4zOlofQyLO5OLQ5M",
  authDomain: "designexpo-d7d36.firebaseapp.com",
  projectId: "designexpo-d7d36",
  storageBucket: "designexpo-d7d36.firebasestorage.app",
  messagingSenderId: "14295056966",
  appId: "1:14295056966:web:5746459a45d186866d0047"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

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