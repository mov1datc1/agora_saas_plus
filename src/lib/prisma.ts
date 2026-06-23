import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

let connectionString = `${process.env.DATABASE_URL}`

// Forzar el puerto 6543 (Transaction Mode) si se usa el Pooler de Supabase
if (connectionString.includes('pooler.supabase.com')) {
  connectionString = connectionString.replace(':5432', ':6543')
}

// Limitar el pool a 2 conexiones por instancia serverless para evitar saturar PgBouncer
const pool = new Pool({ 
  connectionString,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})
const adapter = new PrismaPg(pool)

const prismaClientSingleton = () => {
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
