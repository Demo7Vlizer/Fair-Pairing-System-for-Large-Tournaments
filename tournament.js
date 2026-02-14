/**
 * Chess Tournament Pairing System
 * Supports Swiss System and Round-Robin pairing algorithms
 */

class Tournament {
    constructor() {
        this.players = [];
        this.rounds = [];
        this.currentRound = 0;
        this.pairingSystem = 'swiss';
        this.eliminatedPlayers = []; // For knockout system
        this.activePlayers = []; // Players still in tournament (knockout)
        this.matchResults = []; // Store match results for Swiss system
    }

    /**
     * Add players to the tournament
     * @param {Array<string|{id: string, rating?: number}>} playerInput - Array of player IDs (strings) or { id, rating } objects
     */
    addPlayers(playerInput) {
        const normalize = (item) => {
            if (typeof item === 'string') {
                return { id: item.trim(), rating: 1500 };
            }
            return {
                id: (item.id || '').trim(),
                rating: typeof item.rating === 'number' && item.rating >= 0 ? item.rating : 1500
            };
        };
        const newPlayers = playerInput
            .map(normalize)
            .filter(p => p.id.length > 0)
            .filter(p => !this.players.find(existing => existing.id === p.id))
            .map(p => ({
                id: p.id,
                score: 0,
                rating: p.rating,
                opponents: [],
                wins: 0,
                losses: 0,
                draws: 0,
                bye: false,
                eliminated: false,
                lastResult: null
            }));

        this.players.push(...newPlayers);
        this.activePlayers = [...this.players];
        return newPlayers.length;
    }

    /**
     * Clear all players
     */
    clearPlayers() {
        this.players = [];
        this.rounds = [];
        this.currentRound = 0;
        this.eliminatedPlayers = [];
        this.activePlayers = [];
        this.matchResults = [];
    }

    /**
     * Generate pairings for the next round
     * @param {string} system - 'swiss', 'round-robin', or 'knockout'
     * @returns {Array} Array of pairings
     */
    generatePairings(system = this.pairingSystem) {
        if (this.players.length < 2) {
            throw new Error('Need at least 2 players to generate pairings');
        }

        this.pairingSystem = system;

        if (system === 'knockout') {
            return this.generateKnockoutPairings();
        } else if (system === 'swiss') {
            return this.generateSwissPairings();
        } else {
            return this.generateRoundRobinPairings();
        }
    }

    /**
     * Knockout/Elimination System Pairing Algorithm
     * Winners advance, losers are eliminated
     */
    generateKnockoutPairings() {
        // First round: pair all active players
        if (this.currentRound === 0) {
            this.activePlayers = [...this.players];
            this.eliminatedPlayers = [];
        } else {
            // For rounds 2+, check if previous round results are recorded
            const previousRound = this.currentRound;
            if (!this.areAllResultsRecorded(previousRound)) {
                throw new Error('Please record results for all matches in the previous round before generating next round.');
            }
            
            // Process bye matches
            this.processByeMatches();
            
            // Update active players based on recorded results
            this.updateActivePlayersFromResults(previousRound);
        }

        if (this.activePlayers.length < 2) {
            if (this.activePlayers.length === 1) {
                throw new Error(`🎉 Tournament Complete! Winner: ${this.activePlayers[0].id}`);
            } else {
                throw new Error('No players remaining in tournament');
            }
        }

        const pairings = [];
        let playersToPair = [...this.activePlayers];

        // Every round: pair by similar rating (1v2, 3v4, 5v6...) for fair matchups
        playersToPair.sort((a, b) => b.rating - a.rating);

        // Bye = lowest-rated player (last in sorted list)
        let byePlayer = null;
        if (playersToPair.length % 2 === 1) {
            byePlayer = playersToPair.pop();
            byePlayer.bye = true;
        }

        // Pair remaining players
        for (let i = 0; i < playersToPair.length; i += 2) {
            pairings.push({
                player1: playersToPair[i],
                player2: playersToPair[i + 1],
                round: this.currentRound + 1,
                knockout: true
            });
        }

        // Add bye if needed
        if (byePlayer) {
            pairings.push({
                player1: byePlayer,
                player2: null,
                round: this.currentRound + 1,
                bye: true,
                knockout: true
            });
        }

        // Save round
        this.rounds.push({
            round: this.currentRound + 1,
            pairings: pairings.map(p => ({
                player1Id: p.player1.id,
                player2Id: p.player2?.id || null,
                bye: p.bye || false,
                knockout: true,
                winnerId: null, // Will be set when result is recorded
                resultRecorded: false
            }))
        });

        this.currentRound++;
        return pairings;
    }

    /**
     * Record match result for knockout system
     * @param {number} round - Round number
     * @param {string} player1Id - First player ID
     * @param {string} player2Id - Second player ID (null for bye)
     * @param {string} winnerId - ID of the winner
     */
    recordKnockoutResult(round, player1Id, player2Id, winnerId) {
        const roundData = this.rounds.find(r => r.round === round);
        if (!roundData) return false;

        const pairing = roundData.pairings.find(p => 
            p.player1Id === player1Id && (p.player2Id === player2Id || (!p.player2Id && !player2Id))
        );

        if (!pairing) return false;

        pairing.winnerId = winnerId;
        pairing.resultRecorded = true;

        // Update player stats
        const winner = this.players.find(p => p.id === winnerId);
        const loserId = winnerId === player1Id ? player2Id : player1Id;
        const loser = loserId ? this.players.find(p => p.id === loserId) : null;

        if (winner) {
            winner.wins++;
            winner.score += 1;
            winner.lastResult = 'win';
        }

        if (loser) {
            loser.eliminated = true;
            loser.losses++;
            loser.lastResult = 'loss';
            // Remove from active players
            this.eliminatedPlayers.push(loser);
            this.activePlayers = this.activePlayers.filter(p => p.id !== loserId);
        }

        return true;
    }

    /**
     * Check if all matches in a round have results recorded
     * @param {number} round - Round number
     */
    areAllResultsRecorded(round) {
        const roundData = this.rounds.find(r => r.round === round);
        if (!roundData) return false;

        return roundData.pairings.every(p => p.resultRecorded || p.bye);
    }

    /**
     * Process bye matches automatically (for knockout system)
     */
    processByeMatches() {
        if (this.rounds.length === 0) return;

        const lastRound = this.rounds[this.rounds.length - 1];
        if (!lastRound || !lastRound.pairings) return;

        lastRound.pairings.forEach(pairing => {
            if (pairing.bye && !pairing.resultRecorded) {
                // Bye player advances automatically
                const byePlayer = this.activePlayers.find(p => p.id === pairing.player1Id);
                if (byePlayer) {
                    pairing.winnerId = pairing.player1Id;
                    pairing.resultRecorded = true;
                    byePlayer.wins++;
                    byePlayer.score += 1;
                }
            }
        });
    }

    /**
     * Update active players based on recorded results from previous round
     */
    updateActivePlayersFromResults(round) {
        const roundData = this.rounds.find(r => r.round === round);
        if (!roundData) return;

        // Get all winners from the round
        const winners = new Set();
        roundData.pairings.forEach(pairing => {
            if (pairing.winnerId) {
                winners.add(pairing.winnerId);
            }
        });

        // Update active players to only include winners
        this.activePlayers = this.activePlayers.filter(p => winners.has(p.id));
    }

    /**
     * Get active players (for knockout system)
     */
    getActivePlayers() {
        return this.activePlayers || this.players.filter(p => !p.eliminated);
    }

    /**
     * Swiss System Pairing Algorithm
     * Round 1: Pair by similar rating (fair – strong vs strong, weak vs weak)
     * Round 2+: Same score group play each other (winners vs winners, losers vs losers)
     */
    generateSwissPairings() {
        // Round 1: Similar rating pairing (fair first round)
        if (this.currentRound === 0) {
            return this.generateSwissRound1();
        }

        // Round 2+: Pair by score groups (same score waale aapas me)
        return this.generateSwissRound2Plus();
    }

    /**
     * Swiss Round 1: Pair by similar rating (1v2, 3v4, 5v6... so 376 vs ~400, 868 vs ~850)
     */
    generateSwissRound1() {
        // Sort by rating descending – then pair consecutive: (1,2), (3,4), (5,6)...
        const sortedPlayers = [...this.players].sort((a, b) => b.rating - a.rating);

        let playersToPair = [...sortedPlayers];
        let byePlayer = null;

        if (playersToPair.length % 2 === 1) {
            byePlayer = playersToPair.pop();
            byePlayer.bye = true;
        }

        const pairings = [];
        for (let i = 0; i < playersToPair.length; i += 2) {
            pairings.push({
                player1: playersToPair[i],
                player2: playersToPair[i + 1],
                round: 1
            });
        }

        if (byePlayer) {
            pairings.push({
                player1: byePlayer,
                player2: null,
                round: 1,
                bye: true
            });
        }

        this.rounds.push({
            round: 1,
            pairings: pairings.map(p => ({
                player1Id: p.player1.id,
                player2Id: p.player2?.id || null,
                bye: p.bye || false,
                resultRecorded: false,
                result: null
            }))
        });

        this.currentRound = 1;
        return pairings;
    }

    /**
     * Swiss Round 2+: Same score group aapas me + within group pair by similar rating
     */
    generateSwissRound2Plus() {
        // Sort by score (desc), then by rating (desc) – same score together, then similar rating nearby
        const sortedPlayers = [...this.players].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.rating - a.rating;
        });

        let playersToPair = [...sortedPlayers];
        let byePlayer = null;

        if (playersToPair.length % 2 === 1) {
            for (let i = playersToPair.length - 1; i >= 0; i--) {
                if (!playersToPair[i].bye) {
                    byePlayer = playersToPair.splice(i, 1)[0];
                    break;
                }
            }
            if (!byePlayer) {
                byePlayer = playersToPair.pop();
            }
            byePlayer.bye = true;
        }

        const pairings = [];
        const used = new Set();

        // Group by score
        const scoreGroups = {};
        playersToPair.forEach(p => {
            if (!scoreGroups[p.score]) scoreGroups[p.score] = [];
            scoreGroups[p.score].push(p);
        });

        const scoreKeys = Object.keys(scoreGroups).map(Number).sort((a, b) => b - a);

        for (const score of scoreKeys) {
            const group = scoreGroups[score].filter(p => !used.has(p.id));
            // Within same score group: sort by rating and pair consecutive (1v2, 3v4) = similar rating
            group.sort((a, b) => b.rating - a.rating);
            for (let i = 0; i + 1 < group.length; i += 2) {
                pairings.push({
                    player1: group[i],
                    player2: group[i + 1],
                    round: this.currentRound + 1
                });
                used.add(group[i].id);
                used.add(group[i + 1].id);
            }
            // Float odd one to next score group
            if (group.length % 2 === 1) {
                const floatPlayer = group[group.length - 1];
                const nextScore = scoreKeys.find(s => s < score);
                if (nextScore !== undefined && scoreGroups[nextScore]) {
                    scoreGroups[nextScore].push(floatPlayer);
                }
            }
        }

        if (byePlayer) {
            pairings.push({
                player1: byePlayer,
                player2: null,
                round: this.currentRound + 1,
                bye: true
            });
        }

        // Save round
        this.rounds.push({
            round: this.currentRound + 1,
            pairings: pairings.map(p => ({
                player1Id: p.player1.id,
                player2Id: p.player2?.id || null,
                bye: p.bye || false,
                resultRecorded: false,
                result: null
            }))
        });

        this.currentRound++;
        return pairings;
    }

    /**
     * Round-Robin Pairing Algorithm (circle method)
     * Pairs every player with every other player exactly once
     */
    generateRoundRobinPairings() {
        const n = this.players.length;
        const totalRounds = n % 2 === 1 ? n : n - 1; // odd: n rounds (each gets bye once), even: n-1
        if (this.currentRound >= totalRounds) {
            throw new Error('Round-robin tournament complete! All players have played each other.');
        }

        const pairings = [];
        const players = [...this.players];
        const r = this.currentRound; // 0-indexed round

        if (n % 2 === 1) {
            // Odd: fix player 0, rotate others. One player gets bye each round.
            const others = players.slice(1);
            const len = others.length; // n-1 (even when n is odd)
            const rotated = others.map((_, i) => others[(i + r) % len]);
            pairings.push({
                player1: players[0],
                player2: rotated[0],
                round: this.currentRound + 1
            });
            for (let i = 1; i <= len / 2 - 1; i++) {
                pairings.push({
                    player1: rotated[i],
                    player2: rotated[len - i],
                    round: this.currentRound + 1
                });
            }
            const byePlayer = rotated[len / 2];
            pairings.push({
                player1: byePlayer,
                player2: null,
                round: this.currentRound + 1,
                bye: true
            });
            byePlayer.bye = true;
        } else {
            // Even: circle method - fix players[0], rotate players[1..n-1]
            const others = players.slice(1);
            const len = others.length; // n-1
            const rotated = [players[0], ...others.map((_, i) => others[(i + r) % len])];
            for (let i = 0; i < rotated.length / 2; i++) {
                const p1 = rotated[i];
                const p2 = rotated[rotated.length - 1 - i];
                pairings.push({
                    player1: p1,
                    player2: p2,
                    round: this.currentRound + 1
                });
            }
        }

        // Save round (with result tracking for UI)
        this.rounds.push({
            round: this.currentRound + 1,
            pairings: pairings.map(p => ({
                player1Id: p.player1.id,
                player2Id: p.player2?.id || null,
                bye: p.bye || false,
                resultRecorded: false,
                result: null // '1-0', '0-1', '0.5-0.5'
            }))
        });

        this.currentRound++;
        return pairings;
    }

    /**
     * Record match result for a specific round (Swiss / Round-Robin)
     * @param {number} round - Round number
     * @param {string} player1Id
     * @param {string} player2Id - null for bye
     * @param {string} result - '1-0', '0-1', '0.5-0.5'
     */
    recordRoundResult(round, player1Id, player2Id, result) {
        const roundData = this.rounds.find(r => r.round === round);
        if (!roundData) return false;

        const pairing = roundData.pairings.find(p =>
            p.player1Id === player1Id && (p.player2Id === player2Id || (p.bye && !player2Id))
        );
        if (!pairing || pairing.resultRecorded) return false;

        if (pairing.bye) {
            pairing.resultRecorded = true;
            pairing.result = '1-0';
            const byePlayer = this.players.find(p => p.id === player1Id);
            if (byePlayer) {
                byePlayer.score += 1;
                byePlayer.wins++;
            }
            return true;
        }

        this.recordResult(player1Id, player2Id, result);
        pairing.resultRecorded = true;
        pairing.result = result;
        return true;
    }

    /**
     * Record match result
     * @param {string} player1Id 
     * @param {string} player2Id 
     * @param {string} result - '1-0', '0-1', '0.5-0.5'
     */
    recordResult(player1Id, player2Id, result) {
        const p1 = this.players.find(p => p.id === player1Id);
        const p2 = this.players.find(p => p.id === player2Id);

        if (!p1 || !p2) return;

        // Parse result
        const [score1, score2] = result.split('-').map(Number);

        // Update scores
        p1.score += score1;
        p2.score += score2;

        // Update record
        if (score1 > score2) {
            p1.wins++;
            p2.losses++;
        } else if (score2 > score1) {
            p2.wins++;
            p1.losses++;
        } else {
            p1.draws++;
            p2.draws++;
        }

        // Track opponents
        if (!p1.opponents.includes(p2.id)) {
            p1.opponents.push(p2.id);
        }
        if (!p2.opponents.includes(p1.id)) {
            p2.opponents.push(p1.id);
        }
    }

    /**
     * Get standings sorted by score
     * @param {string} sortBy - 'score', 'name', 'rating'
     */
    getStandings(sortBy = 'score') {
        const standings = [...this.players];

        standings.sort((a, b) => {
            if (sortBy === 'score') {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return b.rating - a.rating;
            } else if (sortBy === 'name') {
                return a.id.localeCompare(b.id);
            } else if (sortBy === 'rating') {
                return b.rating - a.rating;
            }
            return 0;
        });

        return standings.map((player, index) => ({
            rank: index + 1,
            ...player
        }));
    }

    /**
     * Reset tournament but keep players
     */
    resetTournament() {
        this.rounds = [];
        this.currentRound = 0;
        this.eliminatedPlayers = [];
        this.activePlayers = [...this.players];
        this.matchResults = [];
        this.players.forEach(player => {
            player.score = 0;
            player.opponents = [];
            player.wins = 0;
            player.losses = 0;
            player.draws = 0;
            player.bye = false;
            player.eliminated = false;
            player.lastResult = null;
        });
    }
}
