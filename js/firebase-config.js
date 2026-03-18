// Firebase SDK (Modular) Version 10
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// 사용자 제공 API Key 및 앱 정보 적용
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "ai-research-agent-3cc69.firebaseapp.com",
    projectId: "ai-research-agent-3cc69",
    storageBucket: "ai-research-agent-3cc69.appspot.com",
    messagingSenderId: "626070239269",
    appId: "1:626070239269:web:4d7abbf05378b4fd4de7cc",
    measurementId: "G-S4FQJLB7S2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, onSnapshot, query, orderBy };
