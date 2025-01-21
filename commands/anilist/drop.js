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
    .setName("drop")
    .setDescription("Drop a currently watched anime with confirmation"),

  async execute(interaction) {
    const serverId = interaction.guild.id;
    const token = database.getToken(serverId);
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
                                      coverImage {
                                          large
                                      }
                                  }
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
        await confirmDrop(interaction, animeList[0], token);
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
          .setPlaceholder("Select an anime to drop")
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
          content: "Select the anime you want to drop:",
          components: [row],
        });

        const filter = (i) =>
          i.customId === "anime_select" && i.user.id === interaction.user.id;

        const collector = interaction.channel.createMessageComponentCollector({
          filter,
          time: 60000,
        });

        collector.on("collect", async (i) => {
          const selectedIndex = parseInt(i.values[0], 10);
          const selectedAnime = animeList[selectedIndex];
          await confirmDrop(i, selectedAnime, token);
          collector.stop();
        });

        collector.on("end", (collected, reason) => {
          if (reason === "time") {
            interaction.editReply({
              content: "You did not select any anime.",
              components: [],
            });
          }
        });
      }
    } catch (error) {
      console.error(error);
      await interaction.reply("Failed to drop your currently watched anime.");
    }
  },
};

async function confirmDrop(interaction, anime, token) {
  const title = anime.media.title.english || anime.media.title.romaji;
  const posterImage = anime.media.coverImage.large;

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_drop")
      .setLabel("Confirm Drop")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("cancel_drop")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );

  const embed = new EmbedBuilder()
    .setTitle(`Are you sure you want to drop "${title}"?`)
    .setImage(posterImage)
    .setColor("#ff0000");

  await interaction.reply({ embeds: [embed], components: [confirmRow] });

  const filter = (i) =>
    ["confirm_drop", "cancel_drop"].includes(i.customId) &&
    i.user.id === interaction.user.id;

  const collector = interaction.channel.createMessageComponentCollector({
    filter,
    time: 30000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "confirm_drop") {
      const dropQuery = `
              mutation {
                SaveMediaListEntry(mediaId: ${anime.media.id}, status: DROPPED) {
                  id
                  status
                }
              }`;

      const dropResponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: dropQuery }),
      });

      const dropData = await dropResponse.json();

      if (dropData.data.SaveMediaListEntry.status === "DROPPED") {
        await i.update({
          content: `Successfully dropped "${title}".`,
          embeds: [],
          components: [],
        });
      } else {
        await i.update({
          content: `Failed to drop "${title}".`,
          embeds: [],
          components: [],
        });
      }
    } else if (i.customId === "cancel_drop") {
      await i.update({
        content: `Cancelled dropping "${title}".`,
        embeds: [],
        components: [],
      });
    }
    collector.stop();
  });

  collector.on("end", (collected, reason) => {
    if (reason === "time") {
      interaction.editReply({
        content: "Drop action timed out.",
        components: [],
      });
    }
  });
}
