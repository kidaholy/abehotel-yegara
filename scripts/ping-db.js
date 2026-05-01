require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT 1')
  .then(() => { console.log('DB online'); p.$disconnect(); })
  .catch(e => { console.log('DB offline:', e.message); p.$disconnect(); });
