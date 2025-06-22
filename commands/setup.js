const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Настраивает параметры верификации для сервера.")
    .addRoleOption((option) =>
      option
        .setName("unverified-role")
        .setDescription("Роль для непроверенных пользователей.")
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName("verified-role")
        .setDescription("Роль для проверенных пользователей.")
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Канал для верификации.")
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "Эту команду можно использовать только на сервере.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    const unverifiedRole = interaction.options.getRole("unverified-role");
    const verifiedRole = interaction.options.getRole("verified-role");
    const channel = interaction.options.getChannel("channel");

    if (unverifiedRole === null) {
      return interaction.reply({
        content:
          "Ошибка: Роль 'unverified' не найдена. Пожалуйста, проверьте ID в вашей конфигурации и убедитесь, что роль существует.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (verifiedRole === null) {
      return interaction.reply({
        content:
          "Ошибка: Роль 'verified' не найдена. Пожалуйста, проверьте ID в вашей конфигурации и убедитесь, что роль существует.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (channel === null) {
      return interaction.reply({
        content:
          "Ошибка: Канал 'verification' не найден. Пожалуйста, проверьте ID в вашей конфигурации и убедитесь, что канал существует.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const configPath = path.join(__dirname, "..", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    config.guildId = interaction.guildId;
    config.unverifiedRole = unverifiedRole.id;
    config.verifiedRole = verifiedRole.id;
    config.verificationChannel = channel.id;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const fetchGuildWithRetry = async (
      interaction,
      retries = 3,
      delay = 500
    ) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await interaction.client.guilds.fetch(interaction.guildId);
        } catch (error) {
          if (error.code === 10004 && i < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else if (error.code !== 10004) {
            throw error;
          }
        }
      }
      return null;
    };

    const guild = interaction.guild || (await fetchGuildWithRetry(interaction));

    if (!guild) {
      return interaction.reply({
        content:
          "Я не являюсь участником этого сервера, поэтому не могу выполнить команду настройки.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    try {
      const verificationChannel = await guild.channels.fetch(
        config.verificationChannel
      );

      const embed = new EmbedBuilder()
        .setTitle(`Добро пожаловать на ${guild.name}!`)
        .setDescription(
          "Чтобы получить доступ ко всем каналам, пожалуйста, подтвердите, что вы не робот. Нажмите на кнопку ниже, чтобы начать верификацию."
        )
        .setColor(0x0099ff);

      const button = new ButtonBuilder()
        .setCustomId("start_verification")
        .setLabel("Пройти верификацию")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅");

      const row = new ActionRowBuilder().addComponents(button);

      await verificationChannel.send({ embeds: [embed], components: [row] });

      await interaction.reply({
        content:
          "Настройки успешно сохранены! Сообщение о верификации было отправлено.",
        flags: [MessageFlags.Ephemeral],
      });
    } catch (error) {
      console.error("[ERROR] Could not post verification message.", error);
      await interaction.reply({
        content:
          "Настройки сохранены, но не удалось опубликовать сообщение о верификации. Пожалуйста, проверьте мои разрешения.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  },
};
