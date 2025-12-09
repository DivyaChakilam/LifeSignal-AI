// app/signup/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

import { auth, db } from "@/firebase";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { normalizeRole, type Role } from "@/lib/roles";
import { isValidE164Phone, sanitizePhone } from "@/lib/phone";

/* ----------------------------------------------- */
/* PASSWORD RULES                                  */
/* ----------------------------------------------- */
const passwordValidation = z
  .string()
  .min(8, { message: "Password must be at least 8 characters." })
  .regex(/[a-z]/, { message: "Must contain a lowercase letter." })
  .regex(/[A-Z]/, { message: "Must contain an uppercase letter." })
  .regex(/[0-9]/, { message: "Must contain a number." })
  .regex(/[^a-zA-Z0-9]/, { message: "Must contain a special character." });

/* ----------------------------------------------- */
/* SIGNUP SCHEMA (UPDATED WITH CONSENTS)           */
/* ----------------------------------------------- */
const signupSchema = z
  .object({
    firstName: z.string().min(2, { message: "First name must be at least 2 characters." }),
    lastName: z.string().min(2, { message: "Last name must be at least 2 characters." }),
    email: z.string().email({ message: "Please enter a valid email." }),

    phone: z.preprocess(
      (v) => (typeof v === "string" ? sanitizePhone(v) : v),
      z
        .string()
        .min(1, { message: "Phone number is required." })
        .refine((value) => isValidE164Phone(value), {
          message: "Enter a valid phone number including country code.",
        })
    ),

    password: passwordValidation,
    confirmPassword: z.string(),

    // NEW CONSENT FIELDS:
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "You must accept the Terms & Conditions.",
    }),
    acceptPrivacy: z.boolean().refine((val) => val === true, {
      message: "You must accept the Privacy Policy.",
    }),

    // Optional:
    acceptMarketing: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/* ----------------------------------------------- */
/* HELPER FUNCTIONS                                */
/* ----------------------------------------------- */

// Save Firebase session cookie (non-blocking)
async function setSessionCookieFast() {
  const u = auth.currentUser;
  if (!u) return;
  const idToken = await u.getIdToken(true);
  fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken }),
    keepalive: true,
  }).catch(() => {});
}

// Accept emergency contact invitation if signup was triggered via invite link
async function maybeAutoAcceptInvite(token: string | null) {
  if (!token) return;
  fetch("/api/emergency_contact/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
    keepalive: true,
  }).catch(() => {});
}

/* ----------------------------------------------- */
/* MAIN COMPONENT + SUSPENSE WRAPPER               */
/* ----------------------------------------------- */

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <SignupPageContent />
    </Suspense>
  );
}

function SignupPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  const role: Role = normalizeRole(params.get("role")) ?? "main_user";
  const token = params.get("token") || null;
  const rawNext = params.get("next");

  const next = useMemo(() => {
    const n = rawNext && rawNext.startsWith("/") ? rawNext : "";
    return n === "/" ? "" : n;
  }, [rawNext]);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_ORIGIN || "";

  const continueUrl = useMemo(() => {
    const q = new URLSearchParams({
      role,
      fromHosted: "1",
      ...(next ? { next } : {}),
      ...(token ? { token } : {}),
    }).toString();
    return `${origin}/verify-email?${q}`;
  }, [origin, role, next, token]);

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
      acceptPrivacy: false,
      acceptMarketing: false,
    },
  });

  const calculatePasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return (score / 5) * 100;
  };

  const watchedPassword = form.watch("password");
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(watchedPassword));
  }, [watchedPassword]);

  /* ----------------------------------------------- */
  /* SUBMIT HANDLER (UPDATED WITH CONSENT LOGGING)   */
  /* ----------------------------------------------- */

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    try {
      setIsSubmitting(true);

      const sanitizedPhone = sanitizePhone(values.phone);

      // 1️⃣ Create Firebase Auth User
      const cred = await createUserWithEmailAndPassword(
        auth,
        values.email.trim().toLowerCase(),
        values.password
      );

      // 2️⃣ Update display name
      const displayName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();
      await updateProfile(cred.user, { displayName });

      // 3️⃣ Save Firestore user profile + consents
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          mainUserUid: cred.user.uid,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          role,
          email: cred.user.email ?? values.email.trim().toLowerCase(),
          phone: sanitizedPhone,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
      
          // NEW CONSENT FIELDS SAVED TO FIRESTORE
          acceptTerms: values.acceptTerms,
          acceptPrivacy: values.acceptPrivacy,
          acceptMarketing: values.acceptMarketing ?? false,
        },
        { merge: true }
      );      

      // 4️⃣ Send email verification
      try {
        await sendEmailVerification(cred.user, {
          url: continueUrl,
          handleCodeInApp: true,
        });
      } catch (err) {
        console.warn("sendEmailVerification failed:", err);
      }

      // 5️⃣ Background actions
      void setSessionCookieFast();
      void maybeAutoAcceptInvite(token);

      // 6️⃣ Redirect
      router.push(
        `/verify-email?email=${encodeURIComponent(values.email)}&role=${encodeURIComponent(
          role
        )}${next ? `&next=${encodeURIComponent(next)}` : ""}${
          token ? `&token=${encodeURIComponent(token)}` : ""
        }`
      );
    } catch (err: any) {
      console.error(err);

      let message = "Something went wrong. Please try again.";
      switch (err?.code) {
        case "auth/email-already-in-use":
          message = "That email is already registered.";
          break;
        case "auth/invalid-email":
          message = "Invalid email address.";
          break;
        case "auth/weak-password":
          message = "Password is too weak.";
          break;
        case "auth/too-many-requests":
          message = "Too many attempts. Try later.";
          break;
      }

      toast({
        title: "Signup failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
  
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-headline">Create Your Account</CardTitle>
            <CardDescription>
              {role === "emergency_contact"
                ? "You’re signing up as an emergency contact."
                : "Create your main user account."}
            </CardDescription>
          </CardHeader>
  
          {/* ---------- FORM ---------- */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                {/* First Name */}
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                {/* Last Name */}
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                {/* Phone */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Phone (with country code)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+15551234567"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Must include country code. Used for emergency voice calls.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
  
                      {/* Strength meter */}
                      {field.value && (
                        <Progress value={passwordStrength} className="mt-2 h-2" />
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                {/* Confirm Password */}
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                {/* ---------------------------- */}
                {/* REQUIRED CONSENTS            */}
                {/* ---------------------------- */}
  
                {/* Terms & Conditions */}
                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="h-4 w-4 mt-1"
                          checked={field.value}
                          onChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormLabel className="text-sm cursor-pointer">
                        I agree to the{" "}
                        <Link href="/terms" className="text-primary underline">
                          Terms & Conditions
                        </Link>
                      </FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                {/* Privacy Policy */}
                <FormField
                  control={form.control}
                  name="acceptPrivacy"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="h-4 w-4 mt-1"
                          checked={field.value}
                          onChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormLabel className="text-sm cursor-pointer">
                        I have read and accept the{" "}
                        <Link href="/privacy" className="text-primary underline">
                          Privacy Policy
                        </Link>
                      </FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                {/* ---------------------------- */}
                {/* OPTIONAL CONSENT             */}
                {/* ---------------------------- */}
  
                <FormField
                  control={form.control}
                  name="acceptMarketing"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3 space-y-0">
                     <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="mt-1"
                      />
                     </FormControl>
                    <FormLabel>Send me helpful tips & product updates (optional)</FormLabel>
                   <FormMessage />
                  </FormItem>
                )}
              />

              </CardContent>
  
              {/* ---------- FOOTER ---------- */}
              <CardFooter className="flex-col gap-4">
                <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create Account"}
                </Button>
  
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    href={`/login?role=${encodeURIComponent(role)}${
                      next ? `&next=${encodeURIComponent(next)}` : ""
                    }${token ? `&token=${encodeURIComponent(token)}` : ""}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    Sign In
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </main>
  
      <Footer />
    </div>
  );
}
