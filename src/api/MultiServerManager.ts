import { XUIApiClient } from './XUIApiClient';
import { ServerConfig, ApiResponse, Inbound, Client, ClientTraffic } from '../types';
import { DatabaseService } from '../db/DatabaseService';

export class MultiServerManager {
  private serversByDiscord: Map<string, ServerConfig[]> = new Map(); // Discord server ID -> ServerConfig[]
  private clients: Map<string, XUIApiClient> = new Map(); // Server ID -> XUIApiClient
  private dbService: DatabaseService;
  private initialized: boolean = false;

  constructor() {
    this.dbService = new DatabaseService();
  }

  /**
   * Initialize the manager with database
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.dbService.initialize();
      await this.loadServerConfigurations();
      this.initialized = true;
      console.log('✅ MultiServerManager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize MultiServerManager:', error);
      throw error;
    }
  }
  
  /**
   * Load server configurations from database with fallback to environment variables
  */
  private async loadServerConfigurations(): Promise<void> {
    try {
      // First try to load from database
      const servers = await this.dbService.getActiveServers();
      
      if (servers.length > 0) {
        console.log(`🔍 Loading ${servers.length} server configurations from database`);
        
        servers.forEach(server => {
          this.addServer(server);
        });
        
        console.log(`✅ Loaded ${this.getTotalServerCount()} active server(s) from database`);
        return;
      }
    } catch (error) {
      console.error('❌ Failed to load servers from database:', error);
    }

    // Fallback to environment variables approach
    const serversData = process.env.SERVERS_CONFIG;
    
    if (serversData) {
      try {
        const servers: ServerConfig[] = JSON.parse(serversData);
        console.log('🔍 Loading server configurations from SERVERS_CONFIG environment variable');
        
        for (const server of servers) {
          if (server.isActive) {
            await this.dbService.addServer(server);
            this.addServer(server);
          }
        }
          if (this.getTotalServerCount() > 0) {
          console.log(`✅ Loaded ${this.getTotalServerCount()} active server(s) from environment variable and saved to database`);
          return;
        }
      } catch (error) {
        console.error('❌ Failed to parse SERVERS_CONFIG environment variable:', error);
      }
    }

    // Final fallback to single server configuration for backward compatibility
    if (process.env.API_HOST && process.env.API_USERNAME && process.env.API_PASSWORD) {
      console.log('🔍 Using legacy single server configuration from environment variables');
      const singleServer: ServerConfig = {
        id: 'default',
        name: 'Default Server',
        host: process.env.API_HOST,
        port: process.env.API_PORT || '2053',
        webBasePath: process.env.API_WEBBASEPATH || '',
        username: process.env.API_USERNAME,
        password: process.env.API_PASSWORD,
        isActive: true
      };
      
      try {
        await this.dbService.addServer(singleServer);
      } catch (error) {
        console.warn('⚠️ Failed to save legacy server to database:', error);
      }
      
      this.addServer(singleServer);
      console.log(`✅ Loaded ${this.getTotalServerCount()} active server(s) from legacy configuration`);
    } else {
      console.log('📋 No servers configured. Use the /manage-servers command to add servers.');
    }
  }
  /**
   * Add a server configuration and create its API client
   */
  private addServer(config: ServerConfig): void {
    const discordId = config.discordServerId || 'global';
    
    // Get existing servers for this Discord server or create new array
    const existingServers = this.serversByDiscord.get(discordId) || [];
    
    // Check if server already exists
    const existingIndex = existingServers.findIndex(s => s.id === config.id);
    if (existingIndex >= 0) {
      existingServers[existingIndex] = config;
    } else {
      existingServers.push(config);
    }
    
    this.serversByDiscord.set(discordId, existingServers);
    
    const apiClient = new XUIApiClient(config);
    this.clients.set(config.id, apiClient);
    console.log(`✅ Added server: ${config.name} (${config.id}) to Discord: ${discordId}`);
  }

  /**
   * Get total number of servers across all Discord servers
   */
  private getTotalServerCount(): number {
    let total = 0;
    for (const servers of this.serversByDiscord.values()) {
      total += servers.length;
    }
    return total;
  }

  /**
   * Get all available servers
   */
  public getServers(): ServerConfig[] {
    const allServers: ServerConfig[] = [];
    for (const servers of this.serversByDiscord.values()) {
      allServers.push(...servers);
    }
    return allServers;
  }

  /**
   * Get server configuration by ID
   */
  public getServer(serverId: string): ServerConfig | undefined {
    for (const servers of this.serversByDiscord.values()) {
      const server = servers.find(s => s.id === serverId);
      if (server) return server;
    }
    return undefined;
  }

  /**
   * Get servers for a Discord server (cache-first, no database call)
   */
  public getServersByDiscordIdCached(discordServerId: string): ServerConfig[] {
    return this.serversByDiscord.get(discordServerId) || [];
  }

  /**
   * Get servers accessible from a Discord server (cache-first)
   * Returns servers associated with the Discord server ID or servers with no Discord ID set
   */
  public getAccessibleServersCached(discordServerId: string | null): ServerConfig[] {
    if (!discordServerId) {
      return this.getServers().filter(s => s.isActive);
    }

    const result: ServerConfig[] = [];
    
    // Add servers specifically for this Discord server
    const discordServers = this.serversByDiscord.get(discordServerId) || [];
    result.push(...discordServers.filter(s => s.isActive));
    
    // Add global servers (those without Discord server ID)
    const globalServers = this.serversByDiscord.get('global') || [];
    result.push(...globalServers.filter(s => s.isActive));
    
    return result;
  }

  /**
   * Validate that a server belongs to a Discord server (cache-first)
   */
  public validateServerAccess(serverId: string, discordServerId: string | null): ServerConfig | null {
    const accessibleServers = this.getAccessibleServersCached(discordServerId);
    return accessibleServers.find(s => s.id === serverId) || null;
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

    for (const [serverId, client] of Array.from(this.clients.entries())) {
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

    for (const [serverId, client] of Array.from(this.clients.entries())) {
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

    for (const [serverId, client] of Array.from(this.clients.entries())) {
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

    for (const [serverId, client] of Array.from(this.clients.entries())) {
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

  /**
   * Add a new server to the database and initialize its client
   */
  public async addNewServer(config: ServerConfig): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    await this.dbService.addServer(config);
    if (config.isActive) {
      this.addServer(config);
    }
  }
  /**
   * Update an existing server in the database
   */
  public async updateExistingServer(id: string, config: Partial<ServerConfig>): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    await this.dbService.updateServer(id, config);
    
    // Update in-memory cache if the server is loaded
    let serverFound = false;
    for (const [discordId, servers] of this.serversByDiscord.entries()) {
      const serverIndex = servers.findIndex(s => s.id === id);
      if (serverIndex >= 0) {
        const updatedServer = { ...servers[serverIndex], ...config };
        servers[serverIndex] = updatedServer;
        serverFound = true;
        
        // Recreate the client if needed
        if (config.host || config.port || config.username || config.password || config.webBasePath) {
          this.clients.delete(id);
          if (updatedServer.isActive) {
            const newClient = new XUIApiClient(updatedServer);
            this.clients.set(id, newClient);
          }
        }
        break;
      }
    }
  }

  /**
   * Delete a server from the database
   */
  public async deleteExistingServer(id: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    await this.dbService.deleteServer(id);
    
    // Remove from cache
    for (const [discordId, servers] of this.serversByDiscord.entries()) {
      const serverIndex = servers.findIndex(s => s.id === id);
      if (serverIndex >= 0) {
        servers.splice(serverIndex, 1);
        if (servers.length === 0) {
          this.serversByDiscord.delete(discordId);
        }
        break;
      }
    }
    
    this.clients.delete(id);
  }

  /**
   * Set server active status
   */
  public async setServerActiveStatus(id: string, isActive: boolean): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    await this.dbService.setServerActive(id, isActive);
    
    // Update cache
    for (const servers of this.serversByDiscord.values()) {
      const server = servers.find(s => s.id === id);
      if (server) {
        server.isActive = isActive;
        if (!isActive) {
          this.clients.delete(id);
        } else {
          const newClient = new XUIApiClient(server);
          this.clients.set(id, newClient);
        }
        break;
      }
    }
  }
  /**
   * Refresh servers from database
   */
  public async refreshServers(): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    this.serversByDiscord.clear();
    this.clients.clear();
    await this.loadServerConfigurations();
  }

  /**
   * Refresh servers for a specific Discord server only
   */
  public async refreshServersForDiscord(discordServerId: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    // Remove current Discord server entries from cache
    const currentDiscordServers = this.serversByDiscord.get(discordServerId) || [];
    currentDiscordServers.forEach(server => {
      this.clients.delete(server.id);
    });
    this.serversByDiscord.delete(discordServerId);
    
    // Reload servers for this Discord server from database
    const refreshedServers = await this.dbService.getServersByDiscordId(discordServerId);
    refreshedServers.forEach(server => {
      if (server.isActive) {
        this.addServer(server);
      }
    });
    
    console.log(`✅ Refreshed ${refreshedServers.length} server(s) for Discord server ${discordServerId}`);
  }

  /**
   * Get API client for a specific server
   */
  public getClient(serverId: string): XUIApiClient | undefined {
    return this.clients.get(serverId);
  }
}

export default MultiServerManager;
