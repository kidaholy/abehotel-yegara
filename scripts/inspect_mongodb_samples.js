
const mongoose = require('mongoose');

async function inspectSamples() {
  try {
    const uri = 'mongodb://localhost:27017/abehotel';
    await mongoose.connect(uri);
    console.log('Connected to ' + uri);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    for (const coll of collections) {
      if (['audit_logs', 'system.indexes'].includes(coll.name)) continue;
      
      const sample = await db.collection(coll.name).findOne({});
      if (sample) {
        console.log(`\nCollection: ${coll.name}`);
        console.log(JSON.stringify(sample, null, 2));
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectSamples();
