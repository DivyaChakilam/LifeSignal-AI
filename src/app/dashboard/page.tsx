"use client";

import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { auth, db } from "@/firebase";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SOSButton } from "@/components/sos-button";
import { ManualCheckIn } from "@/components/manual-checkin";
import { IntervalSetting } from "@/components/interval-setting";
import { StatusCard } from "@/components/status-card";
import { EmergencyContacts } from "@/components/emergency-contacts";
import { VoiceCheckIn } from "@/components/voice-check-in";

export default function DashboardPage() {
  const [lastCheckIn, setLastCheckIn] = useState<Date | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(15);
  const [status, setStatus] = useState<"safe" | "missed" | "unknown">("unknown");
  const [nextCheckIn, setNextCheckIn] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const uref = doc(db, "users", user.uid);

    const unsub = onSnapshot(uref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.lastCheckinAt?.toDate) {
          setLastCheckIn(data.lastCheckinAt.toDate());
        }
        if (data.checkinInterval) {
          setIntervalMinutes(data.checkinInterval);
        }
      }
    });

    return () => unsub();
  }, []);

  // compute status + countdown
  useEffect(() => {
    if (!lastCheckIn) {
      setStatus("unknown");
      setNextCheckIn(null);
      setTimeLeft("");
      return;
    }

    const next = new Date(lastCheckIn.getTime() + intervalMinutes * 60 * 1000);
    setNextCheckIn(next);

    const update = () => {
      const now = new Date();
      if (now > next) {
        setStatus("missed");
        setTimeLeft("Overdue");
      } else {
        setStatus("safe");
        const diff = next.getTime() - now.getTime();
        const mins = Math.floor(diff / 1000 / 60);
        const secs = Math.floor((diff / 1000) % 60);
        const hrs = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        setTimeLeft(
          hrs > 0
            ? `${hrs}h ${remainingMins}m ${secs}s left`
            : `${remainingMins}m ${secs}s left`
        );
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lastCheckIn, intervalMinutes]);

  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-headline font-bold mb-6">
          Your Dashboard
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-white rounded-2xl shadow">
              <h2 className="text-lg font-semibold">Send SOS Alert</h2>
              <SOSButton />
            </div>

            <div className="p-4 bg-white rounded-2xl shadow">
              <h2 className="text-lg font-semibold">Manual Check-in</h2>
              <ManualCheckIn
                lastCheckIn={lastCheckIn}
                intervalMinutes={intervalMinutes}
                status={status}
              />
            </div>

            <div className="p-4 bg-white rounded-2xl shadow">
              <h2 className="text-lg font-semibold">Check-in Interval</h2>
              <IntervalSetting />
            </div>

            <StatusCard
              status={status}
              nextCheckIn={nextCheckIn}
              timeLeft={timeLeft}
            />

            <div className="md:col-span-2 p-4 bg-white rounded-2xl shadow">
              <h2 className="text-lg font-semibold">Emergency Contacts</h2>
              <EmergencyContacts />
            </div>
          </div>

          <div className="lg:col-span-1 p-4 bg-white rounded-2xl shadow">
            <h2 className="text-lg font-semibold">Voice Check-in</h2>
            <VoiceCheckIn />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}