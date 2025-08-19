"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Timer } from "lucide-react";
import { auth, db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

export function StatusCard() {
  const [lastCheckIn, setLastCheckIn] = useState<Date | null>(null);
  const [intervalHours, setIntervalHours] = useState<number | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // Read from Firestore
        const settingsRef = doc(db, "users", user.uid, "settings", "preferences");
        const checkinRef = doc(db, "users", user.uid, "checkins", "latest");

        const [settingsSnap, checkinSnap] = await Promise.all([getDoc(settingsRef), getDoc(checkinRef)]);

        if (settingsSnap.exists()) {
          setIntervalHours(settingsSnap.data().checkinInterval);
        }
        if (checkinSnap.exists()) {
          const ts = checkinSnap.data().timestamp?.toDate?.();
          if (ts) setLastCheckIn(ts);
        }
      } catch (err) {
        console.error("Error fetching status:", err);
      }
    };

    fetchStatus();
  }, []);

  // Compute next scheduled check-in
  let nextCheckIn: Date | null = null;
  if (lastCheckIn && intervalHours) {
    nextCheckIn = new Date(lastCheckIn.getTime() + intervalHours * 60 * 60 * 1000);
  }

  const formatTime = (date: Date | null) =>
    date ? date.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl font-headline">Status</CardTitle>
          <CardDescription>Your latest activity.</CardDescription>
        </div>
        <Timer className="h-8 w-8 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-lg">
          Last Check-in:{" "}
          <span className="font-bold text-primary">{lastCheckIn ? formatTime(lastCheckIn) : "No check-ins yet"}</span>
        </p>
        <p className="text-lg">
          Next scheduled check-in:{" "}
          <span className="font-bold text-primary">{nextCheckIn ? formatTime(nextCheckIn) : "Not scheduled"}</span>
        </p>
        <p className="text-lg">
          Location Sharing: <span className="font-bold text-green-500">Enabled</span>
        </p>
      </CardContent>
    </Card>
  );
}
