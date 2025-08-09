export interface Demo {
  name: string
  title: string
  summary: string
  description?: string
  tags: string[]
  features: string[]
  hasSeed: boolean
  hasRealtime: boolean
  tables: number
  functions: number
}

export interface DemoDetail extends Demo {
  readme: string
  plan: any
  migrations: string[]
  functions: string[]
  seedFiles: string[]
  verification?: {
    smoke?: Array<{
      method: string
      path: string
      expect: number
    }>
  }
}

export interface InstallOptions {
  name: string
  withSeed?: boolean
  apply?: boolean
}

export interface InstallResult {
  success: boolean
  name: string
  timestamp: number
  withSeed: boolean
  applied: boolean
  tables: string[]
  functions: string[]
  errors?: string[]
  logs?: string[]
}

export interface VerifyReport {
  success: boolean
  name: string
  timestamp: number
  tests: Array<{
    name: string
    passed: boolean
    message?: string
  }>
}

export interface InstallHistoryItem {
  name: string
  timestamp: number
  withSeed: boolean
  apply: boolean
  result: 'ok' | 'error'
  error?: string
}