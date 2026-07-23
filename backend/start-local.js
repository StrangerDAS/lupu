import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'child_process';

async function start() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  console.log("Local Mongo URI:", uri);
  
  const child = spawn('node', ['server.js'], {
    env: { ...process.env, MONGODB_URI: uri },
    stdio: 'inherit'
  });
}
start();
