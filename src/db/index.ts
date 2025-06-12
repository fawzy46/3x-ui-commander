import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import * as path from 'path';
import * as fs from 'fs';

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create the SQLite database client
const client = createClient({
  url: `file:${path.join(process.cwd(), 'data', 'servers.db')}`
});

// Create the Drizzle database instance
export const db = drizzle(client, { schema });

export { schema };
