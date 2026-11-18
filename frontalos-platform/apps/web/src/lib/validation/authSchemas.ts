/**
 * lib/validation/authSchemas.ts — zod schemas shared by every (auth) form
 * and its react-hook-form resolver. Kept separate from the page components
 * so the login/register API routes and any future server-side validation
 * can import the exact same rules if needed.
 */
import { z } from "zod";

// BUG FIX (staff audit follow-up): "admin" used to be listed here, but
// services/cortix-api/auth/router.py's SELF_REGISTERABLE_ROLES has always
// excluded "admin" from self-service registration on purpose (see that
// file's own comment). Picking "Administrator" on this form silently
// 400'd against a role list the user never saw. Admin accounts are now
// provisioned the way the admin portal itself assumes: an existing admin
// promotes another user via PUT /api/v1/admin/users/{id}/role
// (api/v1/admin.py) after that user registers with a normal role.
export const REGISTERABLE_ROLES = ["parent", "doctor", "school"] as const;
export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

export const ROLE_LABELS: Record<RegisterableRole, string> = {
  parent: "Parent / Guardian",
  doctor: "Doctor / Clinician",
  school: "School / Teacher",
};

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number");

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    role: z.enum(REGISTERABLE_ROLES, { errorMap: () => ({ message: "Select a role" }) }),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
