const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("completed")
    .setDescription("Mark an anime as completed")
    .addStringOption((option) =>
      option
        .setName("anime")
        .setDescription("The title of the anime you want to mark as completed")
        .setRequired(true)
    ),

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
                episodes
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
        await markAsCompleted(animeList[0], token, interaction);
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
          .setPlaceholder("Select the anime you want to mark as completed")
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

          await i.deferUpdate(); // Acknowledge the interaction

          await markAsCompleted(selectedAnime, token, interaction, true);
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
        content: "Failed to mark the anime as completed.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

async function markAsCompleted(anime, token, interaction, editReply = false) {
  const fetch = await import("node-fetch").then((module) => module.default);

  const completedEpisodes = anime.episodes;

  const updateQuery = `
        mutation {
          SaveMediaListEntry(mediaId: ${anime.id}, progress: ${completedEpisodes}, status: COMPLETED) {
            id
            progress
            status
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

  const embed = new EmbedBuilder()
    .setTitle(`Anime Marked as Completed`)
    .setDescription(
      `You have successfully marked "${
        anime.title.english || anime.title.romaji
      }" as completed.`
    )
    .setImage(anime.coverImage.large)
    .setColor("#0099ff");

  if (updateData.data.SaveMediaListEntry.status === "COMPLETED") {
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
    const failureMessage = `Failed to mark "${
      anime.title.english || anime.title.romaji
    }" as completed.`;

    if (editReply) {
      await interaction.editReply({ content: failureMessage, components: [] });
    } else {
      await interaction.reply({ content: failureMessage });
    }
  }
}
