const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("watchlist")
    .setDescription(
      "Display your pending watchlist, with an option to filter by movies or TV shows."
    )
    .addStringOption((option) =>
      option
        .setName("filter")
        .setDescription("Filter by either movies or tv shows")
        .setRequired(false)
        .addChoices(
          { name: "Movies", value: "movies" },
          { name: "TV Shows", value: "tv" }
        )
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
    const fetch = await import("node-fetch").then((module) => module.default);

    const filter = interaction.options.getString("filter");

    const viewerQuery = `
        query {
            Viewer {
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
      const username = viewerData.data.Viewer.name;
      const profileUrl = `https://anilist.co/user/${username}`;

      if (!username) {
        await interaction.reply("Failed to retrieve AniList username.");
        return;
      }

      const animeQuery = `
            query {
                MediaListCollection(userName: "${username}", type: ANIME, status: PLANNING) {
                    lists {
                        name
                        entries {
                            media {
                                id
                                title {
                                    english
                                    romaji
                                }
                                format
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
        await interaction.reply("No pending anime found or an error occurred.");
        return;
      }

      const animeList = animeData.data.MediaListCollection.lists[0].entries;

      if (animeList.length > 0) {
        const groupedAnime = {
          TV: [],
          MOVIE: [],
        };
        const tooManyMessage = `\n**Too many anime! Check [your AniList profile](${profileUrl}) for more info.**`;
        let tooManyAnime = false;

        animeList.forEach((entry) => {
          const title = entry.media.title.english || entry.media.title.romaji;
          const format = entry.media.format;
          const shortUrl = `https://anilist.co/anime/${entry.media.id}`;

          const animeEntry = `**[${title}](${shortUrl})**`;

          if (format === "MOVIE") {
            groupedAnime.MOVIE.push(animeEntry);
          } else {
            groupedAnime.TV.push(animeEntry);
          }
        });

        Object.keys(groupedAnime).forEach((key) => {
          if (groupedAnime[key]) {
            groupedAnime[key].sort();
          }
        });

        let description = "";

        if (!filter || filter === "tv") {
          if (groupedAnime.TV.length > 0) {
            const sectionContent = groupedAnime.TV.join("\n") + "\n";
            if (
              description.length +
                sectionContent.length +
                tooManyMessage.length >
              4096
            ) {
              tooManyAnime = true;
            } else {
              description += `**TV Shows:**\n` + sectionContent + "\n";
            }
          }
        }

        if (!filter || filter === "movies") {
          if (groupedAnime.MOVIE.length > 0) {
            const sectionContent = groupedAnime.MOVIE.join("\n") + "\n";
            if (
              description.length +
                sectionContent.length +
                tooManyMessage.length >
              4096
            ) {
              tooManyAnime = true;
            } else {
              description += `**Movies:**\n` + sectionContent + "\n";
            }
          }
        }

        if (tooManyAnime) {
          description += tooManyMessage;
        }

        const embed = new EmbedBuilder()
          .setTitle(`${username}'s Pending Anime`)
          .setDescription(description)
          .setColor("#0099ff");

        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply("You have no anime in your pending watchlist.");
      }
    } catch (error) {
      console.error(error);
      await interaction.reply("Failed to fetch your watchlist.");
    }
  },
};
