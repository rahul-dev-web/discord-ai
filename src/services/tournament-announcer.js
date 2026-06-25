/**
 * TOURNAMENT ANNOUNCER - Phase 16
 * Automatic announcements and notifications
 * 
 * Features:
 * - Create announcement channels
 * - Auto-announce tournament events
 * - Match reminders
 * - Result announcements
 * - Winner celebrations
 */

const { EmbedBuilder } = require('discord.js');
const Logger = require('../utils/logger');
const firebase = require('../core/firebase-config');

class TournamentAnnouncer {
  constructor(client, database) {
    this.client = client;
    this.db = database;

    // Announcement types
    this.types = {
      tournament_created: 'Tournament Created',
      tournament_started: 'Tournament Started',
      tournament_completed: 'Tournament Completed',
      team_registered: 'Team Registered',
      match_scheduled: 'Match Scheduled',
      match_reminder: 'Match Reminder',
      match_completed: 'Match Completed',
      result_verified: 'Result Verified',
      leaderboard_update: 'Leaderboard Update',
      winner_announced: 'Winner Announced',
      celebration: 'Celebration',
    };
  }

  /**
   * Create announcement channels for tournament
   */
  async createAnnouncementChannels(guildId, tournamentId, tournament) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const tournamnetName = tournament.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .substring(0, 20);

      // Create category
      const category = await guild.channels.create({
        name: `🏆 ${tournament.name}`,
        type: 4, // Category
      });

      // Create channels
      const channels = {
        announcements: await guild.channels.create({
          name: `📢-announcements`,
          type: 0, // Text channel
          parent: category.id,
          topic: `Announcements for ${tournament.name}`,
        }),
        matches: await guild.channels.create({
          name: `🎮-matches`,
          type: 0,
          parent: category.id,
          topic: `Match information for ${tournament.name}`,
        }),
        results: await guild.channels.create({
          name: `📊-results`,
          type: 0,
          parent: category.id,
          topic: `Match results for ${tournament.name}`,
        }),
        leaderboard: await guild.channels.create({
          name: `🏅-leaderboard`,
          type: 0,
          parent: category.id,
          topic: `Live leaderboard for ${tournament.name}`,
        }),
      };

      // Save channel IDs to tournament
      tournament.channels = {
        categoryId: category.id,
        announcementChannelId: channels.announcements.id,
        matchesChannelId: channels.matches.id,
        resultsChannelId: channels.results.id,
        leaderboardChannelId: channels.leaderboard.id,
      };

      await firebase.set(
        `servers/${guildId}/tournaments/${tournamentId}`,
        tournament
      );

      Logger.info(`📢 Announcement channels created for ${tournamentId}`);

      return { success: true, channels };
    } catch (error) {
      Logger.error('Create channels error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Announce tournament created
   */
  async announceTournamentCreated(guildId, tournament) {
    try {
      if (!tournament.channels || !tournament.channels.announcementChannelId) {
        return { success: false, error: 'Announcement channel not found' };
      }

      const channel = this.client.channels.cache.get(
        tournament.channels.announcementChannelId
      );
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      const embed = new EmbedBuilder()
        .setColor('#FF6B00')
        .setTitle(`🏆 ${tournament.name}`)
        .setDescription(tournament.description || 'A new tournament has been created!')
        .addFields(
          { name: 'Type', value: tournament.templateName, inline: true },
          { name: 'Format', value: tournament.format, inline: true },
          { name: 'Max Teams', value: tournament.settings.maxTeams.toString(), inline: true },
          { name: 'Status', value: tournament.status, inline: true }
        )
        .setFooter({ text: 'Register your team now!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      tournament.announcements.created = true;

      Logger.info(`📢 Tournament created announcement sent`);

      return { success: true };
    } catch (error) {
      Logger.error('Announce tournament created error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Announce tournament started
   */
  async announceTournamentStarted(guildId, tournament) {
    try {
      if (!tournament.channels || !tournament.channels.announcementChannelId) {
        return { success: false, error: 'Announcement channel not found' };
      }

      const channel = this.client.channels.cache.get(
        tournament.channels.announcementChannelId
      );
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      const teamCount = Object.keys(tournament.teams).length;

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`🎮 ${tournament.name} - Tournament Started!`)
        .setDescription(`Registration is now closed. The tournament is beginning!`)
        .addFields(
          { name: 'Teams Registered', value: teamCount.toString(), inline: true },
          { name: 'Format', value: tournament.format, inline: true }
        )
        .setFooter({ text: 'Goodluck to all teams!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      tournament.announcements.started = true;

      Logger.info(`📢 Tournament started announcement sent`);

      return { success: true };
    } catch (error) {
      Logger.error('Announce tournament started error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Announce match scheduled
   */
  async announceMatchScheduled(guildId, tournament, match, team1, team2) {
    try {
      if (!tournament.channels || !tournament.channels.matchesChannelId) {
        return { success: false, error: 'Matches channel not found' };
      }

      const channel = this.client.channels.cache.get(
        tournament.channels.matchesChannelId
      );
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      const scheduledTime = new Date(match.scheduledAt);
      const timeString = scheduledTime.toLocaleString();

      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle(`⏰ Match Scheduled`)
        .setDescription(`${team1.name} vs ${team2.name}`)
        .addFields(
          { name: 'Match ID', value: match.matchId, inline: true },
          { name: 'Scheduled Time', value: timeString, inline: true },
          { name: 'Team 1', value: team1.name, inline: true },
          { name: 'Team 2', value: team2.name, inline: true }
        )
        .setFooter({ text: 'Good luck to both teams!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      Logger.info(`📢 Match scheduled announcement sent: ${match.matchId}`);

      return { success: true };
    } catch (error) {
      Logger.error('Announce match scheduled error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Announce match result
   */
  async announceMatchResult(guildId, tournament, match, winner, loser) {
    try {
      if (!tournament.channels || !tournament.channels.resultsChannelId) {
        return { success: false, error: 'Results channel not found' };
      }

      const channel = this.client.channels.cache.get(
        tournament.channels.resultsChannelId
      );
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`✅ Match Completed`)
        .setDescription(`${winner.name} defeats ${loser.name}`)
        .addFields(
          { name: 'Match ID', value: match.matchId, inline: true },
          { name: '🏆 Winner', value: winner.name, inline: true },
          { name: '🥈 Loser', value: loser.name, inline: true },
          { name: 'Score', value: `${match.score1} - ${match.score2}`, inline: true }
        )
        .setFooter({ text: 'Congratulations to the winners!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      Logger.info(`📢 Match result announcement sent: ${match.matchId}`);

      return { success: true };
    } catch (error) {
      Logger.error('Announce match result error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Announce tournament completed
   */
  async announceTournamentCompleted(guildId, tournament, standings) {
    try {
      if (!tournament.channels || !tournament.channels.announcementChannelId) {
        return { success: false, error: 'Announcement channel not found' };
      }

      const channel = this.client.channels.cache.get(
        tournament.channels.announcementChannelId
      );
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      // Get top 3
      const top1 = standings[0];
      const top2 = standings[1];
      const top3 = standings[2];

      let topTeamsStr = `🥇 **${top1.teamName}** - ${top1.points} points`;
      if (top2) topTeamsStr += `\n🥈 **${top2.teamName}** - ${top2.points} points`;
      if (top3) topTeamsStr += `\n🥉 **${top3.teamName}** - ${top3.points} points`;

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🏆 ${tournament.name} - Tournament Complete!`)
        .setDescription(`Congratulations to all participants!`)
        .addFields(
          {
            name: '🏅 Final Standings',
            value: topTeamsStr,
            inline: false,
          },
          {
            name: 'Total Teams',
            value: standings.length.toString(),
            inline: true,
          }
        )
        .setFooter({ text: 'Thanks for participating!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      tournament.announcements.completed = true;

      Logger.info(`📢 Tournament completed announcement sent`);

      return { success: true };
    } catch (error) {
      Logger.error('Announce tournament completed error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Announce leaderboard update
   */
  async announceLeaderboardUpdate(guildId, tournament, standings) {
    try {
      if (!tournament.channels || !tournament.channels.leaderboardChannelId) {
        return { success: false, error: 'Leaderboard channel not found' };
      }

      const channel = this.client.channels.cache.get(
        tournament.channels.leaderboardChannelId
      );
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      // Build leaderboard text
      let leaderboardText = '';
      for (let i = 0; i < Math.min(10, standings.length); i++) {
        const standing = standings[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        leaderboardText += `${medal} **${standing.teamName}** - ${standing.points} pts (${standing.wins}W-${standing.losses}L)\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle(`🏅 ${tournament.name} - Live Leaderboard`)
        .setDescription(leaderboardText)
        .setFooter({ text: 'Updated in real-time' })
        .setTimestamp();

      // Edit message if exists, or send new
      const messages = await channel.messages.fetch({ limit: 10 });
      const existingMessage = messages.find(m => m.author.id === this.client.user.id && m.embeds[0]?.title?.includes('Live Leaderboard'));

      if (existingMessage) {
        await existingMessage.edit({ embeds: [embed] });
      } else {
        await channel.send({ embeds: [embed] });
      }

      Logger.info(`📢 Leaderboard update announcement sent`);

      return { success: true };
    } catch (error) {
      Logger.error('Announce leaderboard update error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send match reminder
   */
  async sendMatchReminder(guildId, tournament, match, team1, team2, minutesUntil) {
    try {
      if (!tournament.channels || !tournament.channels.matchesChannelId) {
        return { success: false, error: 'Matches channel not found' };
      }

      const channel = this.client.channels.cache.get(
        tournament.channels.matchesChannelId
      );
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      const reminderText = minutesUntil <= 15 ? '🚨 **MATCH STARTING SOON!**' : '⏰ **Upcoming Match**';

      const embed = new EmbedBuilder()
        .setColor(minutesUntil <= 15 ? '#FF0000' : '#FFFF00')
        .setTitle(reminderText)
        .setDescription(`${team1.name} vs ${team2.name}`)
        .addFields(
          { name: 'Match ID', value: match.matchId, inline: true },
          { name: 'Time', value: `${minutesUntil} minutes from now`, inline: true },
          { name: 'Get Ready!', value: 'Both teams, please prepare for the match!', inline: false }
        )
        .setTimestamp();

      const mentions = `${team1.name} ${team2.name}`;
      await channel.send({ content: mentions, embeds: [embed] });

      Logger.info(`📢 Match reminder sent: ${match.matchId}`);

      return { success: true };
    } catch (error) {
      Logger.error('Send match reminder error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send celebration message
   */
  async sendCelebration(guildId, tournament, winner) {
    try {
      if (!tournament.channels || !tournament.channels.announcementChannelId) {
        return { success: false, error: 'Announcement channel not found' };
      }

      const channel = this.client.channels.cache.get(
        tournament.channels.announcementChannelId
      );
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      const celebrations = [
        '🎊 **WHAT A PERFORMANCE!** 🎊',
        '🏆 **CHAMPIONS!** 🏆',
        '⭐ **LEGENDARY VICTORY!** ⭐',
        '🌟 **ABSOLUTELY DOMINANT!** 🌟',
      ];

      const celebration = celebrations[Math.floor(Math.random() * celebrations.length)];

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(celebration)
        .setDescription(`Congratulations to **${winner.name}**!`)
        .addFields({
          name: 'You are the champions!',
          value: 'Amazing gameplay and teamwork!',
          inline: false,
        })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      Logger.info(`🎉 Celebration sent for ${winner.name}`);

      return { success: true };
    } catch (error) {
      Logger.error('Send celebration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get announcement types
   */
  getTypes() {
    return this.types;
  }
}

module.exports = TournamentAnnouncer;
