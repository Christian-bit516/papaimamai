import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD--dlFyJyv1Ku7-iEZ28MfaoJ-UL2acUM",
  authDomain: "proyecto-prediccion-d8e98.firebaseapp.com",
  projectId: "proyecto-prediccion-d8e98",
  storageBucket: "proyecto-prediccion-d8e98.firebasestorage.app",
  messagingSenderId: "556170393049",
  appId: "1:556170393049:web:44eae12ced1d74ee6515c8",
  measurementId: "G-KPRBRG1VHR"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

