import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { MultiServerManager } from '../api/MultiServerManager';
import { ServerConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ManageServersCommand {
  public data;

  constructor(private serverManager: MultiServerManager) {
    this.data = new SlashCommandBuilder()
      .setName('manage-servers')
      .setDescription('Manage 3x-ui servers (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(subcommand =>
        subcommand
          .setName('add')
          .setDescription('Add a new server')
          .addStringOption(option =>
            option.setName('id')
              .setDescription('Unique server ID')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('name')
              .setDescription('Server display name')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('host')
              .setDescription('Server host (with protocol, e.g., http://192.168.1.1)')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('port')
              .setDescription('Server port')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('webbasepath')
              .setDescription('Web base path (e.g., /panel or empty for root)')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('username')
              .setDescription('Admin username')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('password')
              .setDescription('Admin password')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('discord-server-id')
              .setDescription('Discord server ID (optional - restricts access)')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('remove')
          .setDescription('Remove a server')
          .addStringOption(option =>
            option.setName('server-id')
              .setDescription('Server ID to remove')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('toggle')
          .setDescription('Enable/disable a server')
          .addStringOption(option =>
            option.setName('server-id')
              .setDescription('Server ID to toggle')
              .setRequired(true)
          )
          .addBooleanOption(option =>
            option.setName('active')
              .setDescription('Set server active status')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('refresh')
          .setDescription('Refresh servers from database')
      );
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'add':
          await this.handleAdd(interaction);
          break;
        case 'remove':
          await this.handleRemove(interaction);
          break;
        case 'toggle':
          await this.handleToggle(interaction);
          break;
        case 'refresh':
          await this.handleRefresh(interaction);
          break;
        default:
          throw new Error('Unknown subcommand');
      }
    } catch (error: any) {
      console.error('Error in manage-servers command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription(error.message || 'An unexpected error occurred')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  private async handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
    const id = interaction.options.getString('id', true);
    const name = interaction.options.getString('name', true);
    const host = interaction.options.getString('host', true);
    const port = interaction.options.getString('port', true);
    const webBasePath = interaction.options.getString('webbasepath', true);
    const username = interaction.options.getString('username', true);
    const password = interaction.options.getString('password', true);
    const discordServerId = interaction.options.getString('discord-server-id');

    // Validate that server ID doesn't already exist
    const existingServer = this.serverManager.getServer(id);
    if (existingServer) {
      throw new Error(`Server with ID '${id}' already exists`);
    }

    const serverConfig: ServerConfig = {
      id,
      name,
      host,
      port,
      webBasePath,
      username,
      password,
      isActive: true,
      discordServerId: discordServerId || undefined
    };

    await this.serverManager.addNewServer(serverConfig);

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Server Added Successfully')
      .addFields(
        { name: 'ID', value: id, inline: true },
        { name: 'Name', value: name, inline: true },
        { name: 'Host', value: host, inline: true },
        { name: 'Port', value: port, inline: true },
        { name: 'Web Path', value: webBasePath || '/', inline: true },
        { name: 'Discord Server', value: discordServerId || 'All servers', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  }

  private async handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
    const serverId = interaction.options.getString('server-id', true);

    const server = this.serverManager.getServer(serverId);
    if (!server) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }

    await this.serverManager.deleteExistingServer(serverId);

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Server Removed Successfully')
      .addFields(
        { name: 'ID', value: serverId, inline: true },
        { name: 'Name', value: server.name, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  }

  private async handleToggle(interaction: ChatInputCommandInteraction): Promise<void> {
    const serverId = interaction.options.getString('server-id', true);
    const active = interaction.options.getBoolean('active', true);

    const server = this.serverManager.getServer(serverId);
    if (!server) {
      throw new Error(`Server with ID '${serverId}' not found`);
    }

    await this.serverManager.setServerActiveStatus(serverId, active);

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Server Status Updated')
      .addFields(
        { name: 'ID', value: serverId, inline: true },
        { name: 'Name', value: server.name, inline: true },
        { name: 'Status', value: active ? '✅ Active' : '❌ Inactive', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  }

  private async handleRefresh(interaction: ChatInputCommandInteraction): Promise<void> {
    await this.serverManager.refreshServers();

    const servers = this.serverManager.getServers();

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Servers Refreshed')
      .setDescription(`Reloaded ${servers.length} server(s) from database`)
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  }
}
