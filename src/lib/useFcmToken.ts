// src/lib/useFcmToken.ts
import { messagingPromise, db } from "@/firebase";
import { getToken } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import type { User } from "firebase/auth";

// ✅ Replace with your Firebase web push certificate key (VAPID key)
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY as string;

export async function saveFcmToken(user: User) {
  try {
    const messaging = await messagingPromise;
    if (!messaging) {
      console.warn("Messaging not supported in this browser.");
      return;
    }

    // Ask notification permission from user
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission not granted.");
      return;
    }

    // Get FCM token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      console.warn("Failed to get FCM token.");
      return;
    }

    console.log("FCM Token:", token);

    // Save token to Firestore under user’s document
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
    });

    console.log("FCM token saved for user:", user.uid);
  } catch (error) {
    console.error("Error saving FCM token:", error);
  }
}
