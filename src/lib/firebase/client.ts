import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return initializeApp(firebaseConfig);
}

let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getClientAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function getClientDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

export function getClientStorage(): FirebaseStorage {
  if (!storage) storage = getStorage(getFirebaseApp());
  return storage;
}
