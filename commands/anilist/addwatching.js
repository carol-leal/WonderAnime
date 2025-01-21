const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionsBitField,
} = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("add_to_watching")
    .setDescription("Add an anime to your currently watching list")
    .addStringOption((option) =>
      option
        .setName("anime")
        .setDescription("The title of the anime you want to add")
        .setRequired(true)
    ),

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
      await interaction.reply({
        content:
          "No AniList account is linked for this server. Use /login to link one.",
        flags: MessageFlags.Ephemeral,
      });
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
          flags: MessageFlags.Ephemeral,
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

        const cancelButton = new ButtonBuilder()
          .setCustomId("cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const cancelRow = new ActionRowBuilder().addComponents(cancelButton);

        await interaction.reply({
          content: "Multiple results found. Please select the anime:",
          components: [row, cancelRow],
        });

        const filter = (i) =>
          i.customId === "anime_select" || i.customId === "cancel";

        const collector = interaction.channel.createMessageComponentCollector({
          filter,
          time: 60000,
        });

        collector.on("collect", async (i) => {
          if (i.customId === "cancel") {
            await i.update({
              content: "Action canceled.",
              components: [],
            });
            collector.stop();
            return;
          }

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

          await processAnimeSelection(selectedAnime, token, i, true);
          collector.stop();
        });

        collector.on("end", (collected, reason) => {
          if (reason === "time") {
            interaction.editReply({
              content: "You did not select any anime in time.",
              components: [],
              flags: MessageFlags.Ephemeral,
            });
          }
        });
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "Failed to add the anime to your currently watching list.",
        flags: MessageFlags.Ephemeral,
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
          flags: MessageFlags.Ephemeral,
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
          MediaListCollection(userName: $userName, status: CURRENT, type: ANIME) {
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

    const currentList =
      listData.data?.MediaListCollection?.lists?.[0]?.entries || [];

    // Check if the anime is already in the currently watching list
    const animeExistsInWatchlist = currentList.some(
      (entry) => entry.media.id === anime.id
    );

    if (animeExistsInWatchlist) {
      if (!editReply) {
        await interaction.reply({
          content: `You are already watching "${
            anime.title.english || anime.title.romaji
          }".`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.editReply({
          content: `You are already watching "${
            anime.title.english || anime.title.romaji
          }".`,
          components: [],
        });
      }
      return;
    }

    await addToWatchingList(anime, token, interaction, editReply);
  } catch (error) {
    console.error("Error processing anime selection:", error);
    if (!editReply) {
      await interaction.reply({
        content: "Failed to process your anime selection.",
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({
        content: "Failed to process your anime selection.",
        components: [],
      });
    }
  }
}

async function addToWatchingList(anime, token, interaction, editReply = false) {
  const fetch = await import("node-fetch").then((module) => module.default);

  const addQuery = `
      mutation {
        SaveMediaListEntry(mediaId: ${anime.id}, status: CURRENT) {
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
      .setTitle(`Added to Watching List`)
      .setDescription(
        `You have successfully added "${
          anime.title.english || anime.title.romaji
        }" to your currently watching list.`
      )
      .setImage(anime.coverImage.large)
      .setColor("#0099ff");

    if (addData.data.SaveMediaListEntry.status === "CURRENT") {
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
      }" to your watching list.`;

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
    console.error("Error adding anime to watching list:", error);
    const failureMessage = `An error occurred while adding "${
      anime.title.english || anime.title.romaji
    }" to your watching list.`;

    if (editReply) {
      await interaction.editReply({ content: failureMessage, components: [] });
    } else {
      await interaction.reply({ content: failureMessage });
    }
  }
}
