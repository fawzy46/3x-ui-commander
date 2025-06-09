# 3x-ui Discord Bot

A Discord bot that automates interactions with multiple 3x-ui REST APIs, allowing you to manage VPN clients across multiple servers directly from Discord using slash commands.

## Features

- **Multi-Server Support**: Manage multiple 3x-ui servers from a single bot
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
# Copy and configure environment
cp .env.example .env
cp servers.config.json.example servers.config.json

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

3. Configure your servers:

   **Option 1: Multiple Servers Configuration (Recommended)**
   
   Copy `servers.config.json.example` to `servers.config.json` and configure your servers:
   ```bash
   cp servers.config.json.example servers.config.json
   ```
   
   Edit `servers.config.json`:
   ```json
   [
     {
       "id": "server1",
       "name": "Primary Server",
       "host": "http://your-server1.com",
       "port": "2053",
       "webBasePath": "/path1",
       "username": "admin",
       "password": "password1",
       "isActive": true
     },
     {
       "id": "server2", 
       "name": "Secondary Server",
       "host": "http://your-server2.com",
       "port": "2053",
       "webBasePath": "/path2",
       "username": "admin",
       "password": "password2",
       "isActive": true
     }
   ]
   ```

   Then create your `.env` file with Discord credentials only:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_application_client_id_here
   ```

   **Option 2: Single Server Configuration (Legacy)**
   
   Create a `.env` file based on `.env.example`:
   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_application_client_id_here

   # Single 3x-ui API Configuration
   API_HOST=localhost
   API_PORT=2053
   API_WEBBASEPATH=
   API_USERNAME=admin
   API_PASSWORD=admin
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the bot:
   ```bash
   npm start
   ```

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

### `/list-servers`
List all configured 3x-ui servers and their connection status.

**Options:**
- `test-connection` (optional): Test connection to all servers (default: false)

### `/list-inbounds`
List all inbounds from 3x-ui servers.

**Options:**
- `server` (optional): Select specific server (shows all servers if not specified)

### `/add-client`
Add a new client to a 3x-ui inbound on a specific server.

**Options:**
- `server` (required): Select the server to add the client to
- `inbound-id` (required): The inbound ID to add the client to
- `email` (required): Client email/username
- `total-gb` (optional): Total GB limit (0 for unlimited)
- `expiry-days` (optional): Days until expiry (0 for no expiry)
- `limit-ip` (optional): IP connection limit (0 for unlimited)
- `enabled` (optional): Enable the client (default: true)

### `/update-client`
Update an existing client configuration on a specific server.

**Options:**
- `server` (required): Select the server where the client exists
- `uuid` (required): Client UUID to update
- `inbound-id` (required): The inbound ID where the client exists
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

*Note: If neither email nor uuid is provided, it will use your Discord username as the email.*

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
