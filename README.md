# 3x-ui Discord Bot

A Discord bot that automates interactions with multiple 3x-ui REST APIs, allowing you to manage VPN clients across multiple servers directly from Discord using slash commands.

## Features

- **Multi-Server Support**: Manage multiple 3x-ui servers from a single bot
- **Discord Server Restrictions**: Link specific VPN servers to specific Discord servers for enhanced security
- **Add Client**: Create new clients in 3x-ui inbounds on any server
- **Update Client**: Modify existing client configurations on specific servers
- **Get Traffic**: View client traffic statistics across all servers or specific servers
- **List Servers**: View all configured servers and test their connectivity
- **List Inbounds**: View inbounds from all servers or specific servers
- **Cross-Server Search**: Find clients across multiple servers by email or UUID

## Prerequisites

- Node.js 18+ installed
- Discord Bot Token and Application ID
- One or more 3x-ui panels with API access
- Discord server with bot permissions

## Installation

### Option 1: Docker (Recommended)

See [DOCKER.md](DOCKER.md) for complete Docker setup instructions.

**Quick Docker start:**

```bash
# Edit .env and servers.config.json with your settings

# Start with Docker Compose
docker-compose up -d
```

### Option 2: Manual Installation

1. Clone or download this project
2. Install dependencies:

   ```bash
   npm install
   ```

3. **Database Setup:**

   The bot uses SQLite database for server configuration management. The database will be automatically created on first startup at `./data/servers.db`.

4. **Configure your servers using Discord commands:**

   After starting the bot, use the `/manage-servers add` command to add your servers directly through Discord. This is the recommended method for server management.

   Create a `.env` file with Discord bot configuration:

   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_application_client_id_here

   # Note: Server configurations are managed through Discord commands
   # Use /manage-servers command to add your 3x-ui servers
   ```

5. Build the project:

   ```bash
   npm run build
   ```

6. Start the bot:

   ```bash
   npm start
   ```

7. Add your servers:

   Use the `/manage-servers add` command in Discord to add your 3x-ui servers. The bot will guide you through the configuration process.

## Database Management

The bot uses SQLite database for better performance and reliability. Available commands:

```bash
# Generate database migrations
npm run db:generate

# Apply database migrations
npm run db:migrate

# Open Drizzle Studio (web-based database browser)
npm run db:studio

# Test database initialization
npm run test-init
```

**Database Location:** `./data/servers.db`

For more details, see [DATABASE_GUIDE.md](DATABASE_GUIDE.md)

## Development

For development with auto-reload:

```bash
npm run dev
```

Or with file watching:

```bash
npm run watch
```

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token to your `.env` file
5. Copy the application ID to your `.env` file as CLIENT_ID
6. Go to "OAuth2" > "URL Generator"
7. Select "bot" and "applications.commands" scopes
8. Select required permissions (Send Messages, Use Slash Commands)
9. Use the generated URL to invite the bot to your server

## Available Commands

### `/manage-servers`

Manage server configurations (Requires Administrator Privilege).

**Subcommands:**

- `add`: Add a new 3x-ui server configuration (opens a form)
- `edit`: Edit an existing server configuration (opens a form with current values)
- `remove`: Remove a server configuration
- `toggle`: Enable/disable a server
- `refresh`: Refresh servers from database

**Configuration Form Fields:**

- **Server ID**: Unique identifier for the server (only shown when adding)
- **Server Name**: Display name for the server
- **Host**: Full URL including protocol (e.g., http://192.168.1.100)
- **Port and Web Path**: Format: `port,webpath` (e.g., `2053,/panel` or `443,/`)
- **Credentials and Default Inbound**: Format: `username,password,defaultInboundId` (e.g., `admin,mypass123,1`)
  - The default inbound ID is optional but recommended for easier client management

### `/list-servers`

List all configured 3x-ui servers and their connection status.

**Options:**

- `test-connection` (optional): Test connection to all servers (default: false)

### `/list-inbounds`

List all inbounds from 3x-ui servers (Requires Administrator Privilege).

**Options:**

- `server` (optional): Select specific server (shows all servers if not specified)

### `/add-client`

Add a new client to a 3x-ui inbound on a specific server (Requires Administrator Privilege).

**Options:**

- `server` (required): Select the server to add the client to
- `inbound-id` (optional): The inbound ID to add the client to (uses server default if not specified)
- `email` (required): Client email/username
- `total-gb` (optional): Total GB limit (0 for unlimited)
- `expiry-days` (optional): Days until expiry (0 for no expiry)
- `limit-ip` (optional): IP connection limit (0 for unlimited)
- `enabled` (optional): Enable the client (default: true)

### `/update-client`

Update an existing client configuration on a specific server (Requires Administrator Privilege).

**Options:**

- `server` (required): Select the server where the client exists
- `uuid` (required): Client UUID to update
- `inbound-id` (optional): The inbound ID where the client exists (uses server default if not specified)
- `email` (optional): New client email/username
- `total-gb` (optional): New total GB limit
- `expiry-days` (optional): New days until expiry
- `limit-ip` (optional): New IP connection limit
- `enabled` (optional): Enable or disable the client
- `reset-traffic` (optional): Reset traffic (1 to reset)

### `/get-traffic`

Get client traffic information and statistics from one or all servers.

**Options:**

- `server` (optional): Select the server to search (searches all servers if not specified)
- `email` (optional): Client email to get traffic for
- `uuid` (optional): Client UUID to get traffic for

_Note: Only User with Administrator Privilage can use the search by email/uuid, other wise the non-Administrator user must be linked to the created user in the 3x-ui panel by using the discord username as email_

_Note: If neither email nor uuid is provided, it will use your Discord username as the email._

## Multi-Server Features

- **Automatic Server Discovery**: The bot will search across all configured servers when looking for clients
- **Server Selection**: Commands that modify data require you to specify which server to use
- **Cross-Server Search**: Traffic queries can search across all servers or target a specific server
- **Connection Testing**: Built-in server connectivity testing
- **Backward Compatibility**: Supports legacy single-server configuration

## API Endpoints Used

- `POST /login` - Authentication
- `POST /panel/api/inbounds/addClient` - Add new client
- `POST /panel/api/inbounds/updateClient/{uuid}` - Update client
- `GET /panel/api/inbounds/getClientTraffics/{email}` - Get traffic by email
- `GET /panel/api/inbounds/getClientTrafficsById/{uuid}` - Get traffic by UUID

## Project Structure

```
src/
├── index.ts                     # Main bot entry point
├── api/
│   └── XUIApiClient.ts         # 3x-ui API client
└── commands/
    ├── AddClientCommand.ts     # Add client command
    ├── UpdateClientCommand.ts  # Update client command
    └── GetClientTrafficCommand.ts # Get traffic command
```

## Error Handling

The bot includes comprehensive error handling for:

- API authentication failures (automatic re-login)
- Invalid client data
- Network connectivity issues
- Discord interaction errors
- Missing environment variables

## Security Notes

- Store sensitive credentials in environment variables
- Never commit `.env` files to version control
- Use appropriate Discord permissions
- Ensure 3x-ui panel is properly secured

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](https://www.gnu.org/licenses/agpl-3.0.en.html).

**Key Points of AGPLv3:**

- ✅ Freedom to use, modify, and distribute
- ✅ Requires derivative works to remain open source
- ✅ Network use counts as distribution (even over a network/API)
- ✅ Must include original license and copyright notices
- ✅ Changes must be documented and shared
- ❌ No warranty provided
