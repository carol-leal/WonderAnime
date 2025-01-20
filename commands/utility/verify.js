const database = require("../../database");
const { SlashCommandBuilder } = require("discord.js");

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
    console.log("Starting /verify command");

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
      console.log("AniList response data:", data);

      if (!response.ok) {
        console.error(
          "Failed response from AniList:",
          response.status,
          response.statusText
        );
        throw new Error("Failed to verify PIN.");
      }

      const accessToken = data.access_token;
      console.log("Access token retrieved:", accessToken);

      // Save the token to the database
      database.saveToken(serverId, userId, accessToken);
      console.log(
        `Access token saved for server ${serverId} by user ${userId}`
      );

      await interaction.reply(
        "Login successful! Your AniList account is now linked."
      );
    } catch (error) {
      console.error("Error during PIN verification:", error);
      await interaction.reply("Failed to verify PIN. Please try again.");
    }
  },
};
