import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction
} from 'discord.js';
import { MultiServerManager } from '../api/MultiServerManager';
import { ServerConfig } from '../types';
export class ManageServersCommand {
  public data;

  constructor(private serverManager: MultiServerManager) {
    this.data = new SlashCommandBuilder()
      .setName('manage-servers')
      .setDescription('Manage 3x-ui servers (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('Add a new server (opens a form)')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('remove')
          .setDescription('Remove a server')
          .addStringOption((option) =>
            option
              .setName('server-id')
              .setDescription('Server ID to remove')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('edit')
          .setDescription('Edit a server configuration')
          .addStringOption((option) =>
            option
              .setName('server-id')
              .setDescription('Server ID to edit')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('toggle')
          .setDescription('Enable/disable a server')
          .addStringOption((option) =>
            option
              .setName('server-id')
              .setDescription('Server ID to toggle')
              .setRequired(true)
          )
          .addBooleanOption((option) =>
            option
              .setName('active')
              .setDescription('Set server active status')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('refresh')
          .setDescription('Refresh servers from database')
      );
  }
  public async execute(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'add':
          await this.handleAdd(interaction);
          break;
        case 'remove':
          await interaction.deferReply({ ephemeral: true });
          await this.handleRemove(interaction);
          break;
        case 'edit':
          await this.handleEdit(interaction);
          break;
        case 'toggle':
          await interaction.deferReply({ ephemeral: true });
          await this.handleToggle(interaction);
          break;
        case 'refresh':
          await interaction.deferReply({ ephemeral: true });
          await this.handleRefresh(interaction);
          break;
        default:
          await interaction.reply({
            content: 'Unknown subcommand',
            ephemeral: true
          });
      }
    } catch (error: any) {
      console.error('Error in manage-servers command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription(error.message || 'An unexpected error occurred')
        .setTimestamp();

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
  private async handleAdd(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    // Create the modal
    const modal = new ModalBuilder()
      .setCustomId('add_server_modal')
      .setTitle('Add New 3x-ui Server');

    // Create text input components
    const serverIdInput = new TextInputBuilder()
      .setCustomId('server_id')
      .setLabel('Server ID')
      .setPlaceholder('e.g., server1, main-server, us-west')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const serverNameInput = new TextInputBuilder()
      .setCustomId('server_name')
      .setLabel('Server Name')
      .setPlaceholder('e.g., Main Server (US West)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const hostInput = new TextInputBuilder()
      .setCustomId('host')
      .setLabel('Host (with protocol)')
      .setPlaceholder('e.g., http://192.168.1.100, https://panel.example.com')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200);

    const portWebPathInput = new TextInputBuilder()
      .setCustomId('port_webpath')
      .setLabel('Port and Web Base Path')
      .setPlaceholder('e.g., 2053,/panel or 443,/ or 8080,')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const credentialsInput = new TextInputBuilder()
      .setCustomId('credentials')
      .setLabel('Credentials and Default Inbound')
      .setPlaceholder(
        'username,password,defaultInboundId (e.g., admin,mypass123,1)'
      )
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200);

    // Create action rows and add inputs
    const firstActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(serverIdInput);
    const secondActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(serverNameInput);
    const thirdActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(hostInput);
    const fourthActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(portWebPathInput);
    const fifthActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(credentialsInput);

    // Add rows to the modal
    modal.addComponents(
      firstActionRow,
      secondActionRow,
      thirdActionRow,
      fourthActionRow,
      fifthActionRow
    );

    // Show the modal
    await interaction.showModal(modal);
  }

  public async handleModalSubmit(
    interaction: ModalSubmitInteraction
  ): Promise<void> {
    const isAddModal = interaction.customId === 'add_server_modal';
    const isEditModal = interaction.customId.startsWith('edit_server_modal_');

    if (!isAddModal && !isEditModal) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      if (isAddModal) {
        await this.handleAddModalSubmit(interaction);
      } else {
        await this.handleEditModalSubmit(interaction);
      }
    } catch (error: any) {
      console.error('Error in modal submission:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription(error.message || 'An unexpected error occurred')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  private async handleAddModalSubmit(
    interaction: ModalSubmitInteraction
  ): Promise<void> {
    try {
      // Get values from modal
      const id = interaction.fields.getTextInputValue('server_id').trim();
      const name = interaction.fields.getTextInputValue('server_name').trim();
      const host = interaction.fields.getTextInputValue('host').trim();
      const portWebPath = interaction.fields
        .getTextInputValue('port_webpath')
        .trim();
      const credentials = interaction.fields
        .getTextInputValue('credentials')
        .trim();

      // Parse port and webBasePath
      const [port, webBasePath = ''] = portWebPath
        .split(',')
        .map((s) => s.trim());
      if (!port) {
        throw new Error(
          'Port is required. Format: port,webpath (e.g., 2053,/panel)'
        );
      }

      // Parse credentials and default inbound
      const credentialsParts = credentials.split(',').map((s) => s.trim());
      if (credentialsParts.length < 2) {
        throw new Error(
          'Username and password are required. Format: username,password or username,password,defaultInboundId'
        );
      }

      const [username, password] = credentialsParts;
      const defaultInboundId =
        credentialsParts.length > 2 && credentialsParts[2]
          ? parseInt(credentialsParts[2])
          : undefined;

      if (!username || !password) {
        throw new Error(
          'Both username and password are required. Format: username,password or username,password,defaultInboundId'
        );
      }

      if (
        defaultInboundId !== undefined &&
        (isNaN(defaultInboundId) || defaultInboundId < 1)
      ) {
        throw new Error('Default inbound ID must be a positive number');
      }

      const guildId = interaction.guildId;
      if (!guildId) {
        throw new Error('This command can only be used in a server');
      }

      // Validate that server ID doesn't already exist
      const existingServer = this.serverManager.getServer(id);
      if (existingServer) {
        throw new Error(`Server with ID '${id}' already exists`);
      }

      // Validate host format
      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        throw new Error('Host must start with http:// or https://');
      }

      // Validate port is a number
      if (isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
        throw new Error('Port must be a valid number between 1 and 65535');
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
        discordServerId: guildId,
        defaultInboundId
      };

      await this.serverManager.addNewServer(serverConfig);

      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Server Added Successfully')
        .addFields(
          { name: 'ID', value: id, inline: true },
          { name: 'Name', value: name, inline: true },
          { name: 'Host', value: host, inline: true },
          { name: 'Port', value: port, inline: true },
          { name: 'Web Path', value: webBasePath || '/', inline: true },
          { name: 'Discord Server', value: guildId, inline: true }
        )
        .setFooter({
          text: 'Server is now available for use with other commands'
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error: any) {
      console.error('Error adding server:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Failed to Add Server')
        .setDescription(error.message || 'An unexpected error occurred')
        .addFields({
          name: 'Tip',
          value:
            'Make sure all fields are filled correctly:\n• Server ID: Unique identifier\n• Host: Include http:// or https://\n• Port,WebPath: e.g., 2053,/panel\n• Username,Password: e.g., admin,mypass'
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  private async handleEditModalSubmit(
    interaction: ModalSubmitInteraction
  ): Promise<void> {
    // Extract server ID from custom ID
    const serverId = interaction.customId.replace('edit_server_modal_', '');

    // Get values from modal
    const name = interaction.fields.getTextInputValue('server_name').trim();
    const host = interaction.fields.getTextInputValue('host').trim();
    const portWebPath = interaction.fields
      .getTextInputValue('port_webpath')
      .trim();
    const credentials = interaction.fields
      .getTextInputValue('credentials')
      .trim();

    // Parse port and webBasePath
    const [port, webBasePath = ''] = portWebPath
      .split(',')
      .map((s) => s.trim());
    if (!port) {
      throw new Error(
        'Port is required. Format: port,webpath (e.g., 2053,/panel)'
      );
    }

    // Parse credentials and default inbound
    const credentialsParts = credentials.split(',').map((s) => s.trim());
    if (credentialsParts.length < 2) {
      throw new Error(
        'Username and password are required. Format: username,password or username,password,defaultInboundId'
      );
    }

    const [username, password] = credentialsParts;
    const defaultInboundId =
      credentialsParts.length > 2 && credentialsParts[2]
        ? parseInt(credentialsParts[2])
        : undefined;

    if (!username || !password) {
      throw new Error(
        'Both username and password are required. Format: username,password or username,password,defaultInboundId'
      );
    }

    if (
      defaultInboundId !== undefined &&
      (isNaN(defaultInboundId) || defaultInboundId < 1)
    ) {
      throw new Error('Default inbound ID must be a positive number');
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      throw new Error('This command can only be used in a server');
    }

    // Validate host format
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      throw new Error('Host must start with http:// or https://');
    }

    // Validate port is a number
    if (isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
      throw new Error('Port must be a valid number between 1 and 65535');
    }

    const updatedConfig: Partial<ServerConfig> = {
      name,
      host,
      port,
      webBasePath,
      username,
      password,
      defaultInboundId
    };

    try {
      await this.serverManager.updateExistingServer(serverId, updatedConfig);

      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Server Updated Successfully')
        .addFields(
          { name: 'ID', value: serverId, inline: true },
          { name: 'Name', value: name, inline: true },
          { name: 'Host', value: host, inline: true },
          { name: 'Port', value: port, inline: true },
          { name: 'Web Path', value: webBasePath || '/', inline: true },
          {
            name: 'Default Inbound',
            value: defaultInboundId ? defaultInboundId.toString() : 'None',
            inline: true
          }
        )
        .setFooter({
          text: 'Server configuration has been updated'
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error: any) {
      console.error('Error updating server:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Failed to Update Server')
        .setDescription(error.message || 'An unexpected error occurred')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  private async handleRemove(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const serverId = interaction.options.getString('server-id', true);
    const discordServerId = interaction.guild?.id;
    if (!discordServerId) {
      throw new Error('This command can only be used in a Discord server');
    }

    const server = this.serverManager.validateServerAccess(
      serverId,
      discordServerId
    );

    if (!server) {
      throw new Error(
        `Server with ID '${serverId}' not found or doesn't belong to this Discord server`
      );
    }

    await this.serverManager.deleteExistingServer(serverId);

    const successEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Server Removed Successfully')
      .addFields(
        { name: 'ID', value: serverId, inline: true },
        { name: 'Name', value: server.name, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  }

  private async handleToggle(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const serverId = interaction.options.getString('server-id', true);
    const active = interaction.options.getBoolean('active', true);
    const discordServerId = interaction.guild?.id;

    if (!discordServerId) {
      throw new Error('This command can only be used in a Discord server');
    }
    const server = this.serverManager.validateServerAccess(
      serverId,
      discordServerId
    );

    if (!server) {
      throw new Error(
        `Server with ID '${serverId}' not found or doesn't belong to this Discord server`
      );
    }

    await this.serverManager.setServerActiveStatus(serverId, active);

    const successEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Server Status Updated')
      .addFields(
        { name: 'ID', value: serverId, inline: true },
        { name: 'Name', value: server.name, inline: true },
        {
          name: 'Status',
          value: active ? '✅ Active' : '❌ Inactive',
          inline: true
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  }

  private async handleRefresh(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const discordServerId = interaction.guild?.id;

    if (!discordServerId) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Failed to refresh servers, unknown Discord server ID')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    await this.serverManager.refreshServersForDiscord(discordServerId);

    const servers =
      this.serverManager.getServersByDiscordIdCached(discordServerId);

    const successEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Servers Refreshed')
      .setDescription(
        `Reloaded ${servers.length} server(s) from database for this Discord server`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  }

  private async handleEdit(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const serverId = interaction.options.getString('server-id', true);
    const guildId = interaction.guildId;

    if (!guildId) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('This command can only be used in a server')
        .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

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

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Create the modal with current values pre-filled
    const modal = new ModalBuilder()
      .setCustomId(`edit_server_modal_${serverId}`)
      .setTitle(`Edit Server: ${serverInfo.name}`);

    // Create text input components with current values
    const serverNameInput = new TextInputBuilder()
      .setCustomId('server_name')
      .setLabel('Server Name')
      .setPlaceholder('e.g., Main Server (US West)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100)
      .setValue(serverInfo.name);

    const hostInput = new TextInputBuilder()
      .setCustomId('host')
      .setLabel('Host (with protocol)')
      .setPlaceholder('e.g., http://192.168.1.100, https://panel.example.com')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200)
      .setValue(serverInfo.host);

    const portWebPathInput = new TextInputBuilder()
      .setCustomId('port_webpath')
      .setLabel('Port and Web Base Path')
      .setPlaceholder('e.g., 2053,/panel or 443,/ or 8080,')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100)
      .setValue(`${serverInfo.port},${serverInfo.webBasePath}`);

    const credentialsInput = new TextInputBuilder()
      .setCustomId('credentials')
      .setLabel('Credentials and Default Inbound')
      .setPlaceholder(
        'username,password,defaultInboundId (e.g., admin,mypass123,1)'
      )
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200)
      .setValue(
        `${serverInfo.username},${serverInfo.password}${serverInfo.defaultInboundId ? `,${serverInfo.defaultInboundId}` : ''}`
      );

    // Create action rows and add inputs
    const firstActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(serverNameInput);
    const secondActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(hostInput);
    const thirdActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(portWebPathInput);
    const fourthActionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(credentialsInput);

    // Add rows to the modal
    modal.addComponents(
      firstActionRow,
      secondActionRow,
      thirdActionRow,
      fourthActionRow
    );

    // Show the modal
    await interaction.showModal(modal);
  }
}
