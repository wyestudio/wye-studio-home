import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdult } from "@/lib/age";
import type { Profile } from "@/types/domain";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

/**
 * signupAction stores the signup form's name/phone/birth_date/gender in the
 * auth user's metadata so it survives the "confirm your email" round trip
 * (which can happen on a different request, even a different device). Call
 * this right after a user's first authenticated request post-confirmation
 * (e.g. /auth/callback) to finish creating their profile without asking them
 * to type everything again. Returns true only if a profile now exists.
 */
export async function createProfileFromSignupMetadata(
  supabase: SupabaseClient,
  user: User
): Promise<boolean> {
  const meta = user.user_metadata as Record<string, unknown>;
  const name = typeof meta.name === "string" ? meta.name : "";
  const phone = typeof meta.phone === "string" ? meta.phone : "";
  const birthDate = typeof meta.birth_date === "string" ? meta.birth_date : "";
  const gender = typeof meta.gender === "string" ? meta.gender : "";

  if (!name || !phone || !birthDate || (gender !== "M" && gender !== "F")) {
    return false;
  }
  if (!isAdult(birthDate)) {
    return false;
  }

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    name,
    phone,
    birth_date: birthDate,
    gender,
  });

  // 23505 = unique_violation — a profile already exists, which counts as success.
  return !error || (error as { code?: string }).code === "23505";
}

/**
 * Shared by every OAuth/email callback route once a Supabase session exists:
 * finish creating the profile from signup metadata if possible, otherwise
 * send the user to fill it in manually.
 */
export async function finishOAuthLogin(
  supabase: SupabaseClient,
  user: User,
  redirectTo: string,
  origin: string
): Promise<NextResponse> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const completed = await createProfileFromSignupMetadata(supabase, user);
    if (!completed) {
      const params = new URLSearchParams({ redirect: redirectTo });
      return NextResponse.redirect(`${origin}/signup/profile?${params.toString()}`);
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
