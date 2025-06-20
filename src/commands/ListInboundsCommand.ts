import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { MultiServerManager } from '../api/MultiServerManager';

export class ListInboundsCommand {
  public data;

  constructor(private serverManager: MultiServerManager) {    
    this.data = new SlashCommandBuilder()
      .setName('list-inbounds')
      .setDescription('List all inbounds from 3x-ui servers')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(option =>
        option.setName('server')
          .setDescription('Select specific server (optional - shows all servers if not specified)')
          .setRequired(false)
          .addChoices(
            ...this.serverManager.getServers().map(server => ({
              name: server.name,
              value: server.id
            }))
          )
      );
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const serverId = interaction.options.getString('server');

      if (serverId) {
        // Get inbounds from specific server
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

        const response = await this.serverManager.getInbounds(serverId);
        
        if (!response.success || !response.obj) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Failed to Get Inbounds')
            .setDescription(`${response.msg || 'Unknown error occurred'}\nServer: ${serverInfo.name}`)
            .setTimestamp();

          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        const inbounds = response.obj;
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle(`📋 Inbounds - ${serverInfo.name}`)
          .setDescription(`Found ${inbounds.length} inbound(s)`)
          .setTimestamp();

        if (inbounds.length === 0) {
          embed.addFields({ name: 'No Inbounds', value: 'No inbounds found on this server', inline: false });
        } else {
          inbounds.forEach((inbound, index) => {
            const formatBytes = (bytes: number): string => {
              if (bytes === 0) return '0 B';
              const k = 1024;
              const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
              const i = Math.floor(Math.log(bytes) / Math.log(k));
              return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            };

            const statusText = `**Protocol:** ${inbound.protocol}\n**Port:** ${inbound.port}\n**Status:** ${inbound.enable ? '✅ Enabled' : '❌ Disabled'}\n**Traffic:** ↑${formatBytes(inbound.up)} ↓${formatBytes(inbound.down)}`;
            
            embed.addFields({
              name: `${index + 1}. ${inbound.remark} (ID: ${inbound.id})`,
              value: statusText,
              inline: true
            });
          });
        }

        await interaction.editReply({ embeds: [embed] });

      } else {
        // Get inbounds from all servers
        const results = await this.serverManager.getAllInbounds();
        
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('📋 All Inbounds - Multiple Servers')
          .setDescription(`Showing inbounds from ${results.length} server(s)`)
          .setTimestamp();

        if (results.length === 0) {
          embed.addFields({ name: 'No Servers', value: 'No servers available', inline: false });
        } else {
          let totalInbounds = 0;
          
          results.forEach((serverResult) => {
            if (serverResult.result.success && serverResult.result.obj) {
              const inbounds = serverResult.result.obj;
              totalInbounds += inbounds.length;
              
              const enabledCount = inbounds.filter(i => i.enable).length;
              const disabledCount = inbounds.length - enabledCount;
              
              let statusText = `**Total:** ${inbounds.length} inbound(s)\n**Enabled:** ${enabledCount} | **Disabled:** ${disabledCount}`;
              
              if (inbounds.length > 0) {
                const protocols = [...new Set(inbounds.map(i => i.protocol))];
                statusText += `\n**Protocols:** ${protocols.join(', ')}`;
              }
              
              embed.addFields({
                name: `🌐 ${serverResult.serverName}`,
                value: statusText,
                inline: true
              });
            } else {
              embed.addFields({
                name: `❌ ${serverResult.serverName}`,
                value: `Error: ${serverResult.result.msg || 'Connection failed'}`,
                inline: true
              });
            }
          });

          embed.setDescription(`Showing inbounds from ${results.length} server(s) - Total: ${totalInbounds} inbound(s)`);
        }

        await interaction.editReply({ embeds: [embed] });
      }

    } catch (error: any) {
      console.error('Error in list-inbounds command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription(error.message || 'An unexpected error occurred')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}
