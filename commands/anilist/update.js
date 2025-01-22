const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionsBitField,
} = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("update")
    .setDescription("Update the currently watched episode for an anime."),

  async execute(interaction) {
    const serverId = interaction.guild.id;
    const token = database.getToken(serverId);
    const modsRole = database.getRole(interaction.guild.id);
    const adminRole = interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );
    if (!adminRole && !modsRole) {
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
      const fetch = await import("node-fetch").then((module) => module.default);

      const viewerQuery = `
              query {
                  Viewer {
                      name
                  }
              }`;

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
      const username = viewerData.data.Viewer.name;

      if (!username) {
        await interaction.reply("Failed to retrieve AniList username.");
        return;
      }

      const animeQuery = `
                  query {
                      MediaListCollection(userName: "${username}", type: ANIME, status: CURRENT) {
                          lists {
                              name
                              entries {
                                  media {
                                      id
                                      title {
                                          english
                                          romaji
                                      }
                                      episodes
                                      coverImage {
                                          large
                                      }
                                  }
                                  progress
                              }
                          }
                      }
                  }`;

      const animeResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: animeQuery }),
      });

      const animeData = await animeResponse.json();

      if (
        !animeData ||
        !animeData.data ||
        !animeData.data.MediaListCollection ||
        !animeData.data.MediaListCollection.lists
      ) {
        await interaction.reply(
          "No currently watched anime found or an error occurred."
        );
        return;
      }

      const animeList = animeData.data.MediaListCollection.lists[0].entries;

      if (animeList.length === 0) {
        await interaction.reply("You are not currently watching any anime.");
        return;
      } else if (animeList.length === 1) {
        const selectedAnime = animeList[0];
        const title =
          selectedAnime.media.title.english || selectedAnime.media.title.romaji;
        const currentProgress = selectedAnime.progress;
        const maxEpisodes = selectedAnime.media.episodes;
        const posterImage = selectedAnime.media.coverImage.large;

        const updateRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("add_1")
            .setLabel("+1 Episode")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("add_2")
            .setLabel("+2 Episodes")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("add_3")
            .setLabel("+3 Episodes")
            .setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(
            `Current progress: ${currentProgress} out of ${maxEpisodes} episodes.`
          )
          .setImage(posterImage)
          .setColor("#0099ff");

        await interaction.reply({ embeds: [embed], components: [updateRow] });

        const updateFilter = (buttonInteraction) => {
          return (
            ["add_1", "add_2", "add_3"].includes(buttonInteraction.customId) &&
            buttonInteraction.user.id === interaction.user.id
          );
        };

        const buttonCollector =
          interaction.channel.createMessageComponentCollector({
            filter: updateFilter,
            time: 30000,
          });

        buttonCollector.on("collect", async (buttonInteraction) => {
          let episodesToAdd = 0;
          switch (buttonInteraction.customId) {
            case "add_1":
              episodesToAdd = 1;
              break;
            case "add_2":
              episodesToAdd = 2;
              break;
            case "add_3":
              episodesToAdd = 3;
              break;
          }

          const newProgress = Math.min(
            currentProgress + episodesToAdd,
            maxEpisodes
          );

          const updateQuery = `
                  mutation {
                    SaveMediaListEntry(mediaId: ${selectedAnime.media.id}, progress: ${newProgress}) {
                      id
                      progress
                    }
                  }`;

          const updateResponse = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ query: updateQuery }),
          });

          const updateData = await updateResponse.json();

          if (
            !updateData ||
            !updateData.data ||
            !updateData.data.SaveMediaListEntry
          ) {
            await buttonInteraction.update({
              content: "Failed to update the progress.",
              components: [],
            });
            return;
          }

          const updatedEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(
              `Updated progress: ${newProgress} out of ${maxEpisodes} episodes.`
            )
            .setImage(posterImage)
            .setColor("#0099ff");

          await buttonInteraction.update({
            embeds: [updatedEmbed],
            components: [],
          });

          buttonCollector.stop();
        });

        buttonCollector.on("end", (collected, reason) => {
          if (reason === "time") {
            interaction.editReply({
              content: "No episode updates were made in time.",
              components: [],
            });
          }
        });
      } else {
        const options = animeList.map((entry, index) => {
          const title = entry.media.title.english || entry.media.title.romaji;
          return {
            label: title,
            value: index.toString(),
          };
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("anime_select")
          .setPlaceholder("Select an anime to update")
          .addOptions(options);

        const cancelButton = new ButtonBuilder()
          .setCustomId("cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const cancelRow = new ActionRowBuilder().addComponents(cancelButton);

        await interaction.reply({
          content: "Select the anime you want to update the episode count for:",
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

          const selectedIndex = parseInt(i.values[0], 10);
          const selectedAnime = animeList[selectedIndex];
          const title =
            selectedAnime.media.title.english ||
            selectedAnime.media.title.romaji;
          const currentProgress = selectedAnime.progress;
          const maxEpisodes = selectedAnime.media.episodes;
          const posterImage = selectedAnime.media.coverImage.large;

          const updateRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("add_1")
              .setLabel("+1 Episode")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("add_2")
              .setLabel("+2 Episodes")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("add_3")
              .setLabel("+3 Episodes")
              .setStyle(ButtonStyle.Primary)
          );

          const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(
              `Current progress: ${currentProgress} out of ${maxEpisodes} episodes.`
            )
            .setImage(posterImage)
            .setColor("#0099ff");

          await i.update({ embeds: [embed], components: [updateRow] });

          const updateFilter = (buttonInteraction) => {
            return (
              ["add_1", "add_2", "add_3"].includes(
                buttonInteraction.customId
              ) && buttonInteraction.user.id === interaction.user.id
            );
          };

          const buttonCollector = i.channel.createMessageComponentCollector({
            filter: updateFilter,
            time: 30000,
          });

          buttonCollector.on("collect", async (buttonInteraction) => {
            let episodesToAdd = 0;
            switch (buttonInteraction.customId) {
              case "add_1":
                episodesToAdd = 1;
                break;
              case "add_2":
                episodesToAdd = 2;
                break;
              case "add_3":
                episodesToAdd = 3;
                break;
            }

            const newProgress = Math.min(
              currentProgress + episodesToAdd,
              maxEpisodes
            );

            const updateQuery = `
                    mutation {
                      SaveMediaListEntry(mediaId: ${selectedAnime.media.id}, progress: ${newProgress}) {
                        id
                        progress
                      }
                    }`;

            const updateResponse = await fetch("https://graphql.anilist.co", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ query: updateQuery }),
            });

            const updateData = await updateResponse.json();

            if (
              !updateData ||
              !updateData.data ||
              !updateData.data.SaveMediaListEntry
            ) {
              await buttonInteraction.update({
                content: "Failed to update the progress.",
                components: [],
              });
              return;
            }

            const updatedEmbed = new EmbedBuilder()
              .setTitle(title)
              .setDescription(
                `Updated progress: ${newProgress} out of ${maxEpisodes} episodes.`
              )
              .setImage(posterImage)
              .setColor("#0099ff");

            await buttonInteraction.update({
              embeds: [updatedEmbed],
              components: [],
            });

            buttonCollector.stop();
          });

          buttonCollector.on("end", (collected, reason) => {
            if (reason === "time") {
              interaction.editReply({
                content: "No episode updates were made in time.",
                components: [],
              });
            }
          });

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
      await interaction.reply("Failed to update your currently watched anime.");
    }
  },
};
