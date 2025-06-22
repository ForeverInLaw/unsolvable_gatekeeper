const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Отображает список доступных команд."),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("Помощь по командам")
      .setDescription("Вот список доступных команд:")
      .setColor(0x0099ff)
      .addFields(
        {
          name: "/setup",
          value: "Настраивает параметры верификации для сервера.",
        },
        { name: "/help", value: "Отображает это справочное сообщение." }
      );

    await interaction.reply({
      embeds: [embed],
      flags: [MessageFlags.Ephemeral],
    });
  },
};
