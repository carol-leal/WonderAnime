const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("progress")
    .setDescription("Show your progress across all anime lists"),

  async execute(interaction) {
    const serverId = interaction.guild.id;
    const token = database.getToken(serverId);

    if (!token) {
      await interaction.reply({
        content:
          "No AniList account is linked for this server. Use /login to link one.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    try {
      const fetch = await import("node-fetch").then((module) => module.default);
      const viewerQuery = `
        query {
            Viewer {
                id
                name
            }
        }`;

      const viewerResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: viewerQuery }),
      });

      const viewerData = await viewerResponse.json();
      const username = viewerData.data.Viewer.name;

      if (!username) {
        await interaction.reply("Failed to retrieve AniList username.");
        return;
      }

      const animeQuery = `
        query {
          MediaListCollection(userName: "${username}", type: ANIME) {
            lists {
              name
              entries {
                status
              }
            }
          }
        }`;

      const animeResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: animeQuery,
          variables: { userId: viewerData.data.Viewer.id },
        }),
      });

      const animeData = await animeResponse.json();

      if (
        !animeData ||
        !animeData.data ||
        !animeData.data.MediaListCollection ||
        !animeData.data.MediaListCollection.lists
      ) {
        await interaction.reply("No anime list found or an error occurred.");
        return;
      }

      const lists = animeData.data.MediaListCollection.lists;

      let completedCount = 0;
      let watchingCount = 0;
      let droppedCount = 0;
      let planningCount = 0;

      for (const list of lists) {
        if (list.name === "Completed") {
          completedCount = list.entries.length;
        } else if (list.name === "Watching" || list.name === "Current") {
          watchingCount = list.entries.length;
        } else if (list.name === "Dropped") {
          droppedCount = list.entries.length;
        } else if (list.name === "Planning") {
          planningCount = list.entries.length;
        }
      }

      const totalAnime =
        completedCount + watchingCount + droppedCount + planningCount;
      const progressPercentage = (
        ((completedCount + watchingCount + droppedCount) / totalAnime) *
        100
      ).toFixed(2);

      const botAvatarUrl = interaction.client.user.displayAvatarURL();

      const embed = new EmbedBuilder()
        .setTitle("Your Anime Progress")
        .setDescription(
          `You have:\n\n` +
            `**Watched:** ${completedCount} anime\n` +
            `**Watching:** ${watchingCount} anime\n` +
            `**Dropped:** ${droppedCount} anime\n` +
            `**Planning to Watch:** ${planningCount} anime\n\n` +
            `**Overall Progress:** ${progressPercentage}%`
        )
        .setColor("#0099ff")
        .setAuthor({ name: "AniList Bot", iconURL: botAvatarUrl })
        .setTimestamp()
        .setFooter({ text: "Powered by AniList", iconURL: botAvatarUrl });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply("Failed to fetch your anime progress.");
    }
  },
};
