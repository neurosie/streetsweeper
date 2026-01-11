declare module 'prisma/config' {
  export function defineConfig(config: {
    schema?: string
    migrations?: {
      path?: string
    }
    datasource?: {
      url?: string
    }
  }): unknown

  export function env(key: string): string
}
