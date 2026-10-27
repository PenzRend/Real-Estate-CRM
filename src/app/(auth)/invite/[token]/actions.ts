"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WORKSPACE_COOKIE } from "@/lib/auth";
import { acceptInvitation } from "@/lib/team";

export type JoinState = { error?: string };

/** Joins the invited workspace and opens it. */
export async function joinAction(token: string): Promise<JoinState> {
  const result = await acceptInvitation(token);
  if (!result.ok) return { error: result.error };
  (await cookies()).set(WORKSPACE_COOKIE, result.organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
