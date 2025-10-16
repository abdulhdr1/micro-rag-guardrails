import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import * as schema from './schema';

// Create postgres connection
const client = postgres(config.databaseUrl);

// Create drizzle instance
export const db = drizzle(client, { schema });

// Close connection
export async function closeDatabase() {
  await client.end();
}
