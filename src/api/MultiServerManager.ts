import { XUIApiClient } from './XUIApiClient';
import { ServerConfig, ApiResponse, Inbound, Client, ClientTraffic } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class MultiServerManager {
  private servers: Map<string, ServerConfig> = new Map();
  private clients: Map<string, XUIApiClient> = new Map();

  constructor() {
    this.loadServerConfigurations();
  }
  /**
   * Load server configurations from JSON file or environment variables
   */
  private loadServerConfigurations(): void {
    // First try to load from servers.config.json file
    const configPath = path.join(process.cwd(), 'servers.config.json');
    
    if (fs.existsSync(configPath)) {
      try {
        const configFile = fs.readFileSync(configPath, 'utf8');
        const servers: ServerConfig[] = JSON.parse(configFile);
        console.log(`🔍 Loading server configurations from ${configPath}`);
        
        servers.forEach(server => {
          if (server.isActive) {
            this.addServer(server);
          }
        });
        
        if (this.servers.size > 0) {
          console.log(`✅ Loaded ${this.servers.size} active server(s) from config file`);
          return;
        }
      } catch (error) {
        console.error('❌ Failed to parse servers.config.json:', error);
      }
    }

    // Fallback to environment variables approach
    const serversData = process.env.SERVERS_CONFIG;
    
    if (serversData) {
      try {
        const servers: ServerConfig[] = JSON.parse(serversData);
        console.log('🔍 Loading server configurations from SERVERS_CONFIG environment variable');
        
        servers.forEach(server => {
          if (server.isActive) {
            this.addServer(server);
          }
        });
        
        if (this.servers.size > 0) {
          console.log(`✅ Loaded ${this.servers.size} active server(s) from environment variable`);
          return;
        }
      } catch (error) {
        console.error('❌ Failed to parse SERVERS_CONFIG environment variable:', error);
      }
    }

    // Final fallback to single server configuration for backward compatibility
    console.log('🔍 Using legacy single server configuration from environment variables');
    const singleServer: ServerConfig = {
      id: 'default',
      name: 'Default Server',
      host: process.env.API_HOST || 'localhost',
      port: process.env.API_PORT || '2053',
      webBasePath: process.env.API_WEBBASEPATH || '',
      username: process.env.API_USERNAME || 'admin',
      password: process.env.API_PASSWORD || 'admin',
      isActive: true
    };
    this.addServer(singleServer);
    console.log(`✅ Loaded ${this.servers.size} active server(s) from legacy configuration`);
  }

  /**
   * Add a server configuration and create its API client
   */
  private addServer(config: ServerConfig): void {
    this.servers.set(config.id, config);
    const apiClient = new XUIApiClient(config);
    this.clients.set(config.id, apiClient);
    console.log(`✅ Added server: ${config.name} (${config.id})`);
  }

  /**
   * Get all available servers
   */
  public getServers(): ServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server configuration by ID
   */
  public getServer(serverId: string): ServerConfig | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get API client for a specific server
   */
  public getClient(serverId: string): XUIApiClient | undefined {
    return this.clients.get(serverId);
  }

  /**
   * Get all inbounds from a specific server
   */
  public async getInbounds(serverId: string): Promise<ApiResponse<Inbound[]>> {
    const client = this.getClient(serverId);
    if (!client) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }
    return await client.getInbounds();
  }

  /**
   * Get inbounds from all servers
   */
  public async getAllInbounds(): Promise<Array<{ serverId: string; serverName: string; result: ApiResponse<Inbound[]> }>> {
    const results = [];

    for (const [serverId, client] of this.clients) {
      try {
        const result = await client.getInbounds();
        const server = this.getServer(serverId);
        results.push({
          serverId,
          serverName: server?.name || serverId,
          result
        });
      } catch (error: any) {
        console.error(`❌ Failed to get inbounds from server ${serverId}:`, error.message);
        results.push({
          serverId,
          serverName: this.getServer(serverId)?.name || serverId,
          result: {
            success: false,
            msg: error.message,
            obj: []
          }
        });
      }
    }

    return results;
  }

  /**
   * Add client to specific server
   */
  public async addClient(serverId: string, inboundId: number, client: Client): Promise<ApiResponse> {
    const apiClient = this.getClient(serverId);
    if (!apiClient) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }
    return await apiClient.addClient(inboundId, client);
  }

  /**
   * Update client on specific server
   */
  public async updateClient(serverId: string, uuid: string, inboundId: number, client: Client): Promise<ApiResponse> {
    const apiClient = this.getClient(serverId);
    if (!apiClient) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }
    return await apiClient.updateClient(uuid, inboundId, client);
  }

  /**
   * Get client traffic from specific server
   */
  public async getClientTraffic(serverId: string, email: string): Promise<ApiResponse<ClientTraffic>> {
    const apiClient = this.getClient(serverId);
    if (!apiClient) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }
    return await apiClient.getClientTraffic(email);
  }

  /**
   * Get client traffic by UUID from specific server
   */
  public async getClientTrafficById(serverId: string, uuid: string): Promise<ApiResponse<ClientTraffic[]>> {
    const apiClient = this.getClient(serverId);
    if (!apiClient) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }
    return await apiClient.getClientTrafficById(uuid);
  }

  /**
   * Search for client across all servers by email
   */
  public async findClientByEmail(email: string): Promise<Array<{ serverId: string; serverName: string; result: ApiResponse<ClientTraffic> }>> {
    const results = [];

    for (const [serverId, client] of this.clients) {
      try {
        const result = await client.getClientTraffic(email);
        const server = this.getServer(serverId);
        results.push({
          serverId,
          serverName: server?.name || serverId,
          result
        });
      } catch (error: any) {
        console.error(`❌ Failed to search client on server ${serverId}:`, error.message);
      }
    }

    return results.filter(r => r.result.success);
  }

  /**
   * Search for client across all servers by UUID
   */
  public async findClientByUUID(uuid: string): Promise<Array<{ serverId: string; serverName: string; result: ApiResponse<ClientTraffic[]> }>> {
    const results = [];

    for (const [serverId, client] of this.clients) {
      try {
        const result = await client.getClientTrafficById(uuid);
        const server = this.getServer(serverId);
        results.push({
          serverId,
          serverName: server?.name || serverId,
          result
        });
      } catch (error: any) {
        console.error(`❌ Failed to search client on server ${serverId}:`, error.message);
      }
    }

    return results.filter(r => r.result.success && r.result.obj && r.result.obj.length > 0);
  }

  /**
   * Delete client from specific server
   */
  public async deleteClient(serverId: string, inboundId: number, uuid: string): Promise<ApiResponse> {
    const apiClient = this.getClient(serverId);
    if (!apiClient) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }
    return await apiClient.deleteClient(inboundId, uuid);
  }

  /**
   * Reset client traffic on specific server
   */
  public async resetClientTraffic(serverId: string, inboundId: number, email: string): Promise<ApiResponse> {
    const apiClient = this.getClient(serverId);
    if (!apiClient) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }
    return await apiClient.resetClientTraffic(inboundId, email);
  }

  /**
   * Test connection to all servers
   */
  public async testAllConnections(): Promise<Array<{ serverId: string; serverName: string; success: boolean; error?: string }>> {
    const results = [];

    for (const [serverId, client] of this.clients) {
      try {
        await client.getInbounds();
        const server = this.getServer(serverId);
        results.push({
          serverId,
          serverName: server?.name || serverId,
          success: true
        });
      } catch (error: any) {
        const server = this.getServer(serverId);
        results.push({
          serverId,
          serverName: server?.name || serverId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

export default MultiServerManager;
