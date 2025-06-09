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

## Security Notes

- Never commit `.env` files to version control
- Use read-only mounts for configuration files
- Run containers as non-root user (already configured)
- Regularly update the base Docker image
