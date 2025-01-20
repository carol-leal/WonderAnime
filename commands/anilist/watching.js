const database = require("../../database");
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("watching")
    .setDescription(
      "Get the list of anime you're currently watching on AniList."
    ),
  async execute(interaction) {
    const serverId = interaction.guild.id;
    const token = database.getToken(serverId);

    if (!token) {
      await interaction.reply(
        "No AniList account is linked for this server. Use /login to link one."
      );
      return;
    }

    try {
      // Dynamically import node-fetch
      const fetch = await import("node-fetch").then((module) => module.default);

      // Step 1: Fetch the authenticated user's ID
      const viewerQuery = `
        query {
          Viewer {
            id
            name
          }
        }
      `;

      const viewerResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: viewerQuery }),
      });

      const viewerData = await viewerResponse.json();
      console.log(
        "AniList Viewer response:",
        JSON.stringify(viewerData, null, 2)
      );

      if (viewerData.errors) {
        console.error("AniList Viewer errors:", viewerData.errors);
        await interaction.reply(
          "Failed to fetch your AniList user information. Please try logging in again."
        );
        return;
      }

      // Step 2: Fetch the list of anime the user is currently watching
      const watchingQuery = `
        query ($userId: Int) {
          MediaListCollection(userId: $userId, type: ANIME, status: CURRENT) {
            lists {
              name
              entries {
                media {
                  title {
                    romaji
                    english
                  }
                }
              }
            }
          }
        }
      `;

      const watchingResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: watchingQuery,
          variables: { userId: viewerData.data.Viewer.id },
        }),
      });

      const watchingData = await watchingResponse.json();
      console.log(
        "AniList Watching response:",
        JSON.stringify(watchingData, null, 2)
      );

      if (watchingData.errors) {
        console.error("AniList Watching errors:", watchingData.errors);
        await interaction.reply(
          "Failed to fetch your watching list. Please try again later."
        );
        return;
      }

      const watchingList = watchingData.data.MediaListCollection.lists.flatMap(
        (list) => list.entries.map((entry) => entry.media.title.romaji)
      );

      await interaction.reply(
        `You are currently watching: ${watchingList.join(", ")}`
      );
    } catch (error) {
      console.error(error);
      await interaction.reply(
        "There was an error fetching your watching list."
      );
    }
  },
};
