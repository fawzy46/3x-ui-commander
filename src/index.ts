import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { MultiServerManager } from './api/MultiServerManager';
import { AddClientCommand } from './commands/AddClientCommand';
import { UpdateClientCommand } from './commands/UpdateClientCommand';
import { GetClientTrafficCommand } from './commands/GetClientTrafficCommand';
import { ListServersCommand } from './commands/ListServersCommand';
import { ListInboundsCommand } from './commands/ListInboundsCommand';
import { ManageServersCommand } from './commands/ManageServersCommand';

config();

interface Command {
  data: any;
  execute: (interaction: any) => Promise<void>;
}

class XUIBot {
  private client: Client;
  private commands: Collection<string, Command>;
  private serverManager: MultiServerManager;
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
      ]
    });

    this.commands = new Collection();
    this.serverManager = new MultiServerManager();
    
    this.setupEventHandlers();
  }

  private async initializeBot() {
    console.log('🚀 Initializing 3x-ui Discord Bot...');
    
    // Initialize the server manager with database
    await this.serverManager.initialize();
    
    // Setup commands after server manager is initialized
    this.setupCommands();
    
    console.log('✅ Bot initialization completed');
  }

  private setupCommands() {
    const commands = [
      new AddClientCommand(this.serverManager),
      new UpdateClientCommand(this.serverManager),
      new GetClientTrafficCommand(this.serverManager),
      new ListServersCommand(this.serverManager),
      new ListInboundsCommand(this.serverManager),
      new ManageServersCommand(this.serverManager)
    ];

    commands.forEach(command => {
      this.commands.set(command.data.name, command);
    });
  }
  private setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`✅ Bot is ready! Logged in as ${this.client.user?.tag}`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          const command = this.commands.get(interaction.commandName);
          if (!command) return;

          await command.execute(interaction);
        } else if (interaction.isModalSubmit()) {
          // Handle modal submissions
          if (interaction.customId === 'add_server_modal') {
            const manageServersCommand = this.commands.get('manage-servers') as any;
            if (manageServersCommand && manageServersCommand.handleModalSubmit) {
              await manageServersCommand.handleModalSubmit(interaction);
            }
          }
        }
      } catch (error) {
        console.error('Error handling interaction:', error);
        
        const errorMessage = 'There was an error while processing this interaction!';
        
        if (interaction.isChatInputCommand()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        } else if (interaction.isModalSubmit()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
      }
    });
  }
  public async start() {
    try {
      // Initialize the bot with database
      await this.initializeBot();
      
      // Register slash commands
      await this.registerCommands();
      
      // Start the bot
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      console.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private async registerCommands() {
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
      throw new Error('Missing DISCORD_TOKEN or CLIENT_ID in environment variables');
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    const commandsData = Array.from(this.commands.values()).map(command => command.data.toJSON());
    console.log('Registering commands:', commandsData);

    try {
      console.log('Started refreshing application (/) commands.');

      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commandsData },
      );

      console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error('Error registering commands:', error);
      throw error;
    }
  }
}

// Start the bot
const bot = new XUIBot();
bot.start().catch(console.error);
