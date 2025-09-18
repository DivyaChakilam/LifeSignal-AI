"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

// Define the types for the component props
interface UserSettingsDialogProps {
  mainUserUid: string;
  emergencyContactUid: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({
  mainUserUid,
  emergencyContactUid,
  open,
  onOpenChange,
}: UserSettingsDialogProps) {
  const { toast } = useToast();

  const [notifyPolicy, setNotifyPolicy] = useState("immediate");
  const [delayMinutes, setDelayMinutes] = useState("");
  const [repeatEveryMinutes, setRepeatEveryMinutes] = useState("");
  const [maxRepeatsPerWindow, setMaxRepeatsPerWindow] = useState("");
  const [saving, setSaving] = useState(false);

  // 🔄 Load settings from Firestore when dialog opens
  useEffect(() => {
    if (open && mainUserUid && emergencyContactUid) {
      const ref = doc(
        db,
        "users",
        mainUserUid,
        "emergency_contact",
        emergencyContactUid
      );
      getDoc(ref).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setNotifyPolicy(data.notifyPolicy || "immediate");
          setDelayMinutes(data.delayMinutes?.toString() || "");
          setRepeatEveryMinutes(data.repeatEveryMinutes?.toString() || "");
          setMaxRepeatsPerWindow(data.maxRepeatsPerWindow?.toString() || "");
        }
      });
    }
  }, [open, mainUserUid, emergencyContactUid]);

  // 💾 Save settings to Firestore
  const handleSave = async () => {
    try {
      setSaving(true);

      const ref = doc(
        db,
        "users",
        mainUserUid,
        "emergency_contact",
        emergencyContactUid
      );

      const repeatsEnabled = parseInt(repeatEveryMinutes) > 0;

      await setDoc(
        ref,
        {
          notifyPolicy,
          delayMinutes:
            notifyPolicy === "delay" && delayMinutes
              ? parseInt(delayMinutes)
              : null,
          repeatEveryMinutes: repeatEveryMinutes
            ? parseInt(repeatEveryMinutes)
            : 0,
          maxRepeatsPerWindow: maxRepeatsPerWindow
            ? parseInt(maxRepeatsPerWindow)
            : notifyPolicy === "delay" || repeatsEnabled
            ? 3 // default if repeats are enabled
            : 1, // default if repeats disabled
        },
        { merge: true }
      );

      toast({
        title: "✅ Settings saved",
        description: "Your notification preferences have been updated.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "❌ Failed to save settings",
        description: "Something went wrong while updating preferences.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>User Settings</DialogTitle>
          <DialogDescription>
            Configure how and when this contact gets notified if the main user
            misses a check-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Notify Policy */}
          <div>
            <Label>Notify Policy</Label>
            <Select value={notifyPolicy} onValueChange={setNotifyPolicy}>
              <SelectTrigger>
                <SelectValue placeholder="Select a policy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">
                  Immediate – notify right away
                </SelectItem>
                <SelectItem value="delay">
                  Delay – wait before notifying
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Choose whether notifications are sent immediately or after a
              delay.
            </p>
          </div>

          {/* Delay Minutes - only if policy = delay */}
          {notifyPolicy === "delay" && (
            <div>
              <Label>Delay Minutes</Label>
              <Input
                type="number"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
                placeholder="e.g. 10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Number of minutes to wait before the first notification.
              </p>
            </div>
          )}

          {/* Repeat Every */}
          <div>
            <Label>Repeat Every (minutes)</Label>
            <Input
              type="number"
              value={repeatEveryMinutes}
              onChange={(e) => setRepeatEveryMinutes(e.target.value)}
              placeholder="e.g. 10"
            />
            <p className="text-xs text-muted-foreground mt-1">
              How often to repeat notifications if still no check-in. Set 0 to
              disable repeats.
            </p>
          </div>

          {/* Max Repeats */}
          <div>
            <Label>Max Repeats Per Window</Label>
            <Input
              type="number"
              value={maxRepeatsPerWindow}
              onChange={(e) => setMaxRepeatsPerWindow(e.target.value)}
              placeholder="e.g. 5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum number of notifications allowed per missed check-in
              window.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
