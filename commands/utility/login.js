const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionsBitField,
} = require("discord.js");
require("dotenv").config();
database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("login")
    .setDescription("Log in to AniList"),
  async execute(interaction) {
    const clientId = process.env.ANILIST_CLIENT_ID;
    const redirect_uri = process.env.ANILIST_REDIRECT_URI;
    const modsRole = database.getRole(interaction.guild.id);
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      ) ||
      !modsRole
    ) {
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

    const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect_uri}&response_type=code`;

    await interaction.reply({
      content: `Click [here](${authUrl}) to log in to AniList. After authorizing, enter the provided PIN using /verify <PIN>.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
