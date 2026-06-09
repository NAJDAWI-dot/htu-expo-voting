import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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