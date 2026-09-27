import { z } from "zod";

/**
 * Shared shape for anything persisted, so a saved profile is validated on the
 * way in exactly as strictly as a live `/api/match` request is.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter your email address")
  .max(254, "That email address is too long")
  .email("That does not look like an email address")
  // Keep the message identical to the generic failure at login so that a
  // stranger cannot learn which addresses have accounts.
  .transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200, "That password is too long"),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1).max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Deliberately vague: never reveal whether the email or the password was wrong. */
export const INVALID_CREDENTIALS = "Email or password is incorrect.";
