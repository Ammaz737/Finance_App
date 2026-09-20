import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  workspace: z.string().trim().min(2).max(80).optional(),
});

export const activateSchema = z.object({
  email: z.string().email(),
  workspace: z.string().trim().min(2).max(80),
  token: z.string().min(20).max(200),
  password: z.string().min(12).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ActivateInput = z.infer<typeof activateSchema>;
