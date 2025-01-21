const database = require("../../database");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("watching")
    .setDescription(
      "Display the list of anime you are currently watching on AniList."
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
                                id
                                title {
                                    english
                                    romaji
                                }
                                coverImage {
                                    large
                                }
                                bannerImage
                                episodes
                                genres
                            }
                            progress
                        }
                    }
                }
            }`;

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

      const watchingList =
        watchingData.data.MediaListCollection.lists[0].entries;

      if (watchingList.length > 1) {
        const options = watchingList.map((entry, index) => {
          const title = entry.media.title.english || entry.media.title.romaji;
          return {
            label: title,
            value: index.toString(),
          };
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("watching_list")
          .setPlaceholder("Select an anime to view details")
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
          content: "Select the anime you want to view details for:",
          components: [row],
        });

        const filter = (i) =>
          i.customId === "watching_list" && i.user.id === interaction.user.id;

        const collector = interaction.channel.createMessageComponentCollector({
          filter,
          time: 60000,
        });

        collector.on("collect", async (i) => {
          const selectedIndex = parseInt(i.values[0], 10);
          const selectedAnime = watchingList[selectedIndex];
          const title =
            selectedAnime.media.title.english ||
            selectedAnime.media.title.romaji;
          const progress = selectedAnime.progress;
          const episodes = selectedAnime.media.episodes;
          const genres = selectedAnime.media.genres.join(", ");
          const bannerImage =
            selectedAnime.media.bannerImage ||
            selectedAnime.media.coverImage.large;

          const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(
              `Currently watching episode ${progress} out of ${episodes}.\n\n**Genres:** ${genres}`
            )
            .setImage(bannerImage)
            .setColor("#0099ff");

          await i.update({ embeds: [embed], components: [] });
        });
        collector.on("end", (collected) => {
          if (collected.size === 0) {
            interaction.editReply({
              content: "You did not select any anime.",
              components: [],
            });
          }
        });
      } else if (watchingList.length === 1) {
        const firstAnime = watchingList[0];
        const title =
          firstAnime.media.title.english || firstAnime.media.title.romaji;
        const progress = firstAnime.progress;
        const episodes = firstAnime.media.episodes;
        const genres = firstAnime.media.genres.join(", ");
        const bannerImage =
          firstAnime.media.bannerImage || firstAnime.media.coverImage.large;

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(
            `Currently watching episode ${progress} out of ${episodes}.\n\n**Genres:** ${genres}`
          )
          .setImage(bannerImage)
          .setColor("#0099ff");

        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply("You are not currently watching any anime.");
      }
    } catch (error) {
      console.error(error);
      await interaction.reply("Failed to fetch your currently watched anime.");
    }
  },
};
