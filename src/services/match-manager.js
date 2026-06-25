/**
 * MATCH MANAGER - Phase 16
 * Match scheduling, score tracking, and result verification
 * 
 * Features:
 * - Match scheduling
 * - Score tracking
 * - Result verification
 * - Dispute handling
 */

const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class MatchManager {
  constructor(client, database) {
    this.client = client;
    this.db = database;

    // Match states
    this.states = {
      pending: 'Pending',
      scheduled: 'Scheduled',
      ongoing: 'Ongoing',
      pending_verification: 'Pending Verification',
      completed: 'Completed',
      disputed: 'Disputed',
      cancelled: 'Cancelled',
    };

    // Dispute reasons
    this.disputeReasons = [
      'Wrong score',
      'Server crash',
      'Disconnection',
      'Technical issue',
      'Unfair match',
      'Other',
    ];
  }

  /**
   * Schedule a match
   */
  async scheduleMatch(guildId, tournamentId, matchData) {
    try {
      const {
        matchId,
        team1Id,
        team2Id,
        scheduledTime,
        channelId,
        voiceChannelId,
      } = matchData;

      const match = {
        matchId,
        team1Id,
        team2Id,
        scheduledAt: scheduledTime,
        scheduledBy: matchData.scheduledBy,
        channelId: channelId || null,
        voiceChannelId: voiceChannelId || null,
        status: 'scheduled',
        
        score1: 0,
        score2: 0,
        winner: null,
        
        reportedBy: null,
        reportedAt: null,
        
        verifiedBy: null,
        verifiedAt: null,
        
        disputed: false,
        disputeReason: null,
        disputeReportedBy: null,
        disputeReportedAt: null,
        
        notes: matchData.notes || '',
      };

      // Save to database
      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}/matches/${matchId}`,
        match
      );

      // Log event
      await this.logMatchEvent(guildId, 'match_scheduled', {
        tournamentId,
        matchId,
        team1Id,
        team2Id,
        scheduledAt: scheduledTime,
      });

      Logger.info(`📅 Match scheduled: ${matchId}`);

      return { success: true, match };
    } catch (error) {
      Logger.error('Schedule match error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Report match result
   */
  async reportResult(guildId, tournamentId, matchId, resultData) {
    try {
      const {
        score1,
        score2,
        winnerTeamId,
        reportedBy,
        evidence,
      } = resultData;

      // Validate score
      if (score1 < 0 || score2 < 0) {
        return { success: false, error: 'Scores cannot be negative' };
      }

      // Save to database
      const matchPath = `servers/${guildId}/tournaments/${tournamentId}/matches/${matchId}`;
      
      const match = await firebase.get(matchPath);
      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      match.score1 = score1;
      match.score2 = score2;
      match.winner = winnerTeamId;
      match.status = 'pending_verification';
      match.reportedBy = reportedBy;
      match.reportedAt = new Date().toISOString();
      match.evidence = evidence || null;

      await firebase.set(matchPath, match);

      // Log event
      await this.logMatchEvent(guildId, 'match_result_reported', {
        tournamentId,
        matchId,
        score1,
        score2,
        winner: winnerTeamId,
        reportedBy,
      });

      Logger.info(`📊 Match result reported: ${matchId}`);

      return { success: true, match };
    } catch (error) {
      Logger.error('Report result error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify match result (admin)
   */
  async verifyResult(guildId, tournamentId, matchId, verifiedBy, approved) {
    try {
      const matchPath = `servers/${guildId}/tournaments/${tournamentId}/matches/${matchId}`;
      
      const match = await firebase.get(matchPath);
      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      if (match.status !== 'pending_verification') {
        return { success: false, error: 'Match not pending verification' };
      }

      if (approved) {
        match.status = 'completed';
        match.verifiedBy = verifiedBy;
        match.verifiedAt = new Date().toISOString();
      } else {
        match.status = 'pending'; // Reset for re-reporting
        match.score1 = 0;
        match.score2 = 0;
        match.winner = null;
        match.reportedBy = null;
        match.reportedAt = null;
      }

      await firebase.set(matchPath, match);

      // Log event
      await this.logMatchEvent(guildId, 'match_verified', {
        tournamentId,
        matchId,
        verified: approved,
        verifiedBy,
      });

      Logger.info(`✅ Match verified: ${matchId}`);

      return { success: true, match };
    } catch (error) {
      Logger.error('Verify result error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Report disputed match
   */
  async reportDispute(guildId, tournamentId, matchId, disputeData) {
    try {
      const {
        reason,
        reportedBy,
        description,
      } = disputeData;

      // Validate reason
      if (!this.disputeReasons.includes(reason)) {
        return { success: false, error: 'Invalid dispute reason' };
      }

      const matchPath = `servers/${guildId}/tournaments/${tournamentId}/matches/${matchId}`;
      
      const match = await firebase.get(matchPath);
      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      match.disputed = true;
      match.disputeReason = reason;
      match.disputeDescription = description;
      match.disputeReportedBy = reportedBy;
      match.disputeReportedAt = new Date().toISOString();
      match.status = 'disputed';

      await firebase.set(matchPath, match);

      // Create dispute ticket
      const disputeId = `DISPUTE-${Date.now()}`;
      const dispute = {
        id: disputeId,
        matchId,
        tournamentId,
        reason,
        description,
        reportedBy,
        reportedAt: new Date().toISOString(),
        status: 'open',
        resolution: null,
        resolvedBy: null,
        resolvedAt: null,
      };

      await firebase.set(
        `servers/${guildId}/disputes/${disputeId}`,
        dispute
      );

      // Log event
      await this.logMatchEvent(guildId, 'match_disputed', {
        tournamentId,
        matchId,
        disputeId,
        reason,
        reportedBy,
      });

      Logger.warn(`⚠️ Match dispute reported: ${matchId}`);

      return { success: true, dispute };
    } catch (error) {
      Logger.error('Report dispute error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resolve dispute
   */
  async resolveDispute(guildId, disputeId, resolution) {
    try {
      const dispute = await firebase.get(
        `servers/${guildId}/disputes/${disputeId}`
      );

      if (!dispute) {
        return { success: false, error: 'Dispute not found' };
      }

      dispute.status = 'resolved';
      dispute.resolution = resolution.decision; // 'approved', 'rejected', 'rematch'
      dispute.resolvedBy = resolution.resolvedBy;
      dispute.resolvedAt = new Date().toISOString();
      dispute.notes = resolution.notes || '';

      await firebase.set(
        `servers/${guildId}/disputes/${disputeId}`,
        dispute
      );

      // If rematch, update match status
      if (resolution.decision === 'rematch') {
        const matchPath = `servers/${guildId}/tournaments/${dispute.tournamentId}/matches/${dispute.matchId}`;
        const match = await firebase.get(matchPath);
        
        if (match) {
          match.status = 'pending';
          match.score1 = 0;
          match.score2 = 0;
          match.winner = null;
          match.disputed = false;
          await firebase.set(matchPath, match);
        }
      }

      Logger.info(`✅ Dispute resolved: ${disputeId}`);

      return { success: true, dispute };
    } catch (error) {
      Logger.error('Resolve dispute error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get match details
   */
  async getMatch(guildId, tournamentId, matchId) {
    try {
      const match = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/matches/${matchId}`
      );

      return match || null;
    } catch (error) {
      Logger.error('Get match error:', error);
      return null;
    }
  }

  /**
   * Get all matches for tournament
   */
  async getTournamentMatches(guildId, tournamentId, filters = {}) {
    try {
      const matches = await firebase.get(
        `servers/${guildId}/tournaments/${tournamentId}/matches`
      ) || {};

      let results = Object.values(matches);

      // Apply filters
      if (filters.status) {
        results = results.filter(m => m.status === filters.status);
      }

      if (filters.teamId) {
        results = results.filter(m =>
          m.team1Id === filters.teamId || m.team2Id === filters.teamId
        );
      }

      // Sort by scheduled time
      results.sort((a, b) =>
        new Date(b.scheduledAt) - new Date(a.scheduledAt)
      );

      return results;
    } catch (error) {
      Logger.error('Get tournament matches error:', error);
      return [];
    }
  }

  /**
   * Get matches pending verification
   */
  async getPendingVerification(guildId, tournamentId) {
    try {
      return await this.getTournamentMatches(guildId, tournamentId, {
        status: 'pending_verification',
      });
    } catch (error) {
      Logger.error('Get pending verification error:', error);
      return [];
    }
  }

  /**
   * Get disputed matches
   */
  async getDisputedMatches(guildId, tournamentId) {
    try {
      return await this.getTournamentMatches(guildId, tournamentId, {
        status: 'disputed',
      });
    } catch (error) {
      Logger.error('Get disputed matches error:', error);
      return [];
    }
  }

  /**
   * Cancel match
   */
  async cancelMatch(guildId, tournamentId, matchId, reason = '') {
    try {
      const matchPath = `servers/${guildId}/tournaments/${tournamentId}/matches/${matchId}`;
      
      const match = await firebase.get(matchPath);
      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      match.status = 'cancelled';
      match.cancellationReason = reason;
      match.cancelledAt = new Date().toISOString();

      await firebase.set(matchPath, match);

      Logger.info(`❌ Match cancelled: ${matchId}`);

      return { success: true, match };
    } catch (error) {
      Logger.error('Cancel match error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get match statistics
   */
  async getMatchStats(guildId, tournamentId) {
    try {
      const matches = await this.getTournamentMatches(guildId, tournamentId);

      const stats = {
        total: matches.length,
        scheduled: matches.filter(m => m.status === 'scheduled').length,
        ongoing: matches.filter(m => m.status === 'ongoing').length,
        pendingVerification: matches.filter(m => m.status === 'pending_verification').length,
        completed: matches.filter(m => m.status === 'completed').length,
        disputed: matches.filter(m => m.status === 'disputed').length,
        cancelled: matches.filter(m => m.status === 'cancelled').length,
      };

      return stats;
    } catch (error) {
      Logger.error('Get match stats error:', error);
      return null;
    }
  }

  /**
   * Log match event
   */
  async logMatchEvent(guildId, eventType, eventData) {
    try {
      const eventId = `EVENT-${Date.now()}`;
      const event = {
        id: eventId,
        type: eventType,
        timestamp: new Date().toISOString(),
        data: eventData,
      };

      await firebase.set(
        `servers/${guildId}/match_events/${eventId}`,
        event
      );

      return true;
    } catch (error) {
      Logger.error('Log match event error:', error);
      return false;
    }
  }

  /**
   * Get available dispute reasons
   */
  getDisputeReasons() {
    return this.disputeReasons;
  }

  /**
   * Get match states
   */
  getStates() {
    return this.states;
  }
}

module.exports = MatchManager;
