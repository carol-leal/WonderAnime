const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");
const database = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Setup the role ID that can use bot commands")
    .addStringOption((option) =>
      option
        .setName("modsroleid")
        .setDescription(
          "The ID of the role that can use commands that modify your AniList account"
        )
        .setRequired(true)
    ),

  async execute(interaction) {
    // Ensure the user has Administrator permissions
    if (
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

    const modsRoleId = interaction.options.getString("modsroleid");
    const modsRole = interaction.guild.roles.cache.get(modsRoleId);

    if (!modsRole) {
      await interaction.reply({
        content: "The role ID provided is invalid. Please check and try again.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    database.setRole(interaction.guild.id, modsRoleId);

    await interaction.reply({
      content: `The role has been successfully set up.\nMod commands role: **${modsRole.name}**.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
