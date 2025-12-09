// src/app/mainuser-settings/page.tsx  (or whatever path you're using)
"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { auth, db } from "@/firebase";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  updateEmail,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";   

export default function PersonalSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // LOADING STATE
  const [loading, setLoading] = useState(true);

  // PROFILE
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // REGIONAL SETTINGS
  const [language, setLanguage] = useState("en-US");
  const [timezone, setTimezone] = useState("America/New_York");

  // SECURITY
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // BUTTON LOADING STATES (optional but nicer UX)
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRegional, setSavingRegional] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  /* ---------------------------------------------------------------------- */
  /*                       LOAD USER DATA FROM FIRESTORE                    */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data() as any;

          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setEmail(data.email || user.email || "");
          setPhone(data.phone || "");

          setLanguage(data.language || "en-US");
          setTimezone(data.timezone || "America/New_York");
        } else {
          // Fallback to Auth for email if no Firestore doc
          setEmail(user.email || "");
        }
      } catch (err) {
        console.error("Failed to load user profile", err);
        toast({
          title: "Error",
          description: "Unable to load your profile.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [toast]);

  /* ---------------------------------------------------------------------- */
  /*                               VALIDATION HELPERS                       */
  /* ---------------------------------------------------------------------- */
  const isValidEmail = (value: string) =>
    /^\S+@\S+\.\S+$/.test(value.trim().toLowerCase());

  /* ---------------------------------------------------------------------- */
  /*                              HANDLERS                                  */
  /* ---------------------------------------------------------------------- */

  const handleSaveProfile = async () => {
    if (!firebaseUser) {
      toast({
        title: "Not signed in",
        description: "Please sign in again to update your profile.",
        variant: "destructive",
      });
    }

    const user = auth.currentUser;
    if (!user) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      toast({
        title: "Missing information",
        description: "First name, last name, and email are required.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setSavingProfile(true);

    try {
      // 1) If email changed, update in Firebase Auth
      if (user.email !== trimmedEmail) {
        try {
          await updateEmail(user, trimmedEmail);
        } catch (error: any) {
          console.error("updateEmail error", error);
          let message = "Failed to update email.";
          if (error?.code === "auth/requires-recent-login") {
            message =
              "For security reasons, please log out and log back in, then try updating your email again.";
          }
          toast({
            title: "Email update error",
            description: message,
            variant: "destructive",
          });
          // Do not continue to Firestore update if Auth update failed
          setSavingProfile(false);
          return;
        }
      }

      // 2) Update Firestore profile
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: trimmedEmail,
        phone: trimmedPhone || null,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Profile updated",
        description: "Your profile information was saved successfully.",
      });
    } catch (error) {
      console.error("handleSaveProfile error", error);
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveRegional = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast({
        title: "Not signed in",
        description: "Please sign in again to update your settings.",
        variant: "destructive",
      });
      return;
    }

    setSavingRegional(true);

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        language,
        timezone,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Settings saved",
        description: "Your regional preferences were updated.",
      });
    } catch (error) {
      console.error("handleSaveRegional error", error);
      toast({
        title: "Error",
        description: "Unable to save regional settings.",
        variant: "destructive",
      });
    } finally {
      setSavingRegional(false);
    }
  };

  const handleChangePassword = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast({
        title: "Not signed in",
        description: "Please sign in again to change your password.",
        variant: "destructive",
      });
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Weak password",
        description: "New password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);

    try {
      const credential = EmailAuthProvider.credential(
        user.email || "",
        currentPassword
      );

      // Re-authenticate the user for security-sensitive operation
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      toast({
        title: "Password updated",
        description: "Your password has been changed.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("handleChangePassword error", error);
      let message = "Failed to change password.";
      if (error?.code === "auth/wrong-password") {
        message = "Current password is incorrect.";
      } else if (error?.code === "auth/weak-password") {
        message = "New password is too weak.";
      } else if (error?.code === "auth/requires-recent-login") {
        message =
          "For security reasons, please log out and log back in, then try again.";
      }

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast({
        title: "Not signed in",
        description: "Please sign in again to delete your account.",
        variant: "destructive",
      });
      return;
    }

    setDeletingAccount(true);

    try {
      // 1) Delete Firestore user document
      await deleteDoc(doc(db, "users", user.uid));

      // 2) Delete Firebase Auth user
      await deleteUser(user);

      toast({
        title: "Account deleted",
        description: "Your account has been permanently removed.",
      });

      router.push("/signup");
    } catch (error: any) {
      console.error("handleDeleteAccount error", error);
      let message = "Unable to delete your account.";
      if (error?.code === "auth/requires-recent-login") {
        message =
          "For security reasons, please log out and log back in, then try deleting your account again.";
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*                                 RENDER                                 */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <p className="text-sm text-muted-foreground">Loading your settings…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-10">
      {/* Close button */}
      <div className="flex justify-end">
        <button
          onClick={() => router.push("/dashboard")}
          className="p-2 rounded-md hover:bg-muted transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-semibold">Your Personal Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal info, account security, and regional preferences.
        </p>
      </div>

      {/* ================= PROFILE ================= */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Edit your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
            />
          </div>

          <Button className="mt-2" onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* ================= REGIONAL SETTINGS ================= */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
          <CardDescription>Select your language and timezone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select onValueChange={setLanguage} value={language}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English (United States)</SelectItem>
                <SelectItem value="en-GB">English (United Kingdom)</SelectItem>
                <SelectItem value="es-ES">Spanish</SelectItem>
                <SelectItem value="fr-FR">French</SelectItem>
                <SelectItem value="de-DE">German</SelectItem>
                <SelectItem value="hi-IN">Hindi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select onValueChange={setTimezone} value={timezone}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="America/New_York">
                  America/New_York
                </SelectItem>
                <SelectItem value="America/Los_Angeles">
                  America/Los_Angeles
                </SelectItem>
                <SelectItem value="America/Chicago">
                  America/Chicago
                </SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
                <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                <SelectItem value="Asia/Singapore">
                  Asia/Singapore
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="mt-2"
            onClick={handleSaveRegional}
            disabled={savingRegional}
          >
            {savingRegional ? "Saving…" : "Save Regional Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* ================= SECURITY ================= */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Change your password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button
            className="mt-2"
            onClick={handleChangePassword}
            disabled={savingPassword}
          >
            {savingPassword ? "Updating…" : "Change Password"}
          </Button>
        </CardContent>
      </Card>

      {/* ================= DANGER ZONE ================= */}
      <Card className="border-red-300">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription className="text-red-500">
            Deleting your account is permanent and cannot be undone.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deletingAccount}>
                {deletingAccount ? "Deleting…" : "Delete Account"}
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action will permanently delete your account and all
                  related data. You will not be able to recover it.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletingAccount}>
                  Cancel
                </AlertDialogCancel>

                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                >
                  Yes, Delete My Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
