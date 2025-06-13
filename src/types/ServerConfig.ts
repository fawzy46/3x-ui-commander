export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: string;
  webBasePath: string;
  username: string;
  password: string;
  isActive: boolean;
  discordServerId?: string; // Discord server/guild ID this VPN server is associated with
  defaultInboundId?: number; // Default inbound ID for this server
}
