import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionsBitField
} from 'discord.js';
import { MultiServerManager } from '../api/MultiServerManager';

export class GetClientTrafficCommand {
  public data;
  constructor(private serverManager: MultiServerManager) {
    this.data = new SlashCommandBuilder()
      .setName('get-traffic')
      .setDescription(
        'Get client traffic information from 3x-ui (defaults to your Discord username)'
      )
      .addStringOption((option) =>
        option
          .setName('server')
          .setDescription('Server ID to search')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('email')
          .setDescription(
            'Client email to get traffic for (optional - defaults to your Discord username)'
          )
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('uuid')
          .setDescription('Client UUID to get traffic for')
          .setRequired(false)
      );
  }

  public async execute(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    try {
      const guildId = interaction.guildId;

      // Check if user has administrator permissions
      const member = interaction.member;
      let hasAdminPermissions = false;

      if (member && typeof member.permissions !== 'string') {
        hasAdminPermissions = member.permissions.has(
          PermissionsBitField.Flags.Administrator
        );
      }

      let email: string;
      let uuid: string | null = null;
      let serverId: string | null = null;
      if (hasAdminPermissions) {
        // Administrators can specify custom email, UUID, and server
        email =
          interaction.options.getString('email') || interaction.user.username;
        uuid = interaction.options.getString('uuid');
        serverId = interaction.options.getString('server');
      } else {
        // Regular users can only check their own traffic using their Discord username
        email = interaction.user.username;

        // If they tried to specify a custom email, UUID, or server, inform them
        const providedEmail = interaction.options.getString('email');
        const providedUuid = interaction.options.getString('uuid');
        const providedServer = interaction.options.getString('server');
        if (providedEmail || providedUuid || providedServer) {
          const restrictionEmbed = new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle('⚠️ Access Restricted')
            .setDescription(
              'You can only view your own traffic data. Using your Discord username instead.'
            )
            .addFields({ name: 'Your Email', value: email, inline: true })
            .setTimestamp();

          await interaction.editReply({ embeds: [restrictionEmbed] });
          return;
        }
      }
      if (serverId) {
        const serverInfo = this.serverManager.validateServerAccess(
          serverId,
          guildId
        );

        if (!serverInfo) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Server Not Found')
            .setDescription(
              `Server with ID '${serverId}' not found or not accessible from this Discord server`
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }
      } else {
        if (guildId) {
          const availableServers =
            this.serverManager.getServersByDiscordIdCached(guildId);
          if (availableServers.length > 0) {
            // Only search servers linked to this Discord server
            serverId = availableServers[0].id;
          }
        }
      }

      // Search for client
      let results: any[] = [];
      let searchType: string = '';
      if (serverId) {
        const serverInfo = this.serverManager.validateServerAccess(
          serverId,
          guildId
        )!;

        if (uuid) {
          const response = await this.serverManager.getClientTrafficById(
            serverId,
            uuid
          );
          if (response.success && response.obj && response.obj.length > 0) {
            results.push({
              serverId,
              serverName: serverInfo.name,
              result: { ...response, obj: response.obj[0] }
            });
          }
          searchType = `UUID: ${uuid}`;
        } else {
          const response = await this.serverManager.getClientTraffic(
            serverId,
            email
          );
          if (response.success && response.obj) {
            results.push({
              serverId,
              serverName: serverInfo.name,
              result: response
            });
          }
          searchType = `Email: ${email}`;
        }
      } else {
        // Search across all servers belonging to this Discord server (cache-first)
        const discordServers =
          this.serverManager.getAccessibleServersCached(guildId);

        if (discordServers.length === 0) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ No Servers Available')
            .setDescription('No servers are available for this Discord server')
            .setTimestamp();

          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        // Search each server individually
        for (const server of discordServers) {
          try {
            if (uuid) {
              const response = await this.serverManager.getClientTrafficById(
                server.id,
                uuid
              );
              if (response.success && response.obj && response.obj.length > 0) {
                results.push({
                  serverId: server.id,
                  serverName: server.name,
                  result: { ...response, obj: response.obj[0] }
                });
              }
            } else {
              const response = await this.serverManager.getClientTraffic(
                server.id,
                email
              );
              if (response.success && response.obj) {
                results.push({
                  serverId: server.id,
                  serverName: server.name,
                  result: response
                });
              }
            }
          } catch (error: any) {
            console.error(
              `❌ Failed to search client on server ${server.id}:`,
              error.message
            );
          }
        }

        searchType = uuid ? `UUID: ${uuid}` : `Email: ${email}`;
      }

      if (results.length === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Client Not Found')
          .setDescription(
            `No client found with the provided identifier (${searchType})`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // If multiple results, show summary first
      if (results.length > 1) {
        const summaryEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('📊 Client Found on Multiple Servers')
          .setDescription(
            `Found client "${searchType}" on ${results.length} server(s)`
          )
          .addFields(
            ...results.map((r) => ({
              name: `Server: ${r.serverName}`,
              value: `Status: ${r.result.obj.enable ? '✅ Enabled' : '❌ Disabled'}`,
              inline: true
            }))
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [summaryEmbed] });
        return;
      }

      // Show detailed information for single result
      const result = results[0];
      const clientData = result.result.obj;

      // Convert bytes to human-readable format
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      // Format expiry date
      const formatExpiry = (timestamp: number): string => {
        if (timestamp === 0) return 'No expiry';
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      };

      // Calculate usage percentage
      const totalBytes = clientData.total || 0;
      const upBytes = clientData.up || 0;
      const downBytes = clientData.down || 0;
      const usedBytes = upBytes + downBytes;
      const usagePercentage =
        totalBytes > 0 ? ((usedBytes / totalBytes) * 100).toFixed(2) : 'N/A';

      const embed = new EmbedBuilder()
        .setColor(clientData.enable ? 0x00ff00 : 0xff9900)
        .setTitle(
          `📊 Client Traffic Information ${uuid ? '(by UUID)' : '(by Email)'}`
        )
        .setDescription(
          `Server: **${result.serverName}**\nQueried by ${searchType}${hasAdminPermissions ? '' : ' (your Discord username)'}`
        )
        .addFields(
          { name: 'Email', value: clientData.email, inline: true },
          { name: 'ID', value: clientData.id.toString(), inline: true },
          {
            name: 'Inbound ID',
            value: clientData.inboundId.toString(),
            inline: true
          },
          {
            name: 'Status',
            value: clientData.enable ? '✅ Enabled' : '❌ Disabled',
            inline: true
          },
          { name: 'Upload', value: formatBytes(upBytes), inline: true },
          { name: 'Download', value: formatBytes(downBytes), inline: true },
          { name: 'Total Used', value: formatBytes(usedBytes), inline: true },
          {
            name: 'Total Limit',
            value: totalBytes > 0 ? formatBytes(totalBytes) : 'Unlimited',
            inline: true
          },
          {
            name: 'Usage',
            value: totalBytes > 0 ? `${usagePercentage}%` : 'N/A',
            inline: true
          },
          {
            name: 'Expiry Time',
            value: formatExpiry(clientData.expiryTime),
            inline: false
          },
          {
            name: 'Reset Count',
            value: clientData.reset.toString(),
            inline: true
          }
        )
        .setTimestamp();

      // Add warning if usage is high
      if (totalBytes > 0 && parseFloat(usagePercentage) > 80) {
        embed.setColor(0xff0000);
        embed.addFields({
          name: '⚠️ Warning',
          value: 'High usage detected!',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      console.error('Error in get-traffic command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription(error.message || 'An unexpected error occurred')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}
