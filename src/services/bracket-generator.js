/**
 * BRACKET GENERATOR - Phase 16
 * Dynamic bracket generation for tournaments
 * 
 * Features:
 * - Multiple bracket formats
 * - Seeding algorithms
 * - Bye handling
 * - Real-time updates
 */

const Logger = require('../utils/logger');

class BracketGenerator {
  constructor(client, database) {
    this.client = client;
    this.db = database;
  }

  /**
   * Generate bracket based on format
   */
  async generateBracket(format, teams) {
    try {
      switch (format) {
        case 'single_elimination':
          return this.generateSingleElimination(teams);
        case 'double_elimination':
          return this.generateDoubleElimination(teams);
        case 'round_robin':
          return this.generateRoundRobin(teams);
        case 'multi_round':
          return this.generateMultiRound(teams);
        case 'best_of':
          return this.generateBestOf(teams);
        default:
          return this.generateSingleElimination(teams);
      }
    } catch (error) {
      Logger.error('Bracket generation error:', error);
      return { rounds: [], currentRound: 0, totalRounds: 0 };
    }
  }

  /**
   * Single Elimination Bracket
   * Losers are eliminated immediately
   */
  generateSingleElimination(teams) {
    const bracket = {
      format: 'single_elimination',
      rounds: [],
      currentRound: 1,
      totalRounds: 0,
    };

    // Seed teams (best seeding first)
    const seededTeams = this.seedTeams(teams);

    // Calculate rounds needed
    const totalRounds = Math.ceil(Math.log2(seededTeams.length));
    bracket.totalRounds = totalRounds;

    // Generate round 1
    const round1 = {
      roundNumber: 1,
      roundName: 'Round 1',
      matches: [],
    };

    for (let i = 0; i < seededTeams.length; i += 2) {
      const match = {
        matchId: `SE-R1-M${i / 2 + 1}`,
        roundNumber: 1,
        matchNumber: Math.floor(i / 2) + 1,
        team1: seededTeams[i],
        team2: seededTeams[i + 1] || null,
        team1Seed: i + 1,
        team2Seed: i + 2,
        scheduledAt: null,
        status: 'pending',
        winner: null,
        loser: null,
        score1: 0,
        score2: 0,
        channelId: null,
        verifiedBy: null,
        verifiedAt: null,
      };

      round1.matches.push(match);
    }

    bracket.rounds.push(round1);

    // Generate subsequent rounds (structure only, matches will be filled as results come in)
    for (let round = 2; round <= totalRounds; round++) {
      const roundMatches = Math.pow(2, totalRounds - round);

      const roundData = {
        roundNumber: round,
        roundName: this.getRoundName(round, totalRounds),
        matches: [],
      };

      for (let i = 0; i < roundMatches; i++) {
        const match = {
          matchId: `SE-R${round}-M${i + 1}`,
          roundNumber: round,
          matchNumber: i + 1,
          team1: null,
          team2: null,
          scheduledAt: null,
          status: 'pending',
          winner: null,
          score1: 0,
          score2: 0,
        };

        roundData.matches.push(match);
      }

      bracket.rounds.push(roundData);
    }

    Logger.debug(`🎯 Single elimination bracket generated: ${totalRounds} rounds`);
    return bracket;
  }

  /**
   * Double Elimination Bracket
   * Losers get a second chance in losers bracket
   */
  generateDoubleElimination(teams) {
    const bracket = {
      format: 'double_elimination',
      rounds: [],
      currentRound: 1,
      totalRounds: 0,
    };

    const seededTeams = this.seedTeams(teams);
    const roundsNeeded = Math.ceil(Math.log2(seededTeams.length));
    bracket.totalRounds = roundsNeeded * 2; // Winners + Losers bracket

    // WINNERS BRACKET
    const winnersBracket = this.generateWinnersBracket(seededTeams, roundsNeeded);
    bracket.rounds.push(...winnersBracket.rounds);

    // LOSERS BRACKET (will be populated as winners bracket produces losers)
    const losersBracket = {
      roundNumber: 1,
      roundName: 'Losers Bracket - Round 1',
      bracket: 'losers',
      matches: [],
    };

    bracket.rounds.push(losersBracket);

    Logger.debug(`🎯 Double elimination bracket generated`);
    return bracket;
  }

  /**
   * Generate winners bracket (for double elimination)
   */
  generateWinnersBracket(teams, roundsNeeded) {
    const rounds = [];

    const round1 = {
      roundNumber: 1,
      roundName: 'Winners - Round 1',
      bracket: 'winners',
      matches: [],
    };

    for (let i = 0; i < teams.length; i += 2) {
      const match = {
        matchId: `DE-WR1-M${i / 2 + 1}`,
        roundNumber: 1,
        matchNumber: Math.floor(i / 2) + 1,
        team1: teams[i],
        team2: teams[i + 1] || null,
        scheduledAt: null,
        status: 'pending',
        winner: null,
        loser: null,
        score1: 0,
        score2: 0,
      };

      round1.matches.push(match);
    }

    rounds.push(round1);

    // Generate other rounds
    for (let round = 2; round <= roundsNeeded; round++) {
      const matchCount = Math.pow(2, roundsNeeded - round);

      const roundData = {
        roundNumber: round,
        roundName: `Winners - Round ${round}`,
        bracket: 'winners',
        matches: [],
      };

      for (let i = 0; i < matchCount; i++) {
        const match = {
          matchId: `DE-WR${round}-M${i + 1}`,
          roundNumber: round,
          matchNumber: i + 1,
          team1: null,
          team2: null,
          scheduledAt: null,
          status: 'pending',
          winner: null,
          loser: null,
          score1: 0,
          score2: 0,
        };

        roundData.matches.push(match);
      }

      rounds.push(roundData);
    }

    return { rounds };
  }

  /**
   * Round Robin Bracket
   * Every team plays every other team
   */
  generateRoundRobin(teams) {
    const bracket = {
      format: 'round_robin',
      rounds: [],
      currentRound: 1,
      totalRounds: 0,
    };

    const totalTeams = teams.length;
    const totalRounds = totalTeams - 1;
    bracket.totalRounds = totalRounds;

    // Generate all rounds
    for (let round = 0; round < totalRounds; round++) {
      const roundMatches = [];

      for (let i = 0; i < Math.floor(totalTeams / 2); i++) {
        const team1Index = (round + i) % totalTeams;
        const team2Index = (round + totalTeams - 1 - i) % totalTeams;

        // Avoid bye matches
        if (team1Index === team2Index) continue;

        const match = {
          matchId: `RR-R${round + 1}-M${i + 1}`,
          roundNumber: round + 1,
          matchNumber: i + 1,
          team1: teams[team1Index],
          team2: teams[team2Index],
          scheduledAt: null,
          status: 'pending',
          winner: null,
          score1: 0,
          score2: 0,
        };

        roundMatches.push(match);
      }

      bracket.rounds.push({
        roundNumber: round + 1,
        roundName: `Round ${round + 1}`,
        matches: roundMatches,
      });
    }

    Logger.debug(`🎯 Round robin bracket generated: ${totalRounds} rounds`);
    return bracket;
  }

  /**
   * Multi-Round Bracket (for qualifiers)
   * Multiple elimination rounds with increasing difficulty
   */
  generateMultiRound(teams) {
    const bracket = {
      format: 'multi_round',
      rounds: [],
      currentRound: 1,
      totalRounds: 3, // Qualifier round 1, 2, Finals
    };

    const seededTeams = this.seedTeams(teams);

    // ROUND 1: All teams
    const round1 = {
      roundNumber: 1,
      roundName: 'Qualifier Round 1',
      maxAdvancing: Math.floor(seededTeams.length / 2),
      matches: [],
    };

    for (let i = 0; i < seededTeams.length; i += 2) {
      const match = {
        matchId: `MR-R1-M${i / 2 + 1}`,
        roundNumber: 1,
        team1: seededTeams[i],
        team2: seededTeams[i + 1] || null,
        status: 'pending',
        winner: null,
        score1: 0,
        score2: 0,
      };

      round1.matches.push(match);
    }

    bracket.rounds.push(round1);

    // ROUND 2: Winners of round 1
    const round2 = {
      roundNumber: 2,
      roundName: 'Qualifier Round 2',
      maxAdvancing: Math.floor(round1.matches.length / 2),
      matches: [],
    };

    for (let i = 0; i < round1.maxAdvancing; i += 2) {
      const match = {
        matchId: `MR-R2-M${i / 2 + 1}`,
        roundNumber: 2,
        team1: null, // Will be filled from round 1 winners
        team2: null,
        status: 'pending',
        winner: null,
        score1: 0,
        score2: 0,
      };

      round2.matches.push(match);
    }

    bracket.rounds.push(round2);

    // FINALS: Last winners
    const finals = {
      roundNumber: 3,
      roundName: 'Grand Finals',
      matches: [
        {
          matchId: 'MR-FINALS-M1',
          roundNumber: 3,
          team1: null,
          team2: null,
          status: 'pending',
          winner: null,
          score1: 0,
          score2: 0,
        },
      ],
    };

    bracket.rounds.push(finals);

    Logger.debug(`🎯 Multi-round bracket generated`);
    return bracket;
  }

  /**
   * Best Of Series (for finals)
   * Multiple games needed to win
   */
  generateBestOf(teams) {
    const bracket = {
      format: 'best_of',
      rounds: [],
      currentRound: 1,
      totalRounds: 1,
      series: [],
    };

    if (teams.length < 2) {
      return bracket;
    }

    const team1 = teams[0];
    const team2 = teams[1];

    // Create best of 5 series (first to 3 wins)
    const series = {
      seriesId: 'FINALS-BO5',
      team1,
      team2,
      bestOf: 5,
      gamesNeeded: 3,
      games: [],
      status: 'pending',
      seriesWinner: null,
    };

    for (let game = 1; game <= 5; game++) {
      const gameData = {
        gameId: `FINALS-BO5-G${game}`,
        gameNumber: game,
        team1: team1,
        team2: team2,
        scheduledAt: null,
        status: 'pending',
        winner: null,
        score1: 0,
        score2: 0,
      };

      series.games.push(gameData);
    }

    bracket.series.push(series);

    const round = {
      roundNumber: 1,
      roundName: 'Grand Finals - Best of 5',
      matches: series.games,
    };

    bracket.rounds.push(round);

    Logger.debug(`🎯 Best of series bracket generated`);
    return bracket;
  }

  /**
   * Seed teams based on ranking/seeding
   */
  seedTeams(teams) {
    // Simple seeding: sort by current points
    return teams.sort((a, b) => {
      const pointsB = b.currentPoints || 0;
      const pointsA = a.currentPoints || 0;
      return pointsB - pointsA;
    });
  }

  /**
   * Get round name
   */
  getRoundName(roundNumber, totalRounds) {
    const roundsFromEnd = totalRounds - roundNumber;

    if (roundsFromEnd === 0) {
      return 'Grand Finals';
    } else if (roundsFromEnd === 1) {
      return 'Semi-Finals';
    } else if (roundsFromEnd === 2) {
      return 'Quarter-Finals';
    } else {
      return `Round ${roundNumber}`;
    }
  }

  /**
   * Update bracket with match result
   */
  async updateBracketWithResult(bracket, matchId, winnerTeamId) {
    try {
      for (const round of bracket.rounds) {
        for (let i = 0; i < round.matches.length; i++) {
          const match = round.matches[i];

          if (match.matchId === matchId) {
            // Mark winner
            match.winner = winnerTeamId;
            match.loser = match.team1.id === winnerTeamId ? match.team2.id : match.team1.id;

            // Schedule next match if applicable
            if (round.roundNumber < bracket.totalRounds) {
              const nextRound = bracket.rounds[round.roundNumber];
              if (nextRound) {
                const nextMatchIndex = Math.floor(i / 2);
                const nextMatch = nextRound.matches[nextMatchIndex];

                if (nextMatch) {
                  // Determine if winner goes to team1 or team2 slot
                  if (i % 2 === 0) {
                    nextMatch.team1 = winnerTeamId;
                  } else {
                    nextMatch.team2 = winnerTeamId;
                  }
                }
              }
            }

            return true;
          }
        }
      }

      return false;
    } catch (error) {
      Logger.error('Update bracket error:', error);
      return false;
    }
  }

  /**
   * Get bracket standings
   */
  getBracketStandings(bracket) {
    const standings = [];

    // Collect all completed matches to determine standings
    for (const round of bracket.rounds) {
      for (const match of round.matches) {
        if (match.winner) {
          standings.push({
            teamId: match.winner.id,
            teamName: match.winner.name,
            round: round.roundNumber,
          });
        }
      }
    }

    return standings;
  }

  /**
   * Validate bracket integrity
   */
  validateBracket(bracket) {
    try {
      if (!bracket.rounds || bracket.rounds.length === 0) {
        return { valid: false, error: 'No rounds in bracket' };
      }

      if (bracket.totalRounds === 0) {
        return { valid: false, error: 'Total rounds not set' };
      }

      return { valid: true };
    } catch (error) {
      Logger.error('Bracket validation error:', error);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = BracketGenerator;
