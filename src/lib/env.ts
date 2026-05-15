import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

const parsed = schema.safeParse(import.meta.env)

if (!parsed.success) {
  console.error('❌ Missing env vars:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables — check your .env file')
}

export const env = parsed.data
