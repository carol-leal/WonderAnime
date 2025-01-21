const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("logout")
    .setDescription("Log out of AniList"),
  async execute(interaction) {
    const serverId = interaction.guild.id;
    const token = database.getToken(serverId);
    const modsRole = database.getRole(interaction.guild.id);

    if (!modsRole) {
      await interaction.reply({
        content:
          "No mod role is set up for this server. Please ask the server administrator to set up the mod role.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      !interaction.member.roles.cache.has(modsRole) &&
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      await interaction.reply({
        content: "You do not have permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
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
