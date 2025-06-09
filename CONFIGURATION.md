# Server Configuration

## Multi-Server Setup

The bot supports managing multiple 3x-ui servers. Configuration is done via the `servers.config.json` file.

### Configuration File

1. Copy `servers.config.json.example` to `servers.config.json`
2. Configure your servers in the JSON array format:

```json
[
  {
    "id": "server1",
    "name": "Main Server (US)",
    "host": "http://your-server-ip",
    "port": "2053",
    "webBasePath": "/your-web-path",
    "username": "admin",
    "password": "your_password",
    "isActive": true
  }
]
```

### Configuration Fields

- `id`: Unique identifier for the server (used internally)
- `name`: Display name shown in Discord commands
- `host`: Server IP/domain with protocol (http:// or https://)
- `port`: Port number (as string)
- `webBasePath`: Web panel path (e.g., "/panel" or "" for root)
- `username`: Admin username for 3x-ui panel
- `password`: Admin password for 3x-ui panel
- `isActive`: Whether this server should be loaded (true/false)

### Fallback Options

If `servers.config.json` doesn't exist or fails to load, the bot will:

1. Try to load from `SERVERS_CONFIG` environment variable (JSON string)
2. Fall back to legacy single-server environment variables:
   - `API_HOST`
   - `API_PORT`
   - `API_WEBBASEPATH`
   - `API_USERNAME`
   - `API_PASSWORD`

### Security Notes

- Add `servers.config.json` to `.gitignore` to protect credentials
- Use strong passwords for 3x-ui panel access
- Consider using HTTPS for production servers
