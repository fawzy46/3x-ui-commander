import { eq, and } from 'drizzle-orm';
import { db, schema } from './index';
import { ServerConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class DatabaseService {
  /**
   * Initialize the database and run migrations
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure the data directory exists
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Create tables if they don't exist
      await this.createTables();

      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }
  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    try {
      await db.run(`
        CREATE TABLE IF NOT EXISTS servers (
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
        )
      `);
    } catch (error) {
      console.error('Failed to create tables:', error);
      throw error;
    }
  }

  /**
   * Get all active servers
   */
  public async getActiveServers(): Promise<ServerConfig[]> {
    const servers = await db
      .select()
      .from(schema.servers)
      .where(eq(schema.servers.isActive, true));
    return servers.map(this.mapToServerConfig);
  }

  /**
   * Get all servers (active and inactive)
   */
  public async getAllServers(): Promise<ServerConfig[]> {
    const servers = await db.select().from(schema.servers);
    return servers.map(this.mapToServerConfig);
  }

  /**
   * Get server by ID
   */
  public async getServerById(id: string): Promise<ServerConfig | null> {
    const servers = await db
      .select()
      .from(schema.servers)
      .where(eq(schema.servers.id, id));
    return servers.length > 0 ? this.mapToServerConfig(servers[0]) : null;
  }

  /**
   * Get servers by Discord server ID
   */
  public async getServersByDiscordId(
    discordServerId: string
  ): Promise<ServerConfig[]> {
    const servers = await db
      .select()
      .from(schema.servers)
      .where(
        and(
          eq(schema.servers.discordServerId, discordServerId),
          eq(schema.servers.isActive, true)
        )
      );
    return servers.map(this.mapToServerConfig);
  }

  /**
   * Get first server by Discord server ID
   */
  public async getServerByDiscordId(
    discordServerId: string
  ): Promise<ServerConfig | null> {
    const servers = await this.getServersByDiscordId(discordServerId);
    return servers.length > 0 ? servers[0] : null;
  }

  /**
   * Filter servers by Discord server ID
   * Returns servers associated with the Discord server ID or servers with no Discord ID set
   */
  public async filterServersByDiscordId(
    discordServerId: string | null
  ): Promise<ServerConfig[]> {
    if (!discordServerId) {
      return this.getActiveServers();
    }

    const servers = await db
      .select()
      .from(schema.servers)
      .where(and(eq(schema.servers.isActive, true)));

    return servers
      .filter(
        (server) =>
          !server.discordServerId || server.discordServerId === discordServerId
      )
      .map(this.mapToServerConfig);
  }

  /**
   * Add a new server
   */
  public async addServer(config: ServerConfig): Promise<void> {
    const now = new Date();
    await db.insert(schema.servers).values({
      id: config.id,
      name: config.name,
      host: config.host,
      port: config.port,
      webBasePath: config.webBasePath,
      username: config.username,
      password: config.password,
      isActive: config.isActive,
      discordServerId: config.discordServerId,
      createdAt: now,
      updatedAt: now
    });
  }

  /**
   * Update an existing server
   */
  public async updateServer(
    id: string,
    config: Partial<ServerConfig>
  ): Promise<void> {
    const now = new Date();
    await db
      .update(schema.servers)
      .set({
        ...config,
        updatedAt: now
      })
      .where(eq(schema.servers.id, id));
  }

  /**
   * Delete a server
   */
  public async deleteServer(id: string): Promise<void> {
    await db.delete(schema.servers).where(eq(schema.servers.id, id));
  }
  /**
   * Set server active status
   */
  public async setServerActive(id: string, isActive: boolean): Promise<void> {
    await this.updateServer(id, { isActive });
  }

  /**
   * Map database row to ServerConfig interface
   */
  private mapToServerConfig(
    server: typeof schema.servers.$inferSelect
  ): ServerConfig {
    return {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      webBasePath: server.webBasePath,
      username: server.username,
      password: server.password,
      isActive: server.isActive,
      discordServerId: server.discordServerId || undefined
    };
  }
}
