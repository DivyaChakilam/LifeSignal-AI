"use client";

import { Button } from "@/components/ui/button";
import { Siren } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export function SOSButton() {
  const { toast } = useToast();

  const handleSOS = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");

      await addDoc(collection(db, "alerts"), {
        userId: user.uid,
        type: "SOS",
        status: "Pending",
        triggeredAt: serverTimestamp(),
      });

      toast({
        title: "SOS Alert Sent!",
        description: "Your emergency contacts have been notified.",
        variant: "destructive",
      });
    } catch (err: any) {
      toast({
        title: "SOS failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="text-center bg-destructive/10 border-destructive shadow-lg hover:shadow-xl transition-shadow p-4 rounded-xl">
      <Button
        onClick={handleSOS}
        variant="destructive"
        size="lg"
        className="h-32 w-32 rounded-full text-2xl shadow-lg hover:scale-105 transition-transform"
      >
        <Siren className="h-16 w-16" />
      </Button>
    </div>
  );
}
