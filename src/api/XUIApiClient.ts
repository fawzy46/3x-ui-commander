import axios, { AxiosInstance } from 'axios';
import {
  Client,
  ClientTraffic,
  ApiResponse,
  Inbound,
  ServerConfig
} from '../types';

export class XUIApiClient {
  private axios: AxiosInstance;
  private sessionCookie: string | null = null;
  private apiHost: string;
  private apiPort: string;
  private apiWebBasePath: string;
  private apiUsername: string;
  private apiPassword: string;
  private serverId?: string;
  private serverName?: string;

  constructor(config?: ServerConfig) {
    if (config) {
      // Use provided server configuration
      this.serverId = config.id;
      this.serverName = config.name;
      this.apiHost = config.host;
      this.apiPort = config.port;
      this.apiWebBasePath = config.webBasePath;
      this.apiUsername = config.username;
      this.apiPassword = config.password;
    } else {
      // Fallback to environment variables for backward compatibility
      this.apiHost = process.env.API_HOST || 'localhost';
      this.apiPort = process.env.API_PORT || '2053';
      this.apiWebBasePath = process.env.API_WEBBASEPATH || '';
      this.apiUsername = process.env.API_USERNAME || 'admin';
      this.apiPassword = process.env.API_PASSWORD || 'admin';
    }

    const baseURL = `${this.apiHost}:${this.apiPort}${this.apiWebBasePath}`;

    this.axios = axios.create({
      baseURL,
      timeout: 30000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Add request interceptor to include session cookie
    this.axios.interceptors.request.use((config) => {
      if (this.sessionCookie) {
        config.headers.Cookie = this.sessionCookie;
      }
      return config;
    });

    // Add response interceptor to handle 401 errors (re-login)
    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          await this.login();
          return this.axios.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Login to 3x-ui panel and store session cookie
   */
  public async login(): Promise<void> {
    try {
      const loginData = new URLSearchParams({
        username: this.apiUsername,
        password: this.apiPassword
      });

      const response = await this.axios.post('/login', loginData);

      if (response.data.success) {
        // Extract session cookie from response headers
        const setCookie = response.headers['set-cookie'];
        if (setCookie && setCookie.length > 0) {
          // Find the session cookie (usually named '3x-ui')
          const sessionCookie = setCookie.find((cookie) =>
            cookie.includes('3x-ui=')
          );
          if (sessionCookie) {
            this.sessionCookie = sessionCookie.split(';')[0];
          }
        }
        console.log(
          `✅ Successfully logged in to 3x-ui API${this.serverName ? ` (${this.serverName})` : ''}`
        );
      } else {
        throw new Error(response.data.msg || 'Login failed');
      }
    } catch (error: any) {
      console.error(
        `❌ Failed to login to 3x-ui API${this.serverName ? ` (${this.serverName})` : ''}:`,
        error.message
      );
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Ensure we're authenticated before making API calls
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.sessionCookie) {
      await this.login();
    }
  }

  /**
   * Get all inbounds
   */
  public async getInbounds(): Promise<ApiResponse<Inbound[]>> {
    await this.ensureAuthenticated();

    try {
      const response = await this.axios.get('/panel/api/inbounds/list');
      return response.data;
    } catch (error: any) {
      console.error('Error getting inbounds:', error.message);
      throw error;
    }
  }

  /**
   * Get specific inbound by ID
   */
  public async getInbound(inboundId: number): Promise<ApiResponse<Inbound>> {
    await this.ensureAuthenticated();

    try {
      const response = await this.axios.get(
        `/panel/api/inbounds/get/${inboundId}`
      );
      return response.data;
    } catch (error: any) {
      console.error(`Error getting inbound ${inboundId}:`, error.message);
      throw error;
    }
  }

  /**
   * Add a client to an inbound
   */
  public async addClient(
    inboundId: number,
    client: Client
  ): Promise<ApiResponse> {
    await this.ensureAuthenticated();

    try {
      var settings: any = { clients: [] };

      if (!client) {
        throw new Error('Client data is required');
      }

      settings.clients.push(client);

      // Prepare the update data
      const updateData = new URLSearchParams({
        id: inboundId.toString(),
        settings: JSON.stringify(settings)
      });

      const response = await this.axios.post(
        `/panel/api/inbounds/addClient`,
        updateData
      );
      return response.data;
    } catch (error: any) {
      console.error('Error adding client:', error.message);
      throw error;
    }
  }

  /**
   * Update a client
   */
  public async updateClient(
    uuid: string,
    inboundId: number,
    client: Client
  ): Promise<ApiResponse> {
    await this.ensureAuthenticated();

    try {
      const updateData = new URLSearchParams({
        id: inboundId.toString(),
        settings: JSON.stringify({
          clients: [client]
        })
      });

      const response = await this.axios.post(
        `/panel/api/inbounds/updateClient/${uuid}`,
        updateData
      );
      return response.data;
    } catch (error: any) {
      console.error('Error updating client:', error.message);
      throw error;
    }
  }

  /**
   * Get client traffic by email
   */
  public async getClientTraffic(
    email: string
  ): Promise<ApiResponse<ClientTraffic>> {
    await this.ensureAuthenticated();

    try {
      const response = await this.axios.get(
        `/panel/api/inbounds/getClientTraffics/${email}`
      );
      return response.data;
    } catch (error: any) {
      console.error(
        `Error getting client traffic for ${email}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Get client traffic by UUID
   */
  public async getClientTrafficById(
    uuid: string
  ): Promise<ApiResponse<ClientTraffic[]>> {
    await this.ensureAuthenticated();

    try {
      const response = await this.axios.get(
        `/panel/api/inbounds/getClientTrafficsById/${uuid}`
      );
      return response.data;
    } catch (error: any) {
      console.error(
        `Error getting client traffic for UUID ${uuid}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Delete a client
   */
  public async deleteClient(
    inboundId: number,
    uuid: string
  ): Promise<ApiResponse> {
    await this.ensureAuthenticated();

    try {
      const deleteData = new URLSearchParams({
        id: inboundId.toString(),
        uuid: uuid
      });

      const response = await this.axios.post(
        `/panel/api/inbounds/delClient/${uuid}`,
        deleteData
      );
      return response.data;
    } catch (error: any) {
      console.error('Error deleting client:', error.message);
      throw error;
    }
  }

  /**
   * Reset client traffic
   */
  public async resetClientTraffic(
    inboundId: number,
    email: string
  ): Promise<ApiResponse> {
    await this.ensureAuthenticated();

    try {
      const resetData = new URLSearchParams({
        id: inboundId.toString(),
        email: email
      });

      const response = await this.axios.post(
        `/panel/api/inbounds/resetClientTraffic/${email}`,
        resetData
      );
      return response.data;
    } catch (error: any) {
      console.error('Error resetting client traffic:', error.message);
      throw error;
    }
  }

  /**
   * Get server information
   */
  public getServerInfo(): {
    id?: string;
    name?: string;
    host: string;
    port: string;
  } {
    return {
      id: this.serverId,
      name: this.serverName,
      host: this.apiHost,
      port: this.apiPort
    };
  }
}

export default XUIApiClient;
