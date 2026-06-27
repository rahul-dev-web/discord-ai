/**
 * TOURNAMENT COMMANDS
 * Create and manage tournaments
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require('discord.js');
const Logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('Tournament management commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new tournament')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('Tournament name')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Tournament type')
            .addChoices(
              { name: 'Solo', value: 'solo' },
              { name: 'Duo', value: 'duo' },
              { name: 'Squad', value: 'squad' },
              { name: 'Scrim', value: 'scrim' },
              { name: 'Qualifier', value: 'qualifier' },
              { name: 'Finals', value: 'finals' }
            )
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('max_teams')
            .setDescription('Maximum teams allowed')
            .setRequired(true)
            .setMinValue(2)
            .setMaxValue(256)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('bracket')
        .setDescription('View tournament bracket')
        .addStringOption(option =>
          option
            .setName('tournament_id')
            .setDescription('Tournament ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('View tournament leaderboard')
        .addStringOption(option =>
          option
            .setName('tournament_id')
            .setDescription('Tournament ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all tournaments')
        .addStringOption(option =>
          option
            .setName('status')
            .setDescription('Filter by status')
            .addChoices(
              { name: 'Draft', value: 'draft' },
              { name: 'Active', value: 'registration' },
              { name: 'Live', value: 'live' },
              { name: 'Completed', value: 'completed' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('match')
        .setDescription('Manage tournament matches')
        .addStringOption(option =>
          option
            .setName('action')
            .setDescription('Match action')
            .addChoices(
              { name: '➕ Create Match', value: 'create' },
              { name: '🎯 Set Result', value: 'result' },
              { name: '📋 List Matches', value: 'list' }
            )
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('tournament_id')
            .setDescription('Tournament ID')
        )
        .addStringOption(option =>
          option
            .setName('team1')
            .setDescription('Team 1 ID/name')
        )
        .addStringOption(option =>
          option
            .setName('team2')
            .setDescription('Team 2 ID/name')
        )
        .addIntegerOption(option =>
          option
            .setName('team1_score')
            .setDescription('Team 1 score')
            .setMinValue(0)
        )
        .addIntegerOption(option =>
          option
            .setName('team2_score')
            .setDescription('Team 2 score')
            .setMinValue(0)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const tournamentPlugin = client.plugins.get('Tournament');

    if (!tournamentPlugin) {
      return await interaction.reply({
        content: '❌ Tournament plugin is not loaded!',
        ephemeral: true,
      });
    }

    try {
      if (subcommand === 'create') {
        await handleCreate(interaction, client, tournamentPlugin);
      } else if (subcommand === 'bracket') {
        await handleBracket(interaction, client, tournamentPlugin);
      } else if (subcommand === 'leaderboard') {
        await handleLeaderboard(interaction, client, tournamentPlugin);
      } else if (subcommand === 'list') {
        await handleList(interaction, client, tournamentPlugin);
      } else if (subcommand === 'match') {
        await handleMatch(interaction, client, tournamentPlugin);
      }
    } catch (error) {
      Logger.error('Tournament command error:', error);
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

async function handleCreate(interaction, client, tournamentPlugin) {
  const name = interaction.options.getString('name');
  const type = interaction.options.getString('type');
  const maxTeams = interaction.options.getInteger('max_teams');

  // Check permissions
  const canCreate = await client.engines.permission.canPerformAction(
    interaction.member,
    'create_tournament',
    'high'
  );

  if (!canCreate) {
    return await interaction.reply({
      content: '❌ You don\'t have permission to create tournaments!',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const tournamentId = await tournamentPlugin.createTournament(
    interaction.guildId,
    name,
    type,
    maxTeams
  );

  if (!tournamentId) {
    return await interaction.editReply('❌ Failed to create tournament');
  }

  const embed = new EmbedBuilder()
    .setColor('#ff6600')
    .setTitle('🎮 Tournament Created')
    .addFields(
      { name: 'Name', value: name, inline: true },
      { name: 'Type', value: type.toUpperCase(), inline: true },
      { name: 'Max Teams', value: maxTeams.toString(), inline: true },
      { name: 'Tournament ID', value: tournamentId, inline: false },
      { name: 'Status', value: 'Draft', inline: true }
    );

  await interaction.editReply({ embeds: [embed] });

  // Log to audit
  await client.engines.security.logAction(
    interaction.guildId,
    interaction.user.id,
    'tournament_created',
    'success',
    { name, type, maxTeams, tournamentId }
  );
}

async function handleBracket(interaction, client, tournamentPlugin) {
  const tournamentId = interaction.options.getString('tournament_id');

  await interaction.deferReply();

  const bracket = await tournamentPlugin.getTournamentBracket(interaction.guildId, tournamentId);

  if (!bracket) {
    return await interaction.editReply('❌ Tournament not found!');
  }

  const embed = new EmbedBuilder()
    .setColor('#ff6600')
    .setTitle(`🏆 ${bracket.name} Bracket`)
    .addFields(
      { name: 'Type', value: bracket.type, inline: true },
      { name: 'Teams', value: bracket.teams.length.toString(), inline: true },
      { name: 'Status', value: bracket.status, inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleLeaderboard(interaction, client, tournamentPlugin) {
  const tournamentId = interaction.options.getString('tournament_id');

  await interaction.deferReply();

  const leaderboard = await tournamentPlugin.getTournamentLeaderboard(
    interaction.guildId,
    tournamentId
  );

  if (!leaderboard || leaderboard.length === 0) {
    return await interaction.editReply('❌ Tournament not found or no teams registered!');
  }

  let leaderboardText = '';
  leaderboard.slice(0, 10).forEach((team, index) => {
    leaderboardText += `${index + 1}. **${team.name}** - ${team.points} points\n`;
  });

  const embed = new EmbedBuilder()
    .setColor('#ffd700')
    .setTitle('🏅 Tournament Leaderboard')
    .setDescription(leaderboardText || 'No teams yet')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction, client, tournamentPlugin) {
  const status = interaction.options.getString('status');

  await interaction.deferReply();

  const tournaments = await tournamentPlugin.getGuildTournaments(interaction.guildId, status);

  if (!tournaments || tournaments.length === 0) {
    return await interaction.editReply('❌ No tournaments found!');
  }

  let tournamentsText = '';
  tournaments.slice(0, 10).forEach(tournament => {
    tournamentsText += `**${tournament.name}** (${tournament.type}) - ${tournament.teams.length}/${tournament.maxTeams} teams\n`;
  });

  const embed = new EmbedBuilder()
    .setColor('#ff6600')
    .setTitle('🎮 Tournaments')
    .setDescription(tournamentsText)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleMatch(interaction, client, tournamentPlugin) {
  const action = interaction.options.getString('action');
  const tournamentId = interaction.options.getString('tournament_id');

  await interaction.deferReply();

  const matchManager = client.services?.matchManager;
  if (!matchManager) {
    return await interaction.editReply('❌ Match manager not available');
  }

  try {
    switch (action) {
      case 'create': {
        const team1 = interaction.options.getString('team1');
        const team2 = interaction.options.getString('team2');

        if (!team1 || !team2) {
          return await interaction.editReply('❌ Both teams are required!');
        }

        const match = await matchManager.createMatch(
          interaction.guildId,
          tournamentId,
          { team1, team2 }
        );

        const embed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('✅ Match Created')
          .addFields(
            { name: 'Team 1', value: team1, inline: true },
            { name: 'Team 2', value: team2, inline: true },
            { name: 'Match ID', value: match.id || 'N/A', inline: false },
            { name: 'Status', value: 'Scheduled', inline: true }
          )
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

      case 'result': {
        const team1Score = interaction.options.getInteger('team1_score');
        const team2Score = interaction.options.getInteger('team2_score');

        if (team1Score === null || team2Score === null) {
          return await interaction.editReply('❌ Both scores are required!');
        }

        const result = await matchManager.setMatchResult(
          interaction.guildId,
          tournamentId,
          { team1Score, team2Score }
        );

        const winner = team1Score > team2Score ? 'Team 1' : team1Score < team2Score ? 'Team 2' : 'Draw';

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Match Result Set')
          .addFields(
            { name: 'Team 1', value: `${team1Score} points`, inline: true },
            { name: 'Team 2', value: `${team2Score} points`, inline: true },
            { name: 'Winner', value: winner, inline: false }
          )
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

      case 'list': {
        const matches = await matchManager.getMatches(interaction.guildId, tournamentId);

        if (!matches || matches.length === 0) {
          return await interaction.editReply('❌ No matches found!');
        }

        const embed = new EmbedBuilder()
          .setColor('#7289DA')
          .setTitle('📋 Tournament Matches')
          .setDescription(`Found ${matches.length} match(es)`)
          .setTimestamp();

        matches.slice(0, 10).forEach((match, i) => {
          const team1Name = match.team1 || 'Team 1';
          const team2Name = match.team2 || 'Team 2';
          const score = match.team1Score !== undefined && match.team2Score !== undefined
            ? `${match.team1Score} - ${match.team2Score}`
            : 'Pending';

          embed.addFields({
            name: `Match ${i + 1}`,
            value: `${team1Name} vs ${team2Name}\n**Score**: ${score}`,
            inline: false
          });
        });

        return await interaction.editReply({ embeds: [embed] });
      }

      default:
        return await interaction.editReply('❌ Unknown match action');
    }
  } catch (error) {
    Logger.error('Match handler error:', error);
    return await interaction.editReply(`❌ Error: ${error.message}`);
  }
}