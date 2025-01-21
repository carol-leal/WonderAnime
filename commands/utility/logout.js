const { SlashCommandBuilder } = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("logout")
    .setDescription("Log out of AniList"),
  async execute(interaction) {
    const serverId = interaction.guild.id;
    const token = database.getToken(serverId);

    if (!token) {
      await interaction.reply(
        "No AniList account is linked for this server. Use /login to link one."
      );
      return;
    }

    database.removeToken(serverId);
    await interaction.reply("Successfully logged out of AniList.");
  },
};
