import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { MultiServerManager } from '../api/MultiServerManager';
import { Client } from '../types';

export class UpdateClientCommand {
  public data;
  constructor(private serverManager: MultiServerManager) {
    this.data = new SlashCommandBuilder()
      .setName('update-client')
      .setDescription('Update an existing client in 3x-ui')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((option) =>
        option
          .setName('server')
          .setDescription(
            'Server ID where the client exists (use /list-servers to see available servers)'
          )
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('uuid')
          .setDescription('Client UUID to update')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('inbound-id')
          .setDescription('The inbound ID where the client exists')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('email')
          .setDescription('New client email/username')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('total-gb')
          .setDescription('New total GB limit (0 for unlimited)')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('expiry-days')
          .setDescription('New days until expiry (0 for no expiry)')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('limit-ip')
          .setDescription('New IP connection limit (0 for unlimited)')
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName('enabled')
          .setDescription('Enable or disable the client')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('reset-traffic')
          .setDescription('Reset traffic (1 to reset, 0 to keep current)')
          .setRequired(false)
      );
  }

  public async execute(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const serverId = interaction.options.getString('server', true);
      const uuid = interaction.options.getString('uuid', true);
      const inboundId = interaction.options.getInteger('inbound-id', true);

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

      // Check if the command is being used in the correct Discord server
      if (
        serverInfo.discordServerId &&
        guildId &&
        serverInfo.discordServerId !== guildId
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Server Access Restricted')
          .setDescription(
            `This server can only be managed from its assigned Discord server.`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Get current client info first (we need to get this from the traffic endpoint)
      const trafficResponse = await this.serverManager.getClientTrafficById(
        serverId,
        uuid
      );

      if (
        !trafficResponse.success ||
        !trafficResponse.obj ||
        trafficResponse.obj.length === 0
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Client Not Found')
          .setDescription('Could not find client with the provided UUID')
          .addFields({ name: 'Server', value: serverInfo.name, inline: true })
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const existingClient = trafficResponse.obj[0];

      // Get new values or keep existing ones
      const email =
        interaction.options.getString('email') || existingClient.email;
      const totalGB = interaction.options.getInteger('total-gb');
      const expiryDays = interaction.options.getInteger('expiry-days');
      const limitIp = interaction.options.getInteger('limit-ip');
      const enabled = interaction.options.getBoolean('enabled');
      const resetTraffic = interaction.options.getInteger('reset-traffic');

      // Calculate new expiry time
      let expiryTime = existingClient.expiryTime;
      if (expiryDays !== null) {
        expiryTime =
          expiryDays > 0 ? Date.now() + expiryDays * 24 * 60 * 60 * 1000 : 0;
      }

      // Create updated client object
      const updatedClient: Client = {
        id: uuid,
        email: email,
        limitIp: limitIp !== null ? limitIp : 0,
        totalGB: totalGB !== null ? totalGB * 1024 * 1024 * 1024 : 0, // Convert GB to bytes
        expiryTime: expiryTime,
        enable: enabled !== null ? enabled : existingClient.enable,
        tgId: '',
        subId: this.generateSubId(),
        reset: resetTraffic !== null ? resetTraffic : existingClient.reset,
        flow: '' // For VLESS protocol
      };

      // Update client via API
      const response = await this.serverManager.updateClient(
        serverId,
        uuid,
        inboundId,
        updatedClient
      );

      if (response.success) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Client Updated Successfully')
          .addFields(
            { name: 'Server', value: serverInfo.name, inline: true },
            { name: 'UUID', value: uuid, inline: true },
            { name: 'Email', value: email, inline: true },
            { name: 'Inbound ID', value: inboundId.toString(), inline: true },
            {
              name: 'Total GB',
              value:
                totalGB === null
                  ? 'Unchanged'
                  : totalGB === 0
                    ? 'Unlimited'
                    : `${totalGB} GB`,
              inline: true
            },
            {
              name: 'Expiry',
              value:
                expiryDays === null
                  ? 'Unchanged'
                  : expiryDays === 0
                    ? 'No expiry'
                    : `${expiryDays} days`,
              inline: true
            },
            {
              name: 'Status',
              value:
                enabled === null
                  ? 'Unchanged'
                  : enabled
                    ? 'Enabled'
                    : 'Disabled',
              inline: true
            }
          )
          .setTimestamp();

        if (resetTraffic === 1) {
          embed.addFields({ name: 'Traffic', value: 'Reset', inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
      } else {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Failed to Update Client')
          .setDescription(response.msg || 'Unknown error occurred')
          .addFields({ name: 'Server', value: serverInfo.name, inline: true })
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
      }
    } catch (error: any) {
      console.error('Error in update-client command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription(error.message || 'An unexpected error occurred')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  private generateSubId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
