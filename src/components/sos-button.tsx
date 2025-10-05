"use client";

import { Button } from "@/components/ui/button";
import { Siren } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";

export function SOSButton() {
  const { toast } = useToast();

  const handleSOS = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");

      // Log SOS event in Firestore
      await addDoc(collection(db, "alerts"), {
        userId: user.uid,
        type: "SOS",
        status: "Pending",
        triggeredAt: serverTimestamp(),
      });

      // Fetch user profile
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) throw new Error("User profile not found");

      const data = snap.data();
      const contacts = data.emergencyContacts || {};

      // Build call options
      const options: { label: string; phone: string }[] = [
        { label: "Call 911", phone: "911" },
      ];

      if (contacts.contact1_phone) {
        options.push({
          label: `Call ${contacts.contact1_firstName || "Contact 1"} ${contacts.contact1_lastName || ""}`,
          phone: contacts.contact1_phone,
        });
      }

      if (contacts.contact2_phone) {
        options.push({
          label: `Call ${contacts.contact2_firstName || "Contact 2"} ${contacts.contact2_lastName || ""}`,
          phone: contacts.contact2_phone,
        });
      }

      // Render options as a simple browser prompt
      const choiceText = options
        .map((opt, i) => `${i + 1}. ${opt.label}`)
        .join("\n");

      const choice = window.prompt(`Choose an emergency call option:\n${choiceText}`);
      const idx = choice ? parseInt(choice.trim()) - 1 : -1;

      if (idx >= 0 && idx < options.length) {
        window.location.href = `tel:${options[idx].phone}`;
        toast({
          title: "SOS Triggered",
          description: `Calling ${options[idx].label}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "No action taken",
          description: "You cancelled the SOS call.",
        });
      }
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
