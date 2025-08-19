"use client";

import { auth, db } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

export function ManualCheckIn() {
  const [user] = useAuthState(auth);

  const handleCheckIn = async () => {
    if (!user) return;

    try {
      await addDoc(collection(db, "checkins"), {
        userId: user.uid,
        status: "OK",
        createdAt: serverTimestamp(),
      });
      alert("✅ Check-in successful!");
    } catch (error) {
      console.error("Error checking in:", error);
      alert("❌ Failed to check in.");
    }
  };

  return (
    <div className="p-4 bg-white rounded-2xl shadow-md">
      <h2 className="text-xl font-bold mb-2">Manual Check-In</h2>
      <p className="text-sm text-gray-600 mb-4">
        Click below when you want to confirm you are safe.
      </p>
      <button
        onClick={handleCheckIn}
        className="bg-blue-600 text-white px-4 py-2 rounded-md w-full"
      >
        Check In
      </button>
    </div>
  );
}
