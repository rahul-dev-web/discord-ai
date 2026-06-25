/**
 * TEAM MANAGER - Phase 16
 * Team registration, roster management, and member tracking
 * 
 * Features:
 * - Team registration
 * - Roster management
 * - Member tracking
 * - Substitutions
 * - Team statistics
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class TeamManager {
  constructor(client, database) {
    this.client = client;
    this.db = database;
  }

  /**
   * Create a team
   */
  async createTeam(guildId, tournamentId, teamData) {
    try {
      const {
        name,
        captain,
        members,
        description,
      } = teamData;

      // Validate team size
      const tournament = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}`
      );

      if (!tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      if (members.length !== tournament.type) {
        return {
          success: false,
          error: `Team size must be ${tournament.type} players`,
        };
      }

      // Check team name uniqueness
      const existingTeams = Object.values(tournament.teams || {});
      if (existingTeams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        return { success: false, error: 'Team name already exists' };
      }

      const teamId = `TEAM-${Date.now()}`;

      const team = {
        id: teamId,
        name,
        captain,
        members,
        description: description || '',
        createdAt: new Date().toISOString(),
        joinedTournamentAt: null,
        status: 'created', // created, registered, active, eliminated
        points: 0,
        wins: 0,
        losses: 0,
        matches: 0,
        winRate: 0,
        placement: null,
        substituteHistory: [],
        roster: members.map((memberId, index) => ({
          userId: memberId,
          position: index + 1,
          joinedAt: new Date().toISOString(),
          status: 'active',
        })),
      };

      // Save team
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}/teams/${teamId}`,
        team
      );

      // Add team to tournament
      tournament.teams[teamId] = team;
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      Logger.info(`✅ Team created: ${name}`);

      return { success: true, teamId, team };
    } catch (error) {
      Logger.error('Create team error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register team in tournament
   */
  async registerTeam(guildId, tournamentId, teamId) {
    try {
      const teamPath = `servers/${guildId}/tournaments/${tournamentId}/teams/${teamId}`;
      const team = await firebase.get(teamPath);

      if (!team) {
        return { success: false, error: 'Team not found' };
      }

      const tournament = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}`
      );

      if (!tournament) {
        return { success: false, error: 'Tournament not found' };
      }

      if (tournament.status !== 'registration' && tournament.status !== 'created') {
        return { success: false, error: 'Tournament not accepting registrations' };
      }

      team.status = 'registered';
      team.joinedTournamentAt = new Date().toISOString();

      await firebase.set(teamPath, team);

      Logger.info(`📋 Team registered: ${team.name}`);

      return { success: true, team };
    } catch (error) {
      Logger.error('Register team error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add member to team
   */
  async addMember(guildId, tournamentId, teamId, memberId) {
    try {
      const teamPath = `servers/${guildId}/tournaments/${tournamentId}/teams/${teamId}`;
      const team = await firebase.get(teamPath);

      if (!team) {
        return { success: false, error: 'Team not found' };
      }

      const tournament = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}`
      );

      // Check team size
      if (team.members.length >= tournament.type) {
        return { success: false, error: 'Team is full' };
      }

      // Check if already member
      if (team.members.includes(memberId)) {
        return { success: false, error: 'Player already in team' };
      }

      team.members.push(memberId);
      team.roster.push({
        userId: memberId,
        position: team.roster.length + 1,
        joinedAt: new Date().toISOString(),
        status: 'active',
      });

      await firebase.set(teamPath, team);

      Logger.info(`➕ Member added to ${team.name}`);

      return { success: true, team };
    } catch (error) {
      Logger.error('Add member error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove member from team
   */
  async removeMember(guildId, tournamentId, teamId, memberId) {
    try {
      const teamPath = `servers/${guildId}/tournaments/${tournamentId}/teams/${teamId}`;
      const team = await firebase.get(teamPath);

      if (!team) {
        return { success: false, error: 'Team not found' };
      }

      // Can't remove captain
      if (team.captain === memberId) {
        return { success: false, error: 'Cannot remove team captain' };
      }

      // Remove from members
      team.members = team.members.filter(m => m !== memberId);

      // Mark as inactive in roster
      const rosterMember = team.roster.find(r => r.userId === memberId);
      if (rosterMember) {
        rosterMember.status = 'inactive';
        rosterMember.leftAt = new Date().toISOString();
      }

      await firebase.set(teamPath, team);

      Logger.info(`➖ Member removed from ${team.name}`);

      return { success: true, team };
    } catch (error) {
      Logger.error('Remove member error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Make substitution (if allowed)
   */
  async makeSubstitution(guildId, tournamentId, teamId, removeMemberId, addMemberId) {
    try {
      const tournament = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}`
      );

      if (!tournament || !tournament.settings.allowSubstitutions) {
        return { success: false, error: 'Substitutions not allowed' };
      }

      // Can't substitute during active tournament
      if (tournament.status === 'active') {
        return { success: false, error: 'Cannot substitute during tournament' };
      }

      const teamPath = `servers/${guildId}/tournaments/${tournamentId}/teams/${teamId}`;
      const team = await firebase.get(teamPath);

      if (!team) {
        return { success: false, error: 'Team not found' };
      }

      // Replace member
      const index = team.members.indexOf(removeMemberId);
      if (index === -1) {
        return { success: false, error: 'Member not in team' };
      }

      team.members[index] = addMemberId;

      // Update roster
      const rosterMember = team.roster.find(r => r.userId === removeMemberId);
      if (rosterMember) {
        rosterMember.status = 'substituted';
        rosterMember.substitutedAt = new Date().toISOString();
      }

      team.roster.push({
        userId: addMemberId,
        position: team.roster.length + 1,
        joinedAt: new Date().toISOString(),
        status: 'active',
        substituteFor: removeMemberId,
      });

      team.substituteHistory.push({
        removed: removeMemberId,
        added: addMemberId,
        date: new Date().toISOString(),
      });

      await firebase.set(teamPath, team);

      Logger.info(`🔄 Substitution made in ${team.name}`);

      return { success: true, team };
    } catch (error) {
      Logger.error('Make substitution error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get team details
   */
  async getTeam(guildId, tournamentId, teamId) {
    try {
      const team = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/teams/${teamId}`
      );

      return team || null;
    } catch (error) {
      Logger.error('Get team error:', error);
      return null;
    }
  }

  /**
   * Get all teams in tournament
   */
  async getTournamentTeams(guildId, tournamentId, filters = {}) {
    try {
      const tournament = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}`
      );

      if (!tournament || !tournament.teams) {
        return [];
      }

      let teams = Object.values(tournament.teams);

      // Apply filters
      if (filters.status) {
        teams = teams.filter(t => t.status === filters.status);
      }

      if (filters.captain) {
        teams = teams.filter(t => t.captain === filters.captain);
      }

      // Sort by points (descending)
      teams.sort((a, b) => b.points - a.points);

      return teams;
    } catch (error) {
      Logger.error('Get tournament teams error:', error);
      return [];
    }
  }

  /**
   * Get team statistics
   */
  async getTeamStats(guildId, tournamentId, teamId) {
    try {
      const team = await this.getTeam(guildId, tournamentId, teamId);

      if (!team) {
        return null;
      }

      const stats = {
        teamId: team.id,
        name: team.name,
        captain: team.captain,
        memberCount: team.members.length,
        points: team.points,
        wins: team.wins,
        losses: team.losses,
        matches: team.matches,
        winRate: team.matches > 0 ? (team.wins / team.matches) * 100 : 0,
        placement: team.placement,
        substitutions: team.substituteHistory.length,
        roster: team.roster.filter(r => r.status === 'active'),
      };

      return stats;
    } catch (error) {
      Logger.error('Get team stats error:', error);
      return null;
    }
  }

  /**
   * Update team after match
   */
  async updateTeamAfterMatch(guildId, tournamentId, teamId, result) {
    try {
      const teamPath = `servers/${guildId}/tournaments/${tournamentId}/teams/${teamId}`;
      const team = await firebase.get(teamPath);

      if (!team) {
        return { success: false, error: 'Team not found' };
      }

      team.matches++;

      if (result === 'win') {
        team.wins++;
        team.points += 100;
      } else if (result === 'loss') {
        team.losses++;
        team.points += 25;
      }

      if (team.matches > 0) {
        team.winRate = (team.wins / team.matches) * 100;
      }

      await firebase.set(teamPath, team);

      return { success: true, team };
    } catch (error) {
      Logger.error('Update team after match error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disqualify team
   */
  async disqualifyTeam(guildId, tournamentId, teamId, reason = '') {
    try {
      const teamPath = `servers/${guildId}/tournaments/${tournamentId}/teams/${teamId}`;
      const team = await firebase.get(teamPath);

      if (!team) {
        return { success: false, error: 'Team not found' };
      }

      team.status = 'disqualified';
      team.disqualificationReason = reason;
      team.disqualifiedAt = new Date().toISOString();

      await firebase.set(teamPath, team);

      Logger.warn(`❌ Team disqualified: ${team.name}`);

      return { success: true, team };
    } catch (error) {
      Logger.error('Disqualify team error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get member's teams
   */
  async getMemberTeams(guildId, tournamentId, memberId) {
    try {
      const teams = await this.getTournamentTeams(guildId, tournamentId);

      const memberTeams = teams.filter(t =>
        t.members.includes(memberId) || t.captain === memberId
      );

      return memberTeams;
    } catch (error) {
      Logger.error('Get member teams error:', error);
      return [];
    }
  }
}

module.exports = TeamManager;
