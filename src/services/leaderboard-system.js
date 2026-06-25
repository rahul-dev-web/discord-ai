/**
 * LEADERBOARD SYSTEM - Phase 16
 * Live rankings, statistics, and standings calculation
 * 
 * Features:
 * - Live leaderboard updates
 * - Statistics aggregation
 * - Ranking calculation
 * - Historical tracking
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class LeaderboardSystem {
  constructor(client, database) {
    this.client = client;
    this.db = database;

    // Scoring systems
    this.scoringSystems = {
      winner_takes_all: {
        name: 'Winner Takes All',
        description: 'Winner gets points, loser gets none',
      },
      placement_based: {
        name: 'Placement Based',
        description: 'Points based on final placement',
      },
      points_per_kill: {
        name: 'Points Per Kill',
        description: 'Points awarded for kills in match',
      },
      custom: {
        name: 'Custom',
        description: 'Custom scoring system',
      },
    };

    // Default points structure
    this.defaultPoints = {
      1: 100,  // 1st place
      2: 75,   // 2nd place
      3: 50,   // 3rd place
      4: 25,   // 4th place
      5: 10,   // 5th place
    };
  }

  /**
   * Initialize leaderboard for tournament
   */
  async initializeLeaderboard(guildId, tournamentId, teams) {
    try {
      const standings = teams.map((team, index) => ({
        placement: index + 1,
        teamId: team.id,
        teamName: team.name,
        points: 0,
        wins: 0,
        losses: 0,
        matches: 0,
        winRate: 0,
        lastUpdated: new Date().toISOString(),
      }));

      const leaderboard = {
        tournamentId,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        standings,
        scoringSystem: 'placement_based',
      };

      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}/leaderboard`,
        leaderboard
      );

      Logger.info(`📊 Leaderboard initialized for ${tournamentId}`);

      return leaderboard;
    } catch (error) {
      Logger.error('Initialize leaderboard error:', error);
      return null;
    }
  }

  /**
   * Update leaderboard after match completion
   */
  async updateAfterMatch(guildId, tournamentId, matchResult) {
    try {
      const leaderboardPath = `servers/${guildId}/tournaments/${tournamentId}/leaderboard`;
      const leaderboard = await firebase.get(leaderboardPath);

      if (!leaderboard) {
        return { success: false, error: 'Leaderboard not found' };
      }

      const { winnerTeamId, loserTeamId, score1, score2 } = matchResult;

      // Find teams in standings
      let winnerStanding = leaderboard.standings.find(
        s => s.teamId === winnerTeamId
      );
      let loserStanding = leaderboard.standings.find(
        s => s.teamId === loserTeamId
      );

      if (!winnerStanding || !loserStanding) {
        return { success: false, error: 'Teams not found in leaderboard' };
      }

      // Update winner
      winnerStanding.wins++;
      winnerStanding.matches++;
      winnerStanding.points += 100;

      // Update loser
      loserStanding.losses++;
      loserStanding.matches++;
      loserStanding.points += 25;

      // Calculate win rates
      winnerStanding.winRate =
        (winnerStanding.wins / winnerStanding.matches) * 100;
      loserStanding.winRate =
        (loserStanding.wins / loserStanding.matches) * 100;

      // Re-sort standings
      leaderboard.standings.sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return b.wins - a.wins;
      });

      // Update placements
      leaderboard.standings.forEach((standing, index) => {
        standing.placement = index + 1;
      });

      leaderboard.lastUpdated = new Date().toISOString();

      // Save updated leaderboard
      await firebase.set(leaderboardPath, leaderboard);

      // Log leaderboard update
      await this.logLeaderboardUpdate(guildId, tournamentId, {
        matchResult,
        newStandings: leaderboard.standings,
      });

      Logger.info(`📊 Leaderboard updated for ${tournamentId}`);

      return { success: true, leaderboard };
    } catch (error) {
      Logger.error('Update leaderboard error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current leaderboard
   */
  async getLeaderboard(guildId, tournamentId, limit = 50) {
    try {
      const leaderboard = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/leaderboard`
      );

      if (!leaderboard) {
        return null;
      }

      // Return top N teams
      return {
        ...leaderboard,
        standings: leaderboard.standings.slice(0, limit),
      };
    } catch (error) {
      Logger.error('Get leaderboard error:', error);
      return null;
    }
  }

  /**
   * Get team ranking
   */
  async getTeamRanking(guildId, tournamentId, teamId) {
    try {
      const leaderboard = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/leaderboard`
      );

      if (!leaderboard) {
        return null;
      }

      const teamRanking = leaderboard.standings.find(
        s => s.teamId === teamId
      );

      return teamRanking || null;
    } catch (error) {
      Logger.error('Get team ranking error:', error);
      return null;
    }
  }

  /**
   * Get team statistics
   */
  async getTeamStats(guildId, tournamentId, teamId) {
    try {
      const leaderboard = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/leaderboard`
      );

      if (!leaderboard) {
        return null;
      }

      const teamData = leaderboard.standings.find(s => s.teamId === teamId);

      if (!teamData) {
        return null;
      }

      // Get matches for this team
      const matches = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/matches`
      ) || {};

      const teamMatches = Object.values(matches).filter(
        m =>
          (m.team1Id === teamId || m.team2Id === teamId) &&
          m.status === 'completed'
      );

      // Calculate additional stats
      const stats = {
        ...teamData,
        totalMatches: teamMatches.length,
        matches: teamMatches.map(m => ({
          matchId: m.matchId,
          opponent: m.team1Id === teamId ? m.team2Id : m.team1Id,
          score: m.team1Id === teamId ? `${m.score1}-${m.score2}` : `${m.score2}-${m.score1}`,
          result: m.winner === teamId ? 'win' : 'loss',
          date: m.verifiedAt,
        })),
      };

      return stats;
    } catch (error) {
      Logger.error('Get team stats error:', error);
      return null;
    }
  }

  /**
   * Get leaderboard history
   */
  async getLeaderboardHistory(guildId, tournamentId) {
    try {
      const history = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/leaderboard_history`
      ) || [];

      return history;
    } catch (error) {
      Logger.error('Get leaderboard history error:', error);
      return [];
    }
  }

  /**
   * Get top teams
   */
  async getTopTeams(guildId, tournamentId, limit = 10) {
    try {
      const leaderboard = await this.getLeaderboard(
        guildId,
        tournamentId,
        limit
      );

      if (!leaderboard) {
        return null;
      }

      return leaderboard.standings.slice(0, limit);
    } catch (error) {
      Logger.error('Get top teams error:', error);
      return null;
    }
  }

  /**
   * Calculate statistics
   */
  async calculateStatistics(guildId, tournamentId) {
    try {
      const leaderboard = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/leaderboard`
      );

      if (!leaderboard) {
        return null;
      }

      const stats = {
        totalTeams: leaderboard.standings.length,
        totalMatches: leaderboard.standings.reduce(
          (sum, s) => sum + s.matches,
          0
        ) / 2, // Divide by 2 since each match has 2 teams
        averageWinRate:
          leaderboard.standings.reduce((sum, s) => sum + s.winRate, 0) /
          leaderboard.standings.length,
        topTeam: leaderboard.standings[0],
        bottomTeam: leaderboard.standings[leaderboard.standings.length - 1],
        mostWins: leaderboard.standings.reduce((max, s) =>
          s.wins > max.wins ? s : max
        ),
        mostPoints: leaderboard.standings[0],
      };

      return stats;
    } catch (error) {
      Logger.error('Calculate statistics error:', error);
      return null;
    }
  }

  /**
   * Log leaderboard update
   */
  async logLeaderboardUpdate(guildId, tournamentId, data) {
    try {
      const eventId = `LB-UPDATE-${Date.now()}`;
      const event = {
        id: eventId,
        tournamentId,
        timestamp: new Date().toISOString(),
        data,
      };

      await firebase.set(
        `servers/${guildId}/leaderboard_updates/${eventId}`,
        event
      );

      return true;
    } catch (error) {
      Logger.error('Log leaderboard update error:', error);
      return false;
    }
  }

  /**
   * Archive leaderboard snapshot
   */
  async archiveSnapshot(guildId, tournamentId) {
    try {
      const leaderboard = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/leaderboard`
      );

      if (!leaderboard) {
        return { success: false, error: 'Leaderboard not found' };
      }

      const snapshot = {
        ...leaderboard,
        snapshotAt: new Date().toISOString(),
      };

      const snapshotId = `SNAPSHOT-${Date.now()}`;

      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}/leaderboard_snapshots/${snapshotId}`,
        snapshot
      );

      Logger.info(`📸 Leaderboard snapshot archived: ${snapshotId}`);

      return { success: true, snapshotId };
    } catch (error) {
      Logger.error('Archive snapshot error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get scoring systems
   */
  getScoringystems() {
    return this.scoringSystems;
  }

  /**
   * Get default points structure
   */
  getDefaultPoints() {
    return this.defaultPoints;
  }
}

module.exports = LeaderboardSystem;
