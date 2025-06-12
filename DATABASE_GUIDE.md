# Database Setup Guide

## SQLite Database with Drizzle ORM

This bot uses SQLite database for storing server configurations, providing better performance, data integrity, and management capabilities compared to configuration files.

## Database Location

The SQLite database is stored at: `./data/servers.db`

## Database Management

### Available Commands

```bash
# Generate database migrations (after schema changes)
npm run db:generate

# Apply database migrations  
npm run db:migrate

# Open Drizzle Studio (web-based database browser)
npm run db:studio

# Test database initialization
npm run test-init
```

### Database Schema

The database contains a `servers` table with the following structure:

```sql
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL, 
  port TEXT NOT NULL,
  web_base_path TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  discord_server_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## Server Management

### Adding Servers

You can add servers in several ways:

1. **Discord Commands** (Recommended):
   ```
   /manage-servers add
   ```

2. **Environment Variables**:
   ```env
   SERVERS_CONFIG=[{"id":"server1","name":"My Server","host":"http://example.com","port":"2053","webBasePath":"/panel","username":"admin","password":"password","isActive":true}]
   ```

3. **Legacy Single Server**:
   ```env
   API_HOST=http://your-server.com
   API_PORT=2053
   API_WEBBASEPATH=/panel
   API_USERNAME=admin
   API_PASSWORD=your_password
   ```

### Runtime Management

The bot supports runtime server management through Discord commands:

- **Add servers**: `/manage-servers add`
- **Update servers**: `/manage-servers update`
- **Delete servers**: `/manage-servers delete`
- **Toggle active status**: `/manage-servers toggle`
- **List servers**: `/list-servers`

## Backup & Recovery

### Creating Backups

```bash
# Simple file copy
copy "data\servers.db" "backup\servers-$(Get-Date -Format 'yyyy-MM-dd').db"
```

### Restoring from Backup

```bash
# Stop the bot first, then restore
copy "backup\servers-2025-06-12.db" "data\servers.db"
```

### Schema Updates

When updating the database schema:

1. Modify `src/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply changes

### Data Recovery

If the database becomes corrupted:

1. Stop the bot
2. Restore from a recent backup
3. Or delete the database and reconfigure servers via Discord commands

## Development

For development, you can use Drizzle Studio to inspect and modify the database:

```bash
npm run db:studio
```

This opens a web interface at `https://local.drizzle.studio` where you can view and edit database contents.
