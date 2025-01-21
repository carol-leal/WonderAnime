const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
require("dotenv").config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Displays information about the bot and its purpose."),

  async execute(interaction) {
    const botInfo = {
      name: interaction.client.user.username,
      purpose:
        "This bot is designed to integrate with AniList, allowing users to manage an anime lists directly from Discord. Features include adding and updating anime, viewing progress, and more.",
      setup:
        "To get started, use the `/login` command to configure the bot with your AniList account. Then, use the `/setup` command to configure the roles that can use the bot.",
      support: `If you encounter any issues, feel free to contact the bot's owner, <@${process.env.DISCORD_BOT_OWNER_ID}>, for assistance.`,
    };

    const embed = new EmbedBuilder()
      .setTitle(`${botInfo.name} - Information`)
      .setColor("#00ff00")
      .addFields(
        { name: "Purpose", value: botInfo.purpose },
        { name: "Support", value: botInfo.support }
      )
      .setTimestamp()
      .setFooter({
        text: "Bot Info",
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.reply({ embeds: [embed] });
  },
};
