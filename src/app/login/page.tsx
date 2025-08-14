"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function LoginPage() {
  const router = useRouter();

  const handleGoogleSignIn = () => {
    // In a real app, this would trigger Firebase Auth.
    // For this prototype, we'll simulate a successful login and
    // redirect to the signup page for a new user, or dashboard for an existing one.
    // We'll simulate a new user flow here.
    router.push("/signup");
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-headline">Welcome!</CardTitle>
            <CardDescription>Sign in to continue to LifeSignal AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button onClick={handleGoogleSignIn} className="w-full text-lg py-6 flex items-center gap-3">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.75 8.36,4.73 12.19,4.73C14.03,4.73 15.6,5.33 16.84,6.46L19.09,4.21C17.2,2.34 14.86,1.5 12.19,1.5C6.92,1.5 2.5,6.08 2.5,12C2.5,17.92 6.92,22.5 12.19,22.5C17.6,22.5 21.5,18.33 21.5,12.33C21.5,11.76 21.44,11.43 21.35,11.1V11.1Z" />
              </svg>
              Sign in with Google
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New to LifeSignal?{" "}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
