"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/firebase";
import {
  updateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
} from "firebase/auth";
import {
  doc,
  updateDoc,
  onSnapshot,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  });

  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) return router.push("/login");
      setUser(u);

      const ref = doc(db, "users", u.uid);
      onSnapshot(ref, (snap) => {
        const data = snap.data();
        setProfile((p) => ({
          ...p,
          name: u.displayName || "",
          email: u.email || "",
          phone: data?.phone || "",
          timezone: data?.timezone || p.timezone,
          language: data?.language || p.language,
        }));
      });
    });

    return () => unsub();
  }, []);

  const handleProfileSave = async () => {
    try {
      if (!user) return;

      await updateProfile(user, { displayName: profile.name });
      await updateEmail(user, profile.email);

      await updateDoc(doc(db, "users", user.uid), {
        phone: profile.phone || deleteField(),
        timezone: profile.timezone,
        language: profile.language,
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Profile updated", description: "Your changes were saved." });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword.trim()) return;
    try {
      await updatePassword(user, newPassword);
      toast({ title: "Password changed" });
      setNewPassword("");
    } catch (e: any) {
      toast({ title: "Password update failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteUser(user);
      toast({ title: "Account deleted" });
      router.push("/login");
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Your Personal Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Edit your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label>Name</Label>
          <Input
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />

          <Label>Email</Label>
          <Input
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
          />

          <Label>Phone</Label>
          <Input
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />

          <Button onClick={handleProfileSave}>Save Profile</Button>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Language & Timezone */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
          <CardDescription>Language and timezone preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label>Language</Label>
          <Input
            value={profile.language}
            onChange={(e) => setProfile({ ...profile, language: e.target.value })}
          />

          <Label>Timezone</Label>
          <Input
            value={profile.timezone}
            onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
          />

          <Button onClick={handleProfileSave}>Save Regional Settings</Button>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Update your password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label>New Password</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Button onClick={handlePasswordChange}>Change Password</Button>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Delete Account */}
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Deleting your account is permanent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="destructive" onClick={handleDeleteAccount}>
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
