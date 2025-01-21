const database = require("../../database");
const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verify your AniList login with a PIN")
    .addStringOption((option) =>
      option
        .setName("pin")
        .setDescription("The PIN provided by AniList")
        .setRequired(true)
    ),
  async execute(interaction) {
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

    const pin = interaction.options.getString("pin");
    const serverId = interaction.guild.id;
    const userId = interaction.user.id;

    try {
      const fetch = await import("node-fetch").then((module) => module.default);

      const response = await fetch("https://anilist.co/api/v2/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: process.env.ANILIST_CLIENT_ID,
          client_secret: process.env.ANILIST_CLIENT_SECRET,
          redirect_uri: process.env.ANILIST_REDIRECT_URI,
          code: pin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Failed response from AniList:",
          response.status,
          response.statusText
        );
        throw new Error("Failed to verify PIN.");
      }

      const accessToken = data.access_token;

      // Save the token to the database
      database.saveToken(serverId, userId, accessToken);

      await interaction.reply({
        content: "Login successful! Your AniList account is now linked.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("Error during PIN verification:", error);
      await interaction.reply({
        content: "Failed to verify PIN. Please try again.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
