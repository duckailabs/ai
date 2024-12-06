import * as schema from "@/db/schema/schema";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { goals } from "./schema/goal";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const dbSchemas = {
  ...schema,
  goals: goals,
} as const;

// Type the combined schema

// Create the connection
const client = postgres(connectionString, {
  max: 20, // maximum number of connections
  idle_timeout: 20, // how long a connection can be idle before being closed
  connect_timeout: 10, // how long to wait for a connection
  debug: (msg) => {
    console.log(msg);
  },
});
export const db = drizzle(client, { schema: dbSchemas });

// Export a function to test the connection
export async function testConnection() {
  try {
    // Try a simple query
    const result = await db.select().from(schema.characters).limit(1);
    console.log("Database connection successful");
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

export const pgClient = client;

export { schema };
