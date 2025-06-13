import { defineConfig } from 'drizzle-kit';
import * as path from 'path';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: `file:${path.join(process.cwd(), 'data', 'servers.db')}`
  },
  verbose: true,
  strict: true
});
