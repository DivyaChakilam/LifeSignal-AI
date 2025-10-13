// src/lib/firebaseAdmin.ts
import "server-only"; // ⛔ Ensure this module is only bundled on the server (Next.js)

import {
  getApps,
  initializeApp,
  cert,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import path from "path";
import fs from "fs";

// --- Load service account from local JSON file ---
const serviceAccountPath = path.resolve(process.cwd(), "serviceAccountKey.json");
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

// --- Initialize the Admin app exactly once ---
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id, // optional but helpful in local dev
  });
}

// --- Create singletons for Admin services ---

export const adminAuth = getAuth();
export const db = getFirestore();
export const messaging = getMessaging();

// Optional: Ignore undefined fields in Firestore writes
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch {
  // Safe to ignore if already set
}
