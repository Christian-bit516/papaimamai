import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB-Q-bR9Lb4ljyLaEuBCn4rzNCowH0CGCQ",
  authDomain: "meme-bea08.firebaseapp.com",
  projectId: "meme-bea08",
  storageBucket: "meme-bea08.firebasestorage.app",
  messagingSenderId: "840050746214",
  appId: "1:840050746214:web:fabca2c133ab6e6ae59ea7",
  measurementId: "G-CNNHY4QMHJ"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
