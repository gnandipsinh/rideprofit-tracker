import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const OTP_LENGTH = 6;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_OTP_ATTEMPTS = 5;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(255, "Email is too long")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be under 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
    mobile: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(72),
});

export const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const otpSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`);

/** Generic messages only — never leak whether an account exists or why auth failed. */
export const GENERIC_CREDENTIALS_ERROR = "Incorrect email or password. Please try again.";
export const GENERIC_OTP_ERROR = "That code is invalid or has expired. Request a new one.";
export const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";

export function safeAuthMessage(raw: string | undefined, fallback = GENERIC_ERROR): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) {
    return "Too many attempts. Please wait a minute before trying again.";
  }
  if (m.includes("pwned") || m.includes("weak")) {
    return "This password appears in known data breaches. Choose a stronger one.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "This email cannot be used to register. Try signing in instead.";
  }
  return fallback;
}

/** Sends a password-recovery one-time code. */
export async function sendRecoveryOtp(email: string) {
  return supabase.auth.resetPasswordForEmail(email);
}

export async function resendSignupOtp(email: string) {
  return supabase.auth.resend({ type: "signup", email });
}

/** Verifies the code emailed right after registration. */
export async function verifySignupOtp(email: string, token: string) {
  const res = await supabase.auth.verifyOtp({ email, token, type: "signup" });
  if (!res.error) return res;
  return supabase.auth.verifyOtp({ email, token, type: "email" });
}

export async function verifyRecoveryOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: "recovery" });
}
