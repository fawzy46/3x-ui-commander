import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { MultiServerManager } from '../api/MultiServerManager';
import { Client } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class AddClientCommand {
  public data;
  constructor(private serverManager: MultiServerManager) {    
    this.data = new SlashCommandBuilder()
      .setName('add-client')
      .setDescription('Add a new client to a 3x-ui inbound')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)      
      .addStringOption(option =>
        option.setName('server')
          .setDescription('Server ID to add the client to (use /list-servers to see available servers)')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('inbound-id')
          .setDescription('The inbound ID to add the client to')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('email')
          .setDescription('Client email/username')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('total-gb')
          .setDescription('Total GB limit (0 for unlimited)')
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option.setName('expiry-days')
          .setDescription('Days until expiry (0 for no expiry)')
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option.setName('limit-ip')
          .setDescription('IP connection limit (0 for unlimited)')
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable the client (default: true)')
          .setRequired(false)
      );
  }
    
  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      const serverId = interaction.options.getString('server', true);
      const inboundId = interaction.options.getInteger('inbound-id', true);
      const email = interaction.options.getString('email', true);
      const totalGB = interaction.options.getInteger('total-gb') || 0;
      const expiryDays = interaction.options.getInteger('expiry-days') || 0;
      const limitIp = interaction.options.getInteger('limit-ip') || 0;
      const enabled = interaction.options.getBoolean('enabled') ?? true;

      // Get server info
      const serverInfo = this.serverManager.getServer(serverId);
      if (!serverInfo) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Server Not Found')
          .setDescription(`Server with ID '${serverId}' not found`)
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Check if the command is being used in the correct Discord server
      if (serverInfo.discordServerId && guildId && serverInfo.discordServerId !== guildId) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Server Access Restricted')
          .setDescription(`This server can only be managed from its assigned Discord server.`)
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Calculate expiry time
      const expiryTime = expiryDays > 0 ? Date.now() + (expiryDays * 24 * 60 * 60 * 1000) : 0;

      // Create client object
      const client: Client = {
        id: uuidv4(),
        email: email,
        limitIp: limitIp,
        totalGB: totalGB * 1024 * 1024 * 1024, // Convert GB to bytes
        expiryTime: expiryTime,
        enable: enabled,
        tgId: '',
        subId: this.generateSubId(),
        reset: 0,
        flow: '' // For VLESS protocol
      };

      // Add client via API
      const response = await this.serverManager.addClient(serverId, inboundId, client);

      if (response.success) {
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Client Added Successfully')
          .addFields(
            { name: 'Server', value: serverInfo.name, inline: true },
            { name: 'Email', value: email, inline: true },
            { name: 'Inbound ID', value: inboundId.toString(), inline: true },
            { name: 'UUID', value: client.id, inline: true },
            { name: 'Total GB', value: totalGB === 0 ? 'Unlimited' : `${totalGB} GB`, inline: true },
            { name: 'Expiry', value: expiryDays === 0 ? 'No expiry' : `${expiryDays} days`, inline: true },
            { name: 'Status', value: enabled ? 'Enabled' : 'Disabled', inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ Failed to Add Client')
          .setDescription(response.msg || 'Unknown error occurred')
          .addFields(
            { name: 'Server', value: serverInfo.name, inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
      }
    } catch (error: any) {
      console.error('Error in add-client command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
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
