require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const { generateCaptcha } = require("./utils/captcha.js");
const config = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const captchaResponses = new Map();
const attemptCounters = new Map();

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

client.once(Events.ClientReady, () => {
  console.log("Ready!");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "There was an error while executing this command!",
          flags: [MessageFlags.Ephemeral],
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this command!",
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === "start_verification") {
      const { image, text } = generateCaptcha();
      captchaResponses.set(interaction.user.id, text);

      const attachment = new AttachmentBuilder(image, {
        name: "captcha.png",
      });

      const showModalButton = new ButtonBuilder()
        .setCustomId("show_captcha_modal")
        .setLabel("Enter Code")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(showModalButton);

      await interaction.reply({
        content: "Please complete the CAPTCHA to verify.",
        files: [attachment],
        components: [row],
        flags: [MessageFlags.Ephemeral],
      });
    } else if (interaction.customId === "show_captcha_modal") {
      const modal = new ModalBuilder()
        .setCustomId("captcha_modal")
        .setTitle("Verification");

      const captchaInput = new TextInputBuilder()
        .setCustomId("captcha_input")
        .setLabel("Enter the text from the image")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(captchaInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === "captcha_modal") {
      const userAnswer = interaction.fields.getTextInputValue("captcha_input");
      const correctAnswer = captchaResponses.get(interaction.user.id);
      const userId = interaction.user.id;

      if (userAnswer.toUpperCase() === correctAnswer) {
        captchaResponses.delete(userId);
        attemptCounters.delete(userId);

        const guild = interaction.guild;
        const member = await guild.members.fetch(userId);
        const verifiedRole = guild.roles.cache.get(config.verifiedRole);
        const unverifiedRole = guild.roles.cache.get(config.unverifiedRole);

        try {
          if (verifiedRole && !member.roles.cache.has(verifiedRole.id)) {
            await member.roles.add(verifiedRole);
          }
          if (unverifiedRole) await member.roles.remove(unverifiedRole);

          await interaction.reply({
            content: "You have been successfully verified!",
            flags: [MessageFlags.Ephemeral],
          });
        } catch (error) {
          if (error.code === 50013) {
            const errorMessage =
              "Failed to update roles. Please check two things: 1) Ensure the bot has the 'Manage Roles' permission. 2) In your Server Settings, make sure the bot's highest role is positioned *above* the roles it needs to manage.";
            console.error(
              `[ERROR] Missing Permissions: ${errorMessage} (User: ${interaction.user.username}, Guild: ${interaction.guild.name})`
            );
            await interaction.reply({
              content: errorMessage,
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            console.error(
              `Failed to update roles for ${interaction.user.username} in ${interaction.guild.name} during verification. Error: ${error.message}`
            );
            await interaction.reply({
              content:
                "An unexpected error occurred while updating your roles. Please contact a moderator.",
              flags: [MessageFlags.Ephemeral],
            });
          }
        }
      } else {
        let attempts = attemptCounters.get(userId) || 0;
        attempts++;
        attemptCounters.set(userId, attempts);

        if (attempts >= 3) {
          attemptCounters.delete(userId);
          captchaResponses.delete(userId);
          await interaction.reply({
            content:
              "You have failed verification too many times. Please contact a moderator.",
            flags: [MessageFlags.Ephemeral],
          });
        } else {
          await interaction.reply({
            content: `Incorrect CAPTCHA. You have ${
              3 - attempts
            } attempts remaining.`,
            flags: [MessageFlags.Ephemeral],
          });
        }
      }
    }
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== config.guildId) return;

  const unverifiedRole = member.guild.roles.cache.get(config.unverifiedRole);
  if (!unverifiedRole) {
    console.error(
      `[ERROR] Unverified role with ID ${config.unverifiedRole} not found.`
    );
    return;
  }

  try {
    if (!member.roles.cache.has(unverifiedRole.id)) {
      await member.roles.add(unverifiedRole);
    }
  } catch (error) {
    if (error.code === 50013) {
      const errorMessage =
        "Failed to update roles. Please check two things: 1) Ensure the bot has the 'Manage Roles' permission. 2) In your Server Settings, make sure the bot's highest role is positioned *above* the roles it needs to manage.";
      console.error(
        `[ERROR] Missing Permissions: ${errorMessage} (User: ${member.user.username}, Guild: ${member.guild.name})`
      );
    } else {
      console.error(
        `Failed to assign unverified role to ${member.user.username} in ${member.guild.name}. Error: ${error.message}`
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
