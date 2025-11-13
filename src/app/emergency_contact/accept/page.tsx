"use client";

import { Suspense } from "react";
import AcceptInviteInner from "./AcceptInviteInner";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AcceptInviteInner />
    </Suspense>
  );
}
