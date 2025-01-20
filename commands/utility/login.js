const { SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("login")
    .setDescription("Log in to AniList"),
  async execute(interaction) {
    const clientId = process.env.ANILIST_CLIENT_ID;
    const redirect_uri = process.env.ANILIST_REDIRECT_URI;

    // Log the clientId being used
    console.log(`Using AniList Client ID: ${clientId}`);

    const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect_uri}&response_type=code`;

    // Log the generated AniList authorization URL
    console.log(`Generated AniList Authorization URL: ${authUrl}`);

    await interaction.reply(
      `Click [here](${authUrl}) to log in to AniList. After authorizing, enter the provided PIN using /verify <PIN>.`
    );
  },
};
