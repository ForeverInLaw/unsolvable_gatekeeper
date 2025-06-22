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
      `[ПРЕДУПРЕЖДЕНИЕ] У команды по пути ${filePath} отсутствует необходимое свойство "data" или "execute".`
    );
  }
}

client.once(Events.ClientReady, () => {
  console.log("Готово!");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    if (command.permissions) {
      if (!interaction.member.permissions.has(command.permissions)) {
        return interaction.reply({
          content: "У вас недостаточно прав для выполнения этой команды.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Произошла ошибка при выполнении этой команды!",
          flags: [MessageFlags.Ephemeral],
        });
      } else {
        await interaction.reply({
          content: "Произошла ошибка при выполнении этой команды!",
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
        .setLabel("Введите код")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(showModalButton);

      await interaction.reply({
        content: "Пожалуйста, пройдите CAPTCHA для верификации.",
        files: [attachment],
        components: [row],
        flags: [MessageFlags.Ephemeral],
      });
    } else if (interaction.customId === "show_captcha_modal") {
      const modal = new ModalBuilder()
        .setCustomId("captcha_modal")
        .setTitle("Верификация");

      const captchaInput = new TextInputBuilder()
        .setCustomId("captcha_input")
        .setLabel("Введите текст с изображения")
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
            content: "Вы успешно прошли верификацию!",
            flags: [MessageFlags.Ephemeral],
          });
        } catch (error) {
          if (error.code === 50013) {
            const errorMessage =
              "Не удалось обновить роли. Пожалуйста, проверьте две вещи: 1) Убедитесь, что у бота есть разрешение «Управлять ролями». 2) В настройках вашего сервера убедитесь, что самая высокая роль бота находится *выше* ролей, которыми ему необходимо управлять.";
            console.error(
              `[ОШИБКА] Отсутствуют разрешения: ${errorMessage} (Пользователь: ${interaction.user.username}, Сервер: ${interaction.guild.name})`
            );
            await interaction.reply({
              content: errorMessage,
              flags: [MessageFlags.Ephemeral],
            });
          } else {
            console.error(
              `Не удалось обновить роли для ${interaction.user.username} на сервере ${interaction.guild.name} во время верификации. Ошибка: ${error.message}`
            );
            await interaction.reply({
              content:
                "Произошла непредвиденная ошибка при обновлении ваших ролей. Пожалуйста, свяжитесь с модератором.",
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
              "Вы провалили верификацию слишком много раз. Пожалуйста, свяжитесь с модератором.",
            flags: [MessageFlags.Ephemeral],
          });
        } else {
          await interaction.reply({
            content: `Неверная CAPTCHA. У вас осталось ${
              3 - attempts
            } попыток.`,
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
      `[ОШИБКА] Роль для не верифицированных с ID ${config.unverifiedRole} не найдена.`
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
        "Не удалось обновить роли. Пожалуйста, проверьте две вещи: 1) Убедитесь, что у бота есть разрешение «Управлять ролями». 2) В настройках вашего сервера убедитесь, что самая высокая роль бота находится *выше* ролей, которыми ему необходимо управлять.";
      console.error(
        `[ОШИБКА] Отсутствуют разрешения: ${errorMessage} (Пользователь: ${member.user.username}, Сервер: ${member.guild.name})`
      );
    } else {
      console.error(
        `Не удалось назначить роль для не верифицированных ${member.user.username} на сервере ${member.guild.name}. Ошибка: ${error.message}`
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
