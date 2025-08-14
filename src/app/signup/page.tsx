"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { User, HeartHandshake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Role = "user" | "contact";

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const router = useRouter();
  const { toast } = useToast();

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
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

          {step === 2 && role === 'user' && (
            <form onSubmit={handleFormSubmit}>
              <CardHeader>
                <CardTitle className="text-3xl font-headline">User Setup</CardTitle>
                <CardDescription>Add your emergency contacts. You can add up to two.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 border p-4 rounded-lg">
                  <Label className="font-bold">Emergency Contact 1</Label>
                  <Input name="contact1_name" placeholder="Name" required autoComplete="name" />
                  <Input name="contact1_email" type="email" placeholder="Email" required autoComplete="email" />
                  <Input name="contact1_phone" type="tel" placeholder="Phone Number" required autoComplete="tel" />
                </div>
                <div className="space-y-4 border p-4 rounded-lg">
                  <Label className="font-bold">Emergency Contact 2 (Optional)</Label>
                  <Input name="contact2_name" placeholder="Name" autoComplete="name" />
                  <Input name="contact2_email" type="email" placeholder="Email" autoComplete="email" />
                  <Input name="contact2_phone" type="tel" placeholder="Phone Number" autoComplete="tel" />
                </div>
                <div className="items-top flex space-x-2">
                  <Checkbox id="location-consent" required />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="location-consent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Allow location sharing
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Your location will only be shared with your contacts during an emergency.
                    </p>
                  </div>
                </div>
                <div className="items-top flex space-x-2">
                  <Checkbox id="terms" required />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      I agree to the <Link href="/privacy" className="underline">Terms & Privacy Policy</Link>.
                    </label>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="gap-4">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" className="w-full">Finish Setup</Button>
              </CardFooter>
            </form>
          )}

          {step === 2 && role === 'contact' && (
             <form onSubmit={handleFormSubmit}>
              <CardHeader>
                <CardTitle className="text-3xl font-headline">Caregiver Setup</CardTitle>
                <CardDescription>Enter the invite code from the user you wish to monitor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Label htmlFor="invite-code" className="font-bold">Invite Code</Label>
                <Input id="invite-code" placeholder="Enter 8-digit code" required />
                <p className="text-sm text-muted-foreground">The user can find their invite code in their app's settings.</p>
              </CardContent>
              <CardFooter className="gap-4">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" className="w-full">Link Account</Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
}
