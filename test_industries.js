const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function run() {
  const counts = await prisma.transaction.groupBy({
    by: ['industryId'],
    _count: { industryId: true }
  })
  
  const industries = await prisma.industry.findMany()
  const map = {}
  industries.forEach(i => map[i.id] = i.name)
  
  const formatted = counts.map(c => ({
    industry: c.industryId ? map[c.industryId] : 'Otras (Nulo)',
    count: c._count.industryId
  }))
  
  console.log(formatted.sort((a,b) => b.count - a.count))
}
run()
