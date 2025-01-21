const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Provides information about available commands.")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("The command you want more information about")
        .setRequired(false)
    ),

  async execute(interaction) {
    const commandName = interaction.options.getString("command");
    const commands = interaction.client.commands;

    if (commandName) {
      const command = commands.get(commandName.toLowerCase());

      if (!command) {
        await interaction.reply(`Command \`${commandName}\` not found.`);
        return;
      }

      const detailedInstructions = {
        planning: `
The \`/planning\` command allows you to add an anime to your "Planning" list on AniList.

**Steps to Use:**
1. Make sure you have the required role set up by the bot administrator.
2. Type \`/planning\` and provide the title of the anime you want to add.
3. If the anime is found, you'll be prompted to select the specific anime from a list if there are multiple matches.
4. The bot will check if the selected anime is already in your "Planning" list.
5. If not, it will be added to your list, and you will receive a confirmation message.

**Example:**
\`/planning anime: Fullmetal Alchemist\` will add "Fullmetal Alchemist" to your "Planning" list.
        `,
        update: `
The \`/update\` command allows you to update the progress of an anime you're currently watching on AniList.

**Steps to Use:**
1. Ensure you have the required role set up by the bot administrator.
2. Type \`/update\` and the bot will retrieve your current anime list.
3. If you're watching more than one anime, you'll be prompted to select which anime you want to update.
4. Choose how many episodes you want to mark as watched.
5. The bot will update your progress and confirm the update.

**Example:**
\`/update\` will let you select an anime from your currently watching list and update the episode progress.
        `,
        addwatching: `
The \`/addwatching\` command allows you to add an anime to your "Currently Watching" list on AniList.

**Steps to Use:**
1. Ensure you have the required role set up by the bot administrator.
2. Type \`/addwatching\` and provide the title of the anime you want to add.
3. If the anime is found, you'll be prompted to select the specific anime from a list if there are multiple matches.
4. The bot will check if the selected anime is already in your "Currently Watching" list.
5. If not, it will be added to your list, and you will receive a confirmation message.

**Example:**
\`/addwatching anime: Black Lagoon\` will add "Black Lagoon" to your currently watching list.
        `,
        completed: `
The \`/completed\` command allows you to mark an anime as completed on AniList.

**Steps to Use:**
1. Ensure you have the required role set up by the bot administrator.
2. Type \`/completed\` and provide the title of the anime you want to mark as completed.
3. If the anime is found, you'll be prompted to select the specific anime from a list if there are multiple matches.
4. The bot will update your list and confirm the completion of the anime.

**Example:**
\`/completed anime: Jormungand\` will mark "Jormungand" as completed in your AniList account.
        `,
        drop: `
The \`/drop\` command allows you to drop an anime from your "Currently Watching" list on AniList.

**Steps to Use:**
1. Ensure you have the required role set up by the bot administrator.
2. Type \`/drop\` and the bot will retrieve your current anime list.
3. If you're watching more than one anime, you'll be prompted to select which anime you want to drop.
4. Confirm the drop action when prompted.
5. The bot will update your list and confirm the removal of the anime.

**Example:**
\`/drop\` will let you select an anime from your currently watching list and drop it from your AniList account.
        `,
        watching: `
The \`/watching\` command allows you to view the list of anime you are currently watching on AniList.

**Steps to Use:**
1. Ensure you have the required role set up by the bot administrator.
2. Type \`/watching\` to retrieve and view your current anime list.

**Example:**
\`/watching\` will display the list of anime you are currently watching.
        `,
        login: `
The \`/login\` command allows you to log in to AniList using the bot.

**Steps to Use:**
1. Ensure you have the required role set up by the bot administrator.
2. Type \`/login\` and follow the prompts to log in to your AniList account.

**Example:**
\`/login\` will prompt you to log in to AniList through the bot.
        `,
        logout: `
The \`/logout\` command allows you to log out from AniList.

**Steps to Use:**
1. Ensure you have the required role set up by the bot administrator.
2. Type \`/logout\` to log out from your AniList account.

**Example:**
\`/logout\` will log you out from AniList.
        `,
        watchlist: `
The \`/watchlist\` command allows you to view your watchlist on AniList.

**Steps to Use:**
1. Ensure you have the required role set up by the bot administrator.
2. Type \`/watchlist\` to retrieve and view your watchlist on AniList.

**Example:**
\`/watchlist\` will display your AniList watchlist.
        `,
        progress: `
The \`/progress\` command allows you to track your anime progress on AniList.

**Steps to Use:**
1. Ensure you have the required role set up by the bot administrator.
2. Type \`/progress\` to view your current anime progress.

**Example:**
\`/progress\` will display your progress on currently watched anime.
        `,
        help: `
This is the \`/help\` command, which provides information about available commands.
        `,
      };

      const embed = new EmbedBuilder()
        .setTitle(`Help: /${command.data.name}`)
        .setDescription(command.data.description)
        .setColor("#0099ff")
        .addFields(
          {
            name: "Usage",
            value: `/${command.data.name} ${command.data.options
              .map((option) => `[${option.name}]`)
              .join(" ")}`,
            inline: true,
          },
          {
            name: "Detailed Instructions",
            value:
              detailedInstructions[commandName.toLowerCase()] ||
              "No additional details available.",
          }
        )
        .setTimestamp()
        .setFooter({
          text: "Command Help",
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle("Help: List of Commands")
        .setDescription(
          "Use `/help [command]` to get detailed information on a specific command."
        )
        .setColor("#0099ff")
        .addFields(
          commands.map((command) => ({
            name: `/${command.data.name}`,
            value: command.data.description,
            inline: false,
          }))
        )
        .setTimestamp()
        .setFooter({
          text: "Bot Commands",
          iconURL: interaction.client.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
    }
  },
};
