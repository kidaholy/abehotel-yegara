
const mongoose = require('mongoose');

async function listAll() {
  try {
    const uri = 'mongodb://localhost:27017';
    await mongoose.connect(uri);
    console.log('Connected to ' + uri);

    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    
    for (const dbInfo of dbs.databases) {
      console.log(`Database: ${dbInfo.name}`);
      const connection = mongoose.createConnection(`${uri}/${dbInfo.name}`);
      
      // Wait for connection to be ready
      await new Promise((resolve) => connection.once('open', resolve));
      
      const collections = await connection.db.listCollections().toArray();
      for (const coll of collections) {
        const count = await connection.db.collection(coll.name).countDocuments();
        console.log(` - ${coll.name}: ${count} docs`);
      }
      await connection.close();
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listAll();
