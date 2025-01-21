const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField,
} = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("planning")
    .setDescription("Add an anime to your Planning to Watch list")
    .addStringOption((option) =>
      option
        .setName("anime")
        .setDescription("The title of the anime you want to add")
        .setRequired(true)
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
      const animeTitle = interaction.options.getString("anime");

      const searchQuery = `
          query($search: String) {
            Page(perPage: 10) {
              media(search: $search, type: ANIME) {
                id
                title {
                  english
                  romaji
                }
                coverImage {
                  large
                }
              }
            }
          }`;

      const searchResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          variables: { search: animeTitle },
        }),
      });

      const searchData = await searchResponse.json();
      const animeList = searchData.data.Page.media;

      if (!animeList.length) {
        await interaction.reply({
          content: "Anime not found. Please check the title and try again.",
          ephemeral: true,
        });
        return;
      }

      if (animeList.length === 1) {
        await processAnimeSelection(animeList[0], token, interaction);
      } else {
        const options = animeList.map((anime) => {
          const title = anime.title.english || anime.title.romaji;
          return {
            label: title,
            value: anime.id.toString(),
          };
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("anime_select")
          .setPlaceholder("Select the anime you want to add")
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
          content: "Multiple results found. Please select the anime:",
          components: [row],
        });

        const filter = (i) =>
          i.customId === "anime_select" && i.user.id === interaction.user.id;

        const collector = interaction.channel.createMessageComponentCollector({
          filter,
          time: 60000,
        });

        collector.on("collect", async (i) => {
          const selectedId = parseInt(i.values[0], 10);
          const selectedAnime = animeList.find(
            (anime) => anime.id === selectedId
          );

          if (!selectedAnime) {
            await i.update({
              content: "Selected anime not found. Please try again.",
              components: [],
            });
            return;
          }

          await i.deferUpdate(); // Acknowledge the interaction

          await processAnimeSelection(selectedAnime, token, i, true); // Pass 'true' to indicate we want to edit the original message
          collector.stop();
        });

        collector.on("end", (collected, reason) => {
          if (reason === "time") {
            interaction.editReply({
              content: "You did not select any anime in time.",
              components: [],
            });
          }
        });
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "Failed to add the anime to your Planning to Watch list.",
        ephemeral: true,
      });
    }
  },
};

async function processAnimeSelection(
  anime,
  token,
  interaction,
  editReply = false
) {
  const fetch = await import("node-fetch").then((module) => module.default);

  const viewerQuery = `
        query {
          Viewer {
            id
            name
          }
        }`;

  try {
    const viewerResponse = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: viewerQuery }),
    });

    const viewerData = await viewerResponse.json();

    const userName = viewerData.data?.Viewer?.name;

    if (!userName) {
      if (!editReply) {
        await interaction.reply({
          content:
            "Failed to retrieve AniList username. Please make sure the bot is logged in.",
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content:
            "Failed to retrieve AniList username. Please make sure the bot is logged in.",
          components: [],
        });
      }
      return;
    }

    const listQuery = `
          query($userName: String) {
            MediaListCollection(userName: $userName, status: PLANNING, type: ANIME) {
              lists {
                name
                entries {
                  media {
                    id
                    title {
                      english
                      romaji
                    }
                  }
                }
              }
            }
          }`;

    const listResponse = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: listQuery, variables: { userName } }),
    });

    const listData = await listResponse.json();

    const planningList =
      listData.data?.MediaListCollection?.lists?.[0]?.entries || [];

    // Check if the anime is already in the planning list
    const animeExistsInPlanning = planningList.some(
      (entry) => entry.media.id === anime.id
    );

    if (animeExistsInPlanning) {
      if (!editReply) {
        await interaction.reply({
          content: `This anime "${
            anime.title.english || anime.title.romaji
          }" is already in your Planning to Watch list.`,
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content: `This anime "${
            anime.title.english || anime.title.romaji
          }" is already in your Planning to Watch list.`,
          components: [],
        });
      }
      return;
    }

    await addToPlanningList(anime, token, interaction, editReply);
  } catch (error) {
    console.error("Error processing anime selection:", error);
    if (!editReply) {
      await interaction.reply({
        content: "Failed to process your anime selection.",
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        content: "Failed to process your anime selection.",
        components: [],
      });
    }
  }
}

async function addToPlanningList(anime, token, interaction, editReply = false) {
  const fetch = await import("node-fetch").then((module) => module.default);

  const addQuery = `
        mutation {
          SaveMediaListEntry(mediaId: ${anime.id}, status: PLANNING) {
            id
            status
          }
        }`;

  try {
    const addResponse = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: addQuery }),
    });

    const addData = await addResponse.json();

    const embed = new EmbedBuilder()
      .setTitle(`Added to Planning to Watch List`)
      .setDescription(
        `You have successfully added "${
          anime.title.english || anime.title.romaji
        }" to your Planning to Watch list.`
      )
      .setImage(anime.coverImage.large)
      .setColor("#0099ff");

    if (addData.data.SaveMediaListEntry.status === "PLANNING") {
      if (editReply) {
        await interaction.editReply({
          content: null,
          embeds: [embed],
          components: [],
        });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
    } else {
      const failureMessage = `Failed to add "${
        anime.title.english || anime.title.romaji
      }" to your Planning to Watch list.`;

      if (editReply) {
        await interaction.editReply({
          content: failureMessage,
          components: [],
        });
      } else {
        await interaction.reply({ content: failureMessage });
      }
    }
  } catch (error) {
    console.error("Error adding anime to Planning to Watch list:", error);
    const failureMessage = `An error occurred while adding "${
      anime.title.english || anime.title.romaji
    }" to your Planning to Watch list.`;

    if (editReply) {
      await interaction.editReply({ content: failureMessage, components: [] });
    } else {
      await interaction.reply({ content: failureMessage });
    }
  }
}
