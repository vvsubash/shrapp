import { z } from "zod";

export const SessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  email: z.string(),
});

export const SessionResponseSchema = z.object({
  user: SessionUserSchema,
  session: z.object({
    id: z.string(),
    token: z.string(),
    expiresAt: z.string(),
  }),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export type AuthEnv = {
  Variables: {
    user: SessionUser;
  };
};
