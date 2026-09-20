import { z } from "zod";

export const moneySchema = z.object({
  amount: z.string(),
  currency: z.string().length(3),
});

export type MoneyDto = z.infer<typeof moneySchema>;
