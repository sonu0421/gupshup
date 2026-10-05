// Demo launcher: runs the server with an in-memory MongoDB,
// so you don't need to install MongoDB locally.
// Usage: npm run demo
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
process.env.MONGO_URI = mongod.getUri("gupshup");
process.env.JWT_SECRET ||= "demo-secret-change-in-production";
console.log("Using in-memory MongoDB (data resets on restart)");

await import("./index.js");
