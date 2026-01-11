import 'dotenv/config'
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
import { defineConfig, env } from 'prisma/config'

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Use direct connection for migrations (non-pooled)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    url: env('POSTGRES_URL_NON_POOLING'),
  },
})
