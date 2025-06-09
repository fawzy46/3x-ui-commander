# Docker Setup Guide

This guide explains how to run the 3x-ui Discord Bot using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (included with Docker Desktop)
- Your Discord bot token and client ID

## Quick Start

1. **Clone the repository and navigate to the project directory:**
   ```bash
   cd "3x-ui bot"
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit the `.env` file with your Discord bot credentials:**
   ```
   DISCORD_TOKEN=your_actual_discord_bot_token
   CLIENT_ID=your_actual_discord_client_id
   ```

4. **Ensure your `servers.config.json` file is properly configured:**
   ```bash
   cp servers.config.json.example servers.config.json
   # Edit servers.config.json with your 3x-ui server details
   ```

5. **Build and run the bot:**
   ```bash
   docker-compose up -d
   ```

## Docker Commands

### Build the Docker image:
```bash
docker build -t 3x-ui-bot .
```

### Run with Docker Compose (recommended):
```bash
# Start the bot
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the bot
docker-compose down

# Restart the bot
docker-compose restart
```

### Run with Docker directly:
```bash
docker run -d \
  --name 3x-ui-discord-bot \
  --env-file .env \
  -v $(pwd)/servers.config.json:/app/servers.config.json:ro \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  3x-ui-bot
```

## Configuration

### Environment Variables
- `DISCORD_TOKEN`: Your Discord bot token
- `CLIENT_ID`: Your Discord application client ID

### Volume Mounts
- `./servers.config.json:/app/servers.config.json:ro`: Server configuration (read-only)
- `./logs:/app/logs`: Log files (optional)

## Monitoring

### Check if the bot is running:
```bash
docker-compose ps
```

### View real-time logs:
```bash
docker-compose logs -f 3x-ui-bot
```

### Check bot health:
```bash
docker-compose exec 3x-ui-bot node -e "console.log('Bot is healthy')"
```

## Updating

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Rebuild and restart:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Troubleshooting

### Bot won't start:
- Check logs: `docker-compose logs 3x-ui-bot`
- Verify environment variables in `.env`
- Ensure `servers.config.json` is valid

### Permission errors:
- Ensure the bot has proper Discord permissions
- Check that the `servers.config.json` file exists and is readable

### Memory issues:
- Adjust memory limits in `docker-compose.yml`
- Monitor resource usage: `docker stats`

## Production Considerations

1. **Use a reverse proxy** (nginx) if exposing any web endpoints
2. **Set up log rotation** for the logs directory
3. **Monitor resource usage** regularly
4. **Backup your configuration files**
5. **Use Docker secrets** for sensitive data in production

## Security Notes

- Never commit `.env` files to version control
- Use read-only mounts for configuration files
- Run containers as non-root user (already configured)
- Regularly update the base Docker image
