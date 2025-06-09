import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { MultiServerManager } from '../api/MultiServerManager';

export class ListServersCommand {
  public data;

  constructor(private serverManager: MultiServerManager) {
    this.data = new SlashCommandBuilder()
      .setName('list-servers')
      .setDescription('List all configured 3x-ui servers and their status')
      .addBooleanOption(option =>
        option.setName('test-connection')
          .setDescription('Test connection to all servers (default: false)')
          .setRequired(false)
      );
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const testConnection = interaction.options.getBoolean('test-connection') || false;
      const servers = this.serverManager.getServers();

      if (servers.length === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ No Servers Configured')
          .setDescription('No active servers found in configuration')
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      let connectionResults: any[] = [];
      if (testConnection) {
        const embed = new EmbedBuilder()
          .setColor(0xFF9900)
          .setTitle('🔄 Testing Connections...')
          .setDescription('Please wait while testing connections to all servers...')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        connectionResults = await this.serverManager.testAllConnections();
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🌐 Configured 3x-ui Servers')
        .setDescription(`Found ${servers.length} active server(s)${testConnection ? ' with connection test results' : ''}`)
        .setTimestamp();

      servers.forEach((server, index) => {
        let statusText = '';
        
        if (testConnection && connectionResults.length > 0) {
          const connectionResult = connectionResults.find(r => r.serverId === server.id);
          if (connectionResult) {
            statusText += `\n**Connection:** ${connectionResult.success ? '✅ Online' : '❌ Offline'}`;
            if (!connectionResult.success && connectionResult.error) {
              statusText += `\n**Error:** ${connectionResult.error.substring(0, 50)}...`;
            }
          }
        }

        embed.addFields({
          name: `${index + 1}. ${server.id}`,
          value: statusText,
          inline: false
        });
      });

      if (testConnection) {
        const onlineCount = connectionResults.filter(r => r.success).length;
        embed.addFields({
          name: '📊 Connection Summary',
          value: `Online: ${onlineCount}/${servers.length} servers`,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } 
    catch (error: any) {
      console.error('Error in list-servers command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription(error.message || 'An unexpected error occurred')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}
