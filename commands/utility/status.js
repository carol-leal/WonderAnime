const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription(
      "Displays the current bot status and AniList connection status."
    ),

  async execute(interaction) {
    let isLoggedIn = false;

    const serverId = interaction.guild.id;
    const token = database.getToken(serverId);

    if (token) {
      isLoggedIn = true;
    }

    const embed = new EmbedBuilder()
      .setTitle("Bot Status")
      .setColor("#00ff00")
      .addFields(
        {
          name: "AniList Connection",
          value: isLoggedIn ? "Connected" : "Not Connected",
        },
        {
          name: "Support",
          value:
            "If you are having trouble with the bot, please contact the owner.",
        }
      )
      .setTimestamp()
      .setFooter({
        text: "Bot Status",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed] });
  },
};
