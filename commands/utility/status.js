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

    const application = await interaction.client.application.fetch();
    const botOwnerId = application.owner.id;
    const botInfo = interaction.client.user.username;

    if (token) {
      isLoggedIn = true;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${botInfo} - Status`)
      .setColor("#00ff00")
      .addFields(
        {
          name: "AniList Connection",
          value: isLoggedIn ? "Connected" : "Not Connected",
        },
        {
          name: "Support",
          value: `If you are having trouble with the bot, please contact <@${botOwnerId}>`,
        }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
