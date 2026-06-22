/**
 * TOURNAMENT PLUGIN
 * Manages tournaments, brackets, and match scheduling
 */

const BasePlugin = require('./base-plugin');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class TournamentPlugin extends BasePlugin {
  constructor(client) {
    super(client);
    this.name = 'Tournament';
    this.version = '1.0.0';
    this.description = 'Tournament and competition management';
  }

  /**
   * Create tournament
   */
  async createTournament(guildId, tournamentName, type, maxTeams) {
    try {
      const tournament = {
        guildId,
        name: tournamentName,
        type, // solo, duo, squad, scrim, qualifier, finals
        maxTeams,
        status: 'draft', // draft, registration, live, completed
        teams: [],
        brackets: [],
        matches: [],
        createdAt: new Date().toISOString(),
        startDate: null,
        endDate: null,
      };

      const tournamentId = await firebase.push(`servers/${guildId}/tournaments`, tournament);
      Logger.info(`Created tournament: ${tournamentId}`);
      return tournamentId;
    } catch (error) {
      Logger.error('Failed to create tournament:', error);
      return null;
    }
  }

  /**
   * Get tournament
   */
  async getTournament(guildId, tournamentId) {
    try {
      return await firebase.get(`servers/${guildId}/tournaments/${tournamentId}`);
    } catch (error) {
      Logger.error('Failed to get tournament:', error);
      return null;
    }
  }

  /**
   * Register team for tournament
   */
  async registerTeam(guildId, tournamentId, teamName, members) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);
      if (!tournament) return false;

      if (tournament.teams.length >= tournament.maxTeams) {
        Logger.warn('Tournament is full');
        return false;
      }

      const team = {
        name: teamName,
        members,
        registeredAt: new Date().toISOString(),
        status: 'active',
      };

      tournament.teams.push(team);
      await firebase.update(`servers/${guildId}/tournaments/${tournamentId}`, tournament);
      Logger.info(`Registered team: ${teamName}`);
      return true;
    } catch (error) {
      Logger.error('Failed to register team:', error);
      return false;
    }
  }

  /**
   * Create match
   */
  async createMatch(guildId, tournamentId, team1, team2, scheduledTime) {
    try {
      const match = {
        tournamentId,
        team1,
        team2,
        status: 'scheduled', // scheduled, live, completed
        scheduledTime,
        result: null,
        createdAt: new Date().toISOString(),
      };

      const matchId = await firebase.push(`servers/${guildId}/matches`, match);
      Logger.info(`Created match: ${matchId}`);
      return matchId;
    } catch (error) {
      Logger.error('Failed to create match:', error);
      return null;
    }
  }

  /**
   * Update match result
   */
  async updateMatchResult(guildId, matchId, winner, score1, score2) {
    try {
      await firebase.update(`servers/${guildId}/matches/${matchId}`, {
        status: 'completed',
        result: {
          winner,
          score1,
          score2,
          completedAt: new Date().toISOString(),
        },
      });

      Logger.info(`Updated match result: ${matchId}`);
      return true;
    } catch (error) {
      Logger.error('Failed to update match result:', error);
      return false;
    }
  }

  /**
   * Get tournament bracket
   */
  async getTournamentBracket(guildId, tournamentId) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);
      if (!tournament) return null;

      return {
        name: tournament.name,
        type: tournament.type,
        teams: tournament.teams,
        matches: tournament.matches,
        status: tournament.status,
      };
    } catch (error) {
      Logger.error('Failed to get bracket:', error);
      return null;
    }
  }

  /**
   * Get all tournaments for guild
   */
  async getGuildTournaments(guildId, status = null) {
    try {
      const tournaments = await firebase.get(`servers/${guildId}/tournaments`);
      if (!tournaments) return [];

      let result = Object.entries(tournaments).map(([id, tournament]) => ({
        id,
        ...tournament,
      }));

      if (status) {
        result = result.filter(t => t.status === status);
      }

      return result;
    } catch (error) {
      Logger.error('Failed to get tournaments:', error);
      return [];
    }
  }

  /**
   * Get leaderboard for tournament
   */
  async getTournamentLeaderboard(guildId, tournamentId) {
    try {
      const tournament = await this.getTournament(guildId, tournamentId);
      if (!tournament) return [];

      // Sort teams by points
      const leaderboard = tournament.teams
        .map(team => ({
          ...team,
          points: this.calculateTeamPoints(tournament, team.name),
        }))
        .sort((a, b) => b.points - a.points);

      return leaderboard;
    } catch (error) {
      Logger.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  /**
   * Calculate team points based on wins
   */
  calculateTeamPoints(tournament, teamName) {
    let points = 0;

    tournament.matches?.forEach(match => {
      if (match.result?.winner === teamName) {
        points += 3; // 3 points for win
      } else if (match.result?.team1 === teamName || match.result?.team2 === teamName) {
        points += 1; // 1 point for participation
      }
    });

    return points;
  }
}

module.exports = TournamentPlugin;
