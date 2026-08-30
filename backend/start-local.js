import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'child_process';

async function start() {
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbPath: './data/db',
      storageEngine: 'wiredTiger',
      port: 53956
    }
  });
  const uri = mongod.getUri();
  
  console.log("Local Mongo URI:", uri);
  
  const child = spawn('node', ['server.js'], {
    env: { ...process.env, MONGODB_URI: uri },
    stdio: ['ignore', 'inherit', 'inherit']
  });

  const cleanup = async () => {
    try { child.kill(); } catch (_) {}
    try { await mongod.stop(); } catch (_) {}
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  await new Promise((resolve) => {
    child.on('close', resolve);
    child.on('exit', resolve);
  });

  await cleanup();
}
start();


