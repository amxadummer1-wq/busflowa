import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .max(255, "Email must be 255 characters or fewer.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number.")
  .max(32, "Phone number must be 32 characters or fewer.")
  .regex(/^[+\d()\s.\-]+$/, "Use digits and standard phone punctuation only.");

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.");

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

export const adminRegistrationSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password.").max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password.").max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const conductorFields = {
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  assignedBus: z.string().trim().max(80),
  assignedRoute: z.string().trim().max(120),
};

export const createConductorSchema = z.object({
  ...conductorFields,
  initialPassword: passwordSchema,
});

export const updateConductorSchema = z.object({
  id: z.string().uuid(),
  ...conductorFields,
  isActive: z.boolean(),
});

export const resetConductorPasswordSchema = z
  .object({
    id: z.string().uuid(),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm the new password.").max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const deleteConductorSchema = z.object({ id: z.string().uuid() });

export type SignInInput = z.infer<typeof signInSchema>;
export type AdminRegistrationInput = z.infer<typeof adminRegistrationSchema>;