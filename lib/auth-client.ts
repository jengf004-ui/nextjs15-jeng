"use client";

import { createAuthClient } from "better-auth/react";
import type { Session, User } from "@/lib/auth";

export const { signUp, signIn, signOut, useSession, getSession } =
  createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
    sessionOptions: {
      refetchOnWindowFocus: false,
      refetchInterval: 0,
    },
  });

export type { Session, User };
