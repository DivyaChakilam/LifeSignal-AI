"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

export function IntervalSetting() {
  const { toast } = useToast();
  const [user] = useAuthState(auth);
  const [currentInterval, setCurrentInterval] = useState<string | undefined>();

  useEffect(() => {
    const fetchInterval = async () => {
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const minutes = snap.data().checkinInterval;
          if (minutes) {
            setCurrentInterval(String(minutes / 60)); // convert back to hours
          }
        }
      } catch (error) {
        console.error("Error fetching interval:", error);
      }
    };

    fetchInterval();
  }, [user]);

  const handleIntervalChange = async (value: string) => {
    if (!user) {
      toast({
        title: "Not logged in",
        description: "Please log in to save settings.",
        variant: "destructive",
      });
      return;
    }

    try {
      const userDocRef = doc(db, "users", user.uid);
      const minutes = Number(value) * 60;

      await setDoc(userDocRef, { checkinInterval: minutes }, { merge: true });

      setCurrentInterval(value); // update UI immediately

      toast({
        title: "Check-in Interval Updated",
        description: `Your check-in interval has been set to every ${value} hours.`,
      });
    } catch (error) {
      console.error("Error saving interval:", error);
      toast({
        title: "Error",
        description: "Could not update interval. Try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl font-headline">Set Interval</CardTitle>
          <CardDescription>Choose your check-in frequency.</CardDescription>
        </div>
        <Clock className="h-8 w-8 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Select onValueChange={handleIntervalChange} value={currentInterval}>
          <SelectTrigger className="w-full text-lg">
            <SelectValue placeholder="Select interval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">Every 6 hours</SelectItem>
            <SelectItem value="10">Every 10 hours</SelectItem>
            <SelectItem value="12">Every 12 hours</SelectItem>
            <SelectItem value="18">Every 18 hours</SelectItem>
            <SelectItem value="24">Every 24 hours</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
