"use client";

import { useCallback, useState } from "react";
import { createReviewSession } from "@/lib/api";
import type { ReviewSession } from "@/types/domain";

export function useSession() {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const ensureSession = useCallback(async () => {
    if (session) {
      return session;
    }

    setIsCreating(true);
    try {
      const res = await createReviewSession();
      setSession(res.session);
      return res.session;
    } finally {
      setIsCreating(false);
    }
  }, [session]);

  return {
    session,
    setSession,
    isCreating,
    ensureSession,
  };
}
