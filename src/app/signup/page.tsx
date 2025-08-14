
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, HeartHandshake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Role = "user" | "contact";

const nameValidation = z.string().min(1, { message: "Name is required" }).regex(/^[a-zA-Z\s'-]+$/, { message: "Name can only contain letters, spaces, hyphens, and apostrophes." });
const phoneValidation = z.string().min(1, { message: "Phone number is required" }).regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid phone number format." });

const userDetailsSchema = z.object({
  name: nameValidation,
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
});

const userContactsSchema = z.object({
  contact1_name: nameValidation,
  contact1_email: z.string().email({ message: "Invalid email address." }),
  contact1_phone: phoneValidation,
  contact2_name: nameValidation.optional().or(z.literal('')),
  contact2_email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  contact2_phone: phoneValidation.optional().or(z.literal('')),
  locationConsent: z.boolean().refine(val => val === true, { message: "You must allow location sharing." }),
  terms: z.boolean().refine(val => val === true, { message: "You must agree to the terms." }),
});

const caregiverSchema = z.object({
  inviteCode: z.string().min(8, {message: "Invite code must be at least 8 digits."}),
});

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const userDetailsForm = useForm<z.infer<typeof userDetailsSchema>>({
    resolver: zodResolver(userDetailsSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const userContactsForm = useForm<z.infer<typeof userContactsSchema>>({
    resolver: zodResolver(userContactsSchema),
    defaultValues: {
        contact1_name: "",
        contact1_email: "",
        contact1_phone: "",
        contact2_name: "",
        contact2_email: "",
        contact2_phone: "",
        locationConsent: false,
        terms: false,
    },
  });

  const caregiverForm = useForm<z.infer<typeof caregiverSchema>>({
    resolver: zodResolver(caregiverSchema),
    defaultValues: { inviteCode: "" },
  });

  const handleRoleSelect = () => {
    if (role) {
      setStep(2);
    } else {
      toast({
        title: "Selection Required",
        description: "Please choose a profile type to continue.",
        variant: "destructive",
      });
    }
  };

  const onUserDetailsSubmit = () => {
      setStep(3);
  }

  const handleFinalSubmit = () => {
    toast({
      title: "Account Created!",
      description: "Welcome to LifeSignal AI. Redirecting you to your dashboard.",
    });
    if (role === 'user') {
      router.push("/dashboard");
    } else {
      router.push("/emergency-dashboard");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-xl">
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-3xl font-headline">Create Your Account</CardTitle>
                <CardDescription>First, tell us who you are.</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup onValueChange={(value: Role) => setRole(value)} className="space-y-4">
                  <Label htmlFor="role-user" className={`flex items-center gap-4 border p-6 rounded-lg cursor-pointer transition-all ${role === 'user' ? 'bg-secondary border-primary shadow-md' : 'hover:bg-secondary/50'}`}>
                    <RadioGroupItem value="user" id="role-user" className="h-6 w-6" />
                    <User className="h-10 w-10 text-accent" />
                    <div>
                      <h3 className="font-bold text-lg">User</h3>
                      <p className="text-muted-foreground">I am the one who will be using the app for my own safety.</p>
                    </div>
                  </Label>
                  <Label htmlFor="role-contact" className={`flex items-center gap-4 border p-6 rounded-lg cursor-pointer transition-all ${role === 'contact' ? 'bg-secondary border-primary shadow-md' : 'hover:bg-secondary/50'}`}>
                    <RadioGroupItem value="contact" id="role-contact" className="h-6 w-6" />
                    <HeartHandshake className="h-10 w-10 text-accent" />
                    <div>
                      <h3 className="font-bold text-lg">Emergency Contact / Caregiver</h3>
                      <p className="text-muted-foreground">I will be monitoring and assisting a User.</p>
                    </div>
                  </Label>
                </RadioGroup>
              </CardContent>
              <CardFooter>
                <Button onClick={handleRoleSelect} className="w-full text-lg py-6">Continue</Button>
              </CardFooter>
            </>
          )}

          {step === 2 && (
            <Form {...userDetailsForm}>
              <form onSubmit={userDetailsForm.handleSubmit(onUserDetailsSubmit)}>
                  <CardHeader>
                    <CardTitle className="text-3xl font-headline">Your Details</CardTitle>
                    <CardDescription>Let's get your basic information.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <Button type="button" className="w-full text-lg py-6 flex items-center gap-3">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.75 8.36,4.73 12.19,4.73C14.03,4.73 15.6,5.33 16.84,6.46L19.09,4.21C17.2,2.34 14.86,1.5 12.19,1.5C6.92,1.5 2.5,6.08 2.5,12C2.5,17.92 6.92,22.5 12.19,22.5C17.6,22.5 21.5,18.33 21.5,12.33C21.5,11.76 21.44,11.43 21.35,11.1V11.1Z" />
                        </svg>
                        Sign up with Google
                    </Button>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
                        </div>
                    </div>
                    <FormField control={userDetailsForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input placeholder="Your Name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={userDetailsForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="your@email.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={userDetailsForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                  <CardFooter className="gap-4">
                     <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                     <Button type="submit" className="w-full">Continue</Button>
                  </CardFooter>
              </form>
            </Form>
          )}

          {step === 3 && role === 'user' && (
            <Form {...userContactsForm}>
              <form onSubmit={userContactsForm.handleSubmit(handleFinalSubmit)}>
                <CardHeader>
                  <CardTitle className="text-3xl font-headline">User Setup</CardTitle>
                  <CardDescription>Add your emergency contacts. You can add up to two.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4 border p-4 rounded-lg">
                    <Label className="font-bold">Emergency Contact 1</Label>
                    <FormField control={userContactsForm.control} name="contact1_name" render={({ field }) => (
                      <FormItem><FormControl><Input placeholder="Name" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={userContactsForm.control} name="contact1_email" render={({ field }) => (
                      <FormItem><FormControl><Input type="email" placeholder="Email" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={userContactsForm.control} name="contact1_phone" render={({ field }) => (
                      <FormItem><FormControl><Input type="tel" placeholder="Phone Number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="space-y-4 border p-4 rounded-lg">
                    <Label className="font-bold">Emergency Contact 2 (Optional)</Label>
                    <FormField control={userContactsForm.control} name="contact2_name" render={({ field }) => (
                      <FormItem><FormControl><Input placeholder="Name" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={userContactsForm.control} name="contact2_email" render={({ field }) => (
                      <FormItem><FormControl><Input type="email" placeholder="Email" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={userContactsForm.control} name="contact2_phone" render={({ field }) => (
                      <FormItem><FormControl><Input type="tel" placeholder="Phone Number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={userContactsForm.control} name="locationConsent" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Allow location sharing</FormLabel>
                        <FormDescription>Your location will only be shared with your contacts during an emergency.</FormDescription>
                         <FormMessage />
                      </div>
                    </FormItem>
                  )} />
                   <FormField control={userContactsForm.control} name="terms" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>I agree to the <Link href="/privacy" className="underline">Terms & Privacy Policy</Link>.</FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )} />
                </CardContent>
                <CardFooter className="gap-4">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" className="w-full">Finish Setup</Button>
                </CardFooter>
              </form>
            </Form>
          )}

          {step === 3 && role === 'contact' && (
            <Form {...caregiverForm}>
               <form onSubmit={caregiverForm.handleSubmit(handleFinalSubmit)}>
                <CardHeader>
                  <CardTitle className="text-3xl font-headline">Caregiver Setup</CardTitle>
                  <CardDescription>Enter the invite code from the user you wish to monitor.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={caregiverForm.control} name="inviteCode" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Invite Code</FormLabel>
                        <FormControl><Input placeholder="Enter 8-digit code" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                   )} />
                  <p className="text-sm text-muted-foreground">The user can find their invite code in their app's settings.</p>
                </CardContent>
                <CardFooter className="gap-4">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" className="w-full">Link Account</Button>
                </CardFooter>
              </form>
            </Form>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
}

    