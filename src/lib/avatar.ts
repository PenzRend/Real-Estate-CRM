import { supabaseUrl } from "@/lib/supabase/env";

// Profile pictures live in the public "avatars" bucket under the user's folder.

export const AVATARS_BUCKET = "avatars";

export const avatarUrl = (path: string | null | undefined) => (path && supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${AVATARS_BUCKET}/${path}` : null);

/** "Kovács Anna" → "KA". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

/** What a username may be: 3–30 of a–z, 0–9, "." and "_". */
export const USERNAME = /^[a-z0-9._]{3,30}$/;
