/**
 * TOURNAMENT ENGINE - Phase 16
 * Complete tournament management system
 * 
 * Features:
 * - Tournament creation from templates
 * - Lifecycle management
 * - Team and bracket management
 * - Result tracking
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class TournamentEngine {
  constructor(client, database) {
    this.client = client;
    this.db = database;

    // Tournament templates
    this.templates = {
      solo: {
        name: 'Solo Championship',
        teamSize: 1,
        format: 'single_elimination',
        maxTeams: 32,
        description: '1v1 championship tournament',
      },
      duo: {
        name: 'Duo Tournament',
        teamSize: 2,
        format: 'double_elimination',
        maxTeams: 16,
        description: '2v2 team tournament',
      },
      squad: {
        name: 'Squad Championship',
        teamSize: 5,
        format: 'single_elimination',
        maxTeams: 16,
        description: '5v5 squad tournament',
      },
      scrim: {
        name: 'Scrim (Practice)',
        teamSize: 5,
        format: 'round_robin',
        maxTeams: 8,
        description: 'Practice scrimmage matches',
      },
      qualifier: {
        name: 'Qualifier',
        teamSize: 5,
        format: 'multi_round',
        maxTeams: 32,
        description: 'Multi-round qualifier tournament',
      },
      finals: {
        name: 'Grand Finals',
        teamSize: 5,
        format: 'best_of',
        maxTeams: 2,
        description: 'Grand finals - Best of 3/5',
      },
    };

    // Bracket formats
    this.formats = {
      single_elimination: 'Single Elimination',
      double_elimination: 'Double Elimination',
      round_robin: 'Round Robin',
      multi_round: 'Multi Round',
      best_of: 'Best Of Series',
    };

    Logger.success('✅ TournamentEngine initialized (Phase 16)');
  }

  /**
   * Create a new tournament
   */
  async createTournament(guildId, options = {}) {
    try {
      const {
        name,
        templateName,
        maxTeams,
        createdBy,
        description,
      } = options;

      // Validate template
      if (!this.templates[templateName]) {
        return { success: false, error: 'Invalid template' };
      }

      const template = this.templates[templateName];

      // Create tournament ID
      const tournamentId = `TOURNAMENT-${Date.now()}`;
      const timestamp = new Date().toISOString();

      // Create tournament object
      const tournament = {
        id: tournamentId,
        name: name || template.name,
        templateName,
        type: template.teamSize,
        format: template.format,
        status: 'created', // created, setup, registration, active, completed, cancelled
        
        createdBy,
        createdAt: timestamp,
        startedAt: null,
        completedAt: null,
        
        settings: {
          maxTeams: maxTeams || template.maxTeams,
          autoStart: true,
          autoSchedule: true,
          requireVerification: true,
          allowSubstitutions: true,
          autoAnnounce: true,
        },
        
        description: description || template.description,
        
        // Data structures
        teams: {},
        bracket: {
          rounds: [],
          currentRound: 0,
          totalRounds: 0,
        },
        leaderboard: {
          standings: [],
        },
        announcements: {
          created: false,
          started: false,
          nextMatch: false,
          resultsPosted: false,
          completed: false,
        },
        channels: {
          categoryId: null,
          matchesChannelId: null,
          resultsChannelId: null,
          leaderboardChannelId: null,
          announcementChannelId: null,
        },
        roles: {
          ownerId: null,
          adminId: null,
          participantId: null,
        },
      };

      // Save to database
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      Logger.info(`🏆 Tournament created: ${tournamentId}`);

      return {
        success: true,
        tournamentId,
        tournament,
      };
    } catch (error) {
      Logger.error('Tournament creation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get tournament by ID
   */
  async getTournament(guildId, tournamentId) {
    try {
      const tournament = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}`
      );

      return tournament || null;
    } catch (error) {
      Logger.error('Get tournament error:', error);
      return null;
    }
  }

  /**
   * List all tournaments
   */
  async listTournaments(guildId, filters = {}) {
    try {
      const tournaments = await firebase.get(
        `servers/${guildId}/tournaments`
      ) || {};

      let results = Object.values(tournaments);

      // Apply filters
      if (filters.status) {
        results = results.filter(t => t.status === filters.status);
      }

      if (filters.templateName) {
        results = results.filter(t => t.templateName === filters.templateName);
      }

      // Sort by created date (newest first)
      results.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      return results;
    } catch (error) {
      Logger.error('List tournaments error:', error);
      return [];
    }
  }

  /**
   * Register team in tournament
   */
  async registerTeam(guildId, tournamentId, teamData) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);

      if (!tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      if (tournament.status !== 'registration' && tournament.status !== 'created') {
        return { success: false, error: 'Tournament not accepting registrations' };
      }

      if (Object.keys(tournament.teams).length >= tournament.settings.maxTeams) {
        return { success: false, error: 'Tournament is full' };
      }

      const {
        teamName,
        captain,
        members,
      } = teamData;

      // Validate team size
      if (members.length !== tournament.type) {
        return {
          success: false,
          error: `Team size must be ${tournament.type}`,
        };
      }

      // Create team ID
      const teamId = `TEAM-${Date.now()}`;

      const team = {
        id: teamId,
        name: teamName,
        captain,
        members,
        joinedAt: new Date().toISOString(),
        status: 'registered',
        currentPoints: 0,
        placement: null,
        wins: 0,
        losses: 0,
        played: 0,
      };

      // Add team to tournament
      tournament.teams[teamId] = team;

      // Update tournament
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      // Log event
      await firebase.set(
        `servers/${guildId}/logs/tournament_team_registered_${teamId}`,
        {
          timestamp: new Date().toISOString(),
          tournamentId,
          teamId,
          teamName,
          captain,
        }
      );

      Logger.info(`✅ Team registered: ${teamName} in ${tournamentId}`);

      return {
        success: true,
        teamId,
        team,
      };
    } catch (error) {
      Logger.error('Team registration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start tournament (begin registration period)
   */
  async startTournament(guildId, tournamentId) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);

      if (!tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      if (tournament.status !== 'created') {
        return { success: false, error: 'Tournament already started' };
      }

      tournament.status = 'registration';
      tournament.startedAt = new Date().toISOString();

      // Update database
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      Logger.info(`🏆 Tournament started: ${tournamentId}`);

      return { success: true, tournament };
    } catch (error) {
      Logger.error('Start tournament error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Begin tournament (close registration, generate bracket)
   */
  async beginTournament(guildId, tournamentId) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);

      if (!tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      if (tournament.status !== 'registration') {
        return { success: false, error: 'Tournament not in registration phase' };
      }

      // Check minimum teams
      if (Object.keys(tournament.teams).length < 2) {
        return { success: false, error: 'Minimum 2 teams required' };
      }

      // Generate bracket
      tournament.bracket = await this.generateBracket(
        tournament.format,
        Object.values(tournament.teams)
      );

      tournament.status = 'active';

      // Update database
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      Logger.info(`🎮 Tournament began: ${tournamentId}`);

      return { success: true, tournament };
    } catch (error) {
      Logger.error('Begin tournament error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate bracket based on format
   */
  async generateBracket(format, teams) {
    try {
      const bracket = {
        rounds: [],
        currentRound: 1,
        totalRounds: 0,
      };

      switch (format) {
        case 'single_elimination':
          return this.generateSingleElimination(teams, bracket);

        case 'double_elimination':
          return this.generateDoubleElimination(teams, bracket);

        case 'round_robin':
          return this.generateRoundRobin(teams, bracket);

        default:
          return bracket;
      }
    } catch (error) {
      Logger.error('Bracket generation error:', error);
      return { rounds: [], currentRound: 0, totalRounds: 0 };
    }
  }

  /**
   * Generate single elimination bracket
   */
  generateSingleElimination(teams, bracket) {
    // Shuffle teams for random seeding
    const shuffled = [...teams].sort(() => Math.random() - 0.5);

    // Calculate number of rounds
    const totalRounds = Math.ceil(Math.log2(shuffled.length));
    bracket.totalRounds = totalRounds;

    // Create first round matches
    const round1 = {
      roundNumber: 1,
      matches: [],
    };

    for (let i = 0; i < shuffled.length; i += 2) {
      const match = {
        matchId: `MATCH-${Date.now()}-${i}`,
        team1: shuffled[i],
        team2: shuffled[i + 1] || null,
        scheduledAt: null,
        status: 'pending',
        winner: null,
        score1: 0,
        score2: 0,
        channelId: null,
        verifiedBy: null,
        verifiedAt: null,
      };

      round1.matches.push(match);
    }

    bracket.rounds.push(round1);

    return bracket;
  }

  /**
   * Generate double elimination bracket
   */
  generateDoubleElimination(teams, bracket) {
    // Similar to single elimination but creates two brackets
    const winners = this.generateSingleElimination(teams, { rounds: [], currentRound: 1, totalRounds: 0 });

    // Create losers bracket
    const losersRound = {
      roundNumber: 1,
      bracket: 'losers',
      matches: [],
    };

    bracket.rounds.push(...winners.rounds);
    bracket.rounds.push(losersRound);
    bracket.totalRounds = Math.ceil(Math.log2(teams.length)) * 2;

    return bracket;
  }

  /**
   * Generate round robin bracket
   */
  generateRoundRobin(teams, bracket) {
    const rounds = [];
    const totalTeams = teams.length;

    // Calculate number of rounds needed for round robin
    const totalRounds = totalTeams - 1;
    bracket.totalRounds = totalRounds;

    for (let round = 1; round <= totalRounds; round++) {
      const matches = [];

      for (let i = 0; i < totalTeams / 2; i++) {
        const team1Index = (round + i) % totalTeams;
        const team2Index = (round + totalTeams - 1 - i) % totalTeams;

        const match = {
          matchId: `MATCH-${round}-${i}`,
          team1: teams[team1Index],
          team2: teams[team2Index],
          scheduledAt: null,
          status: 'pending',
          winner: null,
          score1: 0,
          score2: 0,
        };

        matches.push(match);
      }

      rounds.push({
        roundNumber: round,
        matches,
      });
    }

    bracket.rounds = rounds;

    return bracket;
  }

  /**
   * Report match result
   */
  async reportMatchResult(guildId, tournamentId, matchId, result) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);

      if (!tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      const {
        winnerTeamId,
        score1,
        score2,
        reportedBy,
      } = result;

      // Find and update match
      let found = false;

      for (const round of tournament.bracket.rounds) {
        for (const match of round.matches) {
          if (match.matchId === matchId) {
            match.winner = winnerTeamId;
            match.score1 = score1;
            match.score2 = score2;
            match.status = 'pending_verification';
            match.reportedBy = reportedBy;
            match.reportedAt = new Date().toISOString();
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        return { success: false, error: 'Match not found' };
      }

      // Update tournament
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      Logger.info(`📊 Match result reported: ${matchId}`);

      return { success: true, tournament };
    } catch (error) {
      Logger.error('Report result error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify match result (admin)
   */
  async verifyMatchResult(guildId, tournamentId, matchId, verifiedBy) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);

      if (!tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      // Find and verify match
      let found = false;

      for (const round of tournament.bracket.rounds) {
        for (const match of round.matches) {
          if (match.matchId === matchId) {
            if (match.status !== 'pending_verification') {
              return { success: false, error: 'Match not pending verification' };
            }

            match.status = 'completed';
            match.verifiedBy = verifiedBy;
            match.verifiedAt = new Date().toISOString();

            // Update team records
            const winner = tournament.teams[match.winner.id];
            if (winner) {
              winner.wins++;
              winner.played++;
              winner.currentPoints += 100;
            }

            const loserTeamId = match.team1.id === match.winner.id 
              ? match.team2.id 
              : match.team1.id;
            const loser = tournament.teams[loserTeamId];
            if (loser) {
              loser.losses++;
              loser.played++;
            }

            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        return { success: false, error: 'Match not found' };
      }

      // Update leaderboard
      tournament.leaderboard.standings = this.calculateStandings(tournament.teams);

      // Update tournament
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      Logger.info(`✅ Match verified: ${matchId}`);

      return { success: true, tournament };
    } catch (error) {
      Logger.error('Verify result error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate standings/leaderboard
   */
  calculateStandings(teams) {
    const standings = Object.values(teams)
      .map(team => ({
        placement: 0,
        teamId: team.id,
        teamName: team.name,
        points: team.currentPoints,
        wins: team.wins,
        losses: team.losses,
        played: team.played,
      }))
      .sort((a, b) => {
        // Sort by points (descending), then by wins (descending)
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return b.wins - a.wins;
      })
      .map((standing, index) => ({
        ...standing,
        placement: index + 1,
      }));

    return standings;
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(guildId, tournamentId) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);

      if (!tournament) {
        return null;
      }

      return tournament.leaderboard.standings;
    } catch (error) {
      Logger.error('Get leaderboard error:', error);
      return null;
    }
  }

  /**
   * Complete tournament
   */
  async completeTournament(guildId, tournamentId) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);

      if (!tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      tournament.status = 'completed';
      tournament.completedAt = new Date().toISOString();

      // Calculate final placements
      tournament.leaderboard.standings = this.calculateStandings(tournament.teams);

      // Update teams with final placements
      for (const standing of tournament.leaderboard.standings) {
        const team = tournament.teams[standing.teamId];
        if (team) {
          team.placement = standing.placement;
        }
      }

      // Update database
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      Logger.info(`🏆 Tournament completed: ${tournamentId}`);

      return { success: true, tournament };
    } catch (error) {
      Logger.error('Complete tournament error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel tournament
   */
  async cancelTournament(guildId, tournamentId, reason = '') {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);

      if (!tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      tournament.status = 'cancelled';
      tournament.cancelledAt = new Date().toISOString();
      tournament.cancellationReason = reason;

      // Update database
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      Logger.info(`❌ Tournament cancelled: ${tournamentId}`);

      return { success: true, tournament };
    } catch (error) {
      Logger.error('Cancel tournament error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get tournament statistics
   */
  async getTournamentStats(guildId, tournamentId) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);

      if (!tournament) {
        return null;
      }

      const totalMatches = tournament.bracket.rounds.reduce(
        (sum, round) => sum + round.matches.length,
        0
      );

      const completedMatches = tournament.bracket.rounds.reduce(
        (sum, round) =>
          sum + round.matches.filter(m => m.status === 'completed').length,
        0
      );

      return {
        tournamentId: tournament.id,
        name: tournament.name,
        status: tournament.status,
        totalTeams: Object.keys(tournament.teams).length,
        totalMatches,
        completedMatches,
        pendingMatches: totalMatches - completedMatches,
        currentRound: tournament.bracket.currentRound,
        totalRounds: tournament.bracket.totalRounds,
      };
    } catch (error) {
      Logger.error('Get tournament stats error:', error);
      return null;
    }
  }

  /**
   * Get available templates
   */
  getTemplates() {
    return this.templates;
  }

  /**
   * Get available formats
   */
  getFormats() {
    return this.formats;
  }
}

module.exports = TournamentEngine;
