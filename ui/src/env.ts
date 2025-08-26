import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z.string().default("/api"),
  VITE_WS_URL: z.string().default("/ws"),
  AUTOMATION_API_URL: z.string().default("http://127.0.0.1:8000"),
});

export const env = envSchema.parse(import.meta.env);
