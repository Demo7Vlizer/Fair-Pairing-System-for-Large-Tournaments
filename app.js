/**
 * Main Application Logic
 * Handles UI interactions and DOM manipulation
 */

const tournament = new Tournament();

// DOM Elements
const playerInput = document.getElementById('playerInput');
const addPlayersBtn = document.getElementById('addPlayersBtn');
const clearPlayersBtn = document.getElementById('clearPlayersBtn');
const generateRandomBtn = document.getElementById('generateRandomBtn');
const pairingSystem = document.getElementById('pairingSystem');
const roundsCount = document.getElementById('roundsCount');
const generateRoundBtn = document.getElementById('generateRoundBtn');
const resetTournamentBtn = document.getElementById('resetTournamentBtn');
const playerCount = document.getElementById('playerCount');
const roundSection = document.getElementById('roundSection');
const currentRoundSpan = document.getElementById('currentRound');
const pairingsContainer = document.getElementById('pairingsContainer');
const standingsContainer = document.getElementById('standingsContainer');
const sortByNameBtn = document.getElementById('sortByNameBtn');
const sortByScoreBtn = document.getElementById('sortByScoreBtn');
const sortByRatingBtn = document.getElementById('sortByRatingBtn');
const downloadShortlistBtn = document.getElementById('downloadShortlistBtn');

// Event Listeners
addPlayersBtn.addEventListener('click', addPlayers);
clearPlayersBtn.addEventListener('click', clearPlayers);
generateRandomBtn.addEventListener('click', generateRandomPlayers);
generateRoundBtn.addEventListener('click', generateRound);
resetTournamentBtn.addEventListener('click', resetTournament);
sortByNameBtn.addEventListener('click', () => updateStandings('name'));
sortByScoreBtn.addEventListener('click', () => updateStandings('score'));
sortByRatingBtn.addEventListener('click', () => updateStandings('rating'));
if (downloadShortlistBtn) downloadShortlistBtn.addEventListener('click', downloadShortlist);

// Parse one line into { id, rating }. Supports "Name\t112" or "Name 112" or "Name".
function parsePlayerLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) {
        const rating = parseInt(parts.pop(), 10);
        const id = parts.join(' ').trim();
        return id ? { id, rating } : null;
    }
    return { id: trimmed, rating: 1500 };
}

// Parse textarea into array of { id, rating } (newline or comma separated)
function parsePlayerInput(text) {
    return text
        .split(/[\n,]+/)
        .map(line => parsePlayerLine(line))
        .filter(Boolean);
}

// Add players from input
function addPlayers() {
    if (!playerInput) return;
    const input = playerInput.value.trim();
    if (!input) return;

    const playersToAdd = parsePlayerInput(input);
    if (playersToAdd.length === 0) return;
    if (!tournament) return;

    const added = tournament.addPlayers(playersToAdd);
    playerInput.value = '';
    updatePlayerCount();
    updateStandings();
    
    // Show success message in player count area
    const countElement = document.getElementById('playerCount');
    if (!countElement) {
        console.error('playerCount element not found!');
        return;
    }
    
    const parentElement = countElement.parentElement; // Get the parent div
    const currentCount = tournament.players.length;
    
    if (added > 0) {
        parentElement.innerHTML = `<span id="playerCount">${currentCount}</span> players registered (+${added} added from your list)`;
        setTimeout(() => {
            parentElement.innerHTML = `<span id="playerCount">${currentCount}</span> players registered`;
        }, 2000);
    } else {
        updatePlayerCount();
        // Show message
        parentElement.innerHTML = `<span id="playerCount">${currentCount}</span> players registered (0 new players - may be duplicates)`;
        setTimeout(() => {
            parentElement.innerHTML = `<span id="playerCount">${currentCount}</span> players registered`;
        }, 2000);
    }
}

// Clear all players
function clearPlayers() {
    tournament.clearPlayers();
    playerInput.value = '';
    updatePlayerCount();
    updateStandings();
    roundSection.style.display = 'none';
    pairingsContainer.innerHTML = '';
    
    // Show confirmation in player count area
    const countElement = document.getElementById('playerCount');
    countElement.textContent = '0 players registered (cleared)';
    setTimeout(() => {
        countElement.textContent = '0 players registered';
    }, 1500);
}

// Generate random players for testing (or add list if names are in the box)
function generateRandomPlayers() {
    const input = playerInput.value.trim();
    let num = 100; // Default for random generation
    
    if (input && /^\d+$/.test(input)) {
        // Just a number: generate that many random players (Player1, Player2, ...)
        num = parseInt(input);
        if (isNaN(num) || num < 1) num = 100;
        if (num > 10000) num = 10000;
        const randomPlayers = [];
        for (let i = 1; i <= num; i++) {
            randomPlayers.push(`Player${i}`);
        }
        tournament.addPlayers(randomPlayers);
        playerInput.value = '';
        updatePlayerCount();
        updateStandings();
        const countElement = document.getElementById('playerCount');
        const parentElement = countElement.parentElement;
        parentElement.innerHTML = `<span id="playerCount">${tournament.players.length}</span> players registered (${num} random players added)`;
        setTimeout(() => {
            parentElement.innerHTML = `<span id="playerCount">${tournament.players.length}</span> players registered`;
        }, 2500);
        return;
    }
    
    if (input && input.length > 0) {
        // List of names (with optional ratings): add them as players
        const playersToAdd = parsePlayerInput(input);
        if (playersToAdd.length === 0) return;
        const added = tournament.addPlayers(playersToAdd);
        playerInput.value = '';
        updatePlayerCount();
        updateStandings();
        const countElement = document.getElementById('playerCount');
        const parentElement = countElement.parentElement;
        parentElement.innerHTML = `<span id="playerCount">${tournament.players.length}</span> players registered (${added} added from your list)`;
        setTimeout(() => {
            parentElement.innerHTML = `<span id="playerCount">${tournament.players.length}</span> players registered`;
        }, 2500);
        return;
    }
    
    // Empty box: generate default 100 random players
    num = 100;
    const randomPlayers = [];
    for (let i = 1; i <= num; i++) {
        randomPlayers.push(`Player${i}`);
    }
    tournament.addPlayers(randomPlayers);
    updatePlayerCount();
    updateStandings();
    const countElement = document.getElementById('playerCount');
    const parentElement = countElement.parentElement;
    parentElement.innerHTML = `<span id="playerCount">${tournament.players.length}</span> players registered (${num} random players added)`;
    setTimeout(() => {
        parentElement.innerHTML = `<span id="playerCount">${tournament.players.length}</span> players registered`;
    }, 2500);
}

// Generate next round
function generateRound() {
    if (tournament.players.length < 2) {
        // Show message in round section instead of alert
        roundSection.style.display = 'block';
        pairingsContainer.innerHTML = '<p class="empty-message" style="color: #e74c3c;">⚠️ Need at least 2 players to generate pairings</p>';
        return;
    }

    // For knockout: check if previous round results are recorded
    if (pairingSystem.value === 'knockout' && tournament.currentRound > 0) {
        const previousRound = tournament.currentRound;
        if (!tournament.areAllResultsRecorded(previousRound)) {
            // Show message in round section instead of alert
            roundSection.style.display = 'block';
            pairingsContainer.innerHTML = '<p class="empty-message" style="color: #856404;">⚠️ Please record results for all matches in the previous round before generating next round.<br><br>Click the ✓ buttons to mark winners.</p>';
            return;
        }
    }

    try {
        const system = pairingSystem.value;
        const pairings = tournament.generatePairings(system);
        
        displayPairings(pairings);
        updateStandings();
        roundSection.style.display = 'block';
        currentRoundSpan.textContent = tournament.currentRound;
        
        // Show knockout info (no alerts, info shown in display)
        if (system === 'knockout') {
            const remaining = tournament.activePlayers.length;
            if (remaining === 1) {
                // Winner will be shown in displayPairings
            }
        }
    } catch (error) {
        // Show error in round section instead of alert
        roundSection.style.display = 'block';
        pairingsContainer.innerHTML = `<p class="empty-message" style="color: #e74c3c;">⚠️ ${error.message}</p>`;
    }
}

// Display pairings
function displayPairings(pairings) {
    pairingsContainer.innerHTML = '';

    if (pairings.length === 0) {
        pairingsContainer.innerHTML = '<p class="empty-message">No pairings generated.</p>';
        return;
    }

    const isKnockout = pairingSystem.value === 'knockout';
    const currentRoundNum = tournament.currentRound;
    
    // Show knockout info
    if (isKnockout && tournament.activePlayers) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #ffc107;';
        const allRecorded = tournament.areAllResultsRecorded(currentRoundNum);
        infoDiv.innerHTML = `
            <strong>⚔️ Knockout Round ${currentRoundNum}</strong><br>
            <span style="color: #856404;">Active Players: ${tournament.activePlayers.length} | Eliminated: ${tournament.eliminatedPlayers.length}</span>
            ${allRecorded ? '<br><span style="color: #28a745; font-weight: bold;">✅ All results recorded! Ready for next round.</span>' : '<br><span style="color: #856404;">Click ✓ buttons to mark winners</span>'}
        `;
        pairingsContainer.appendChild(infoDiv);
    }

    // Get round data to check recorded results
    const roundData = tournament.rounds.find(r => r.round === currentRoundNum);
    
    pairings.forEach((pairing, index) => {
        const pairingCard = document.createElement('div');
        pairingCard.className = 'pairing-card';
        pairingCard.id = `pairing-${currentRoundNum}-${index}`;
        
        if (isKnockout && !pairing.bye) {
            pairingCard.style.borderColor = '#e74c3c';
            pairingCard.style.borderWidth = '3px';
        }

        // Check if result is already recorded
        const pairingData = roundData ? roundData.pairings[index] : null;
        const resultRecorded = pairingData ? pairingData.resultRecorded : false;
        const winnerId = pairingData ? pairingData.winnerId : null;

        if (pairing.bye) {
            const byeRecorded = resultRecorded || pairingData?.bye;
            pairingCard.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${pairing.player1.id}</div>
                    <div class="player-stats">Score: ${pairing.player1.score} | Rating: ${pairing.player1.rating}</div>
                    ${byeRecorded ? '<div style="color: #28a745; font-weight: bold; margin-top: 5px;">✅ Advances (Bye)</div>' : ''}
                </div>
                <div class="vs-divider">BYE</div>
                <div class="player-info">
                    <div class="player-name">-</div>
                    <div class="player-stats">Free point - Advances automatically</div>
                </div>
            `;
        } else {
            // Get fresh player data to check eliminated status
            const p1 = tournament.players.find(p => p.id === pairing.player1.id);
            const p2 = tournament.players.find(p => p.id === pairing.player2.id);
            
            const p1Won = winnerId === pairing.player1.id;
            const p2Won = winnerId === pairing.player2.id;
            const p1Eliminated = p1 ? p1.eliminated : false;
            const p2Eliminated = p2 ? p2.eliminated : false;
            
            const esc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const p1IdEsc = esc(pairing.player1.id);
            const p2IdEsc = esc(pairing.player2.id);
            
            let resultButtons = '';
            if (!isKnockout && !resultRecorded) {
                resultButtons = `
                    <div class="result-buttons" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" class="btn-result" onclick="recordMatchResult(${currentRoundNum}, '${p1IdEsc}', '${p2IdEsc}', '1-0')">1-0 ${pairing.player1.id}</button>
                        <button type="button" class="btn-result" onclick="recordMatchResult(${currentRoundNum}, '${p1IdEsc}', '${p2IdEsc}', '0-1')">0-1 ${pairing.player2.id}</button>
                        <button type="button" class="btn-result btn-draw" onclick="recordMatchResult(${currentRoundNum}, '${p1IdEsc}', '${p2IdEsc}', '0.5-0.5')">½-½ Draw</button>
                    </div>
                `;
            }
            const resultText = !isKnockout && resultRecorded && pairingData && pairingData.result
                ? `<div style="color: #28a745; font-weight: bold; margin-top: 5px;">Result: ${pairingData.result}</div>` : '';
            
            pairingCard.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${pairing.player1.id}</div>
                    <div class="player-stats">Score: ${p1 ? p1.score : pairing.player1.score} | Rating: ${p1 ? p1.rating : pairing.player1.rating} | W:${p1 ? p1.wins : pairing.player1.wins} L:${p1 ? p1.losses : pairing.player1.losses} D:${p1 ? p1.draws : pairing.player1.draws}</div>
                    ${isKnockout && p1Eliminated ? '<div style="color: #e74c3c;">❌ ELIMINATED</div>' : ''}
                    ${resultRecorded && p1Won ? '<div style="color: #28a745; font-weight: bold; margin-top: 5px;">✅ WINNER - Advances!</div>' : ''}
                    ${resultRecorded && !p1Won && p2Won ? '<div style="color: #e74c3c; font-weight: bold; margin-top: 5px;">❌ ELIMINATED</div>' : ''}
                    ${!resultRecorded && isKnockout ? `<button class="btn-win" onclick="recordWinner(${currentRoundNum}, '${p1IdEsc}', '${p2IdEsc}', '${p1IdEsc}')" style="margin-top: 10px;">✓ ${pairing.player1.id} Wins</button>` : ''}
                    ${resultButtons}
                    ${resultText}
                </div>
                <div class="vs-divider">VS</div>
                <div class="player-info">
                    <div class="player-name">${pairing.player2.id}</div>
                    <div class="player-stats">Score: ${p2 ? p2.score : pairing.player2.score} | Rating: ${p2 ? p2.rating : pairing.player2.rating} | W:${p2 ? p2.wins : pairing.player2.wins} L:${p2 ? p2.losses : pairing.player2.losses} D:${p2 ? p2.draws : pairing.player2.draws}</div>
                    ${isKnockout && p2Eliminated ? '<div style="color: #e74c3c;">❌ ELIMINATED</div>' : ''}
                    ${resultRecorded && p2Won ? '<div style="color: #28a745; font-weight: bold; margin-top: 5px;">✅ WINNER - Advances!</div>' : ''}
                    ${resultRecorded && !p2Won && p1Won ? '<div style="color: #e74c3c; font-weight: bold; margin-top: 5px;">❌ ELIMINATED</div>' : ''}
                    ${!resultRecorded && isKnockout ? `<button class="btn-win" onclick="recordWinner(${currentRoundNum}, '${p1IdEsc}', '${p2IdEsc}', '${p2IdEsc}')" style="margin-top: 10px;">✓ ${pairing.player2.id} Wins</button>` : ''}
                    ${!resultRecorded && isKnockout ? '<div style="color: #e74c3c; font-weight: bold; margin-top: 5px;">⚔️ Click button to mark winner</div>' : ''}
                </div>
            `;
        }

        pairingsContainer.appendChild(pairingCard);
    });
}

// Record match result for Swiss / Round-Robin (1-0, 0-1, 0.5-0.5)
function recordMatchResult(round, player1Id, player2Id, result) {
    const success = tournament.recordRoundResult(round, player1Id, player2Id, result);
    if (success) {
        const roundData = tournament.rounds.find(r => r.round === round);
        if (roundData) {
            const pairings = roundData.pairings.map(p => {
                const pl1 = tournament.players.find(pl => pl.id === p.player1Id);
                const pl2 = p.player2Id ? tournament.players.find(pl => pl.id === p.player2Id) : null;
                return { player1: pl1, player2: pl2, round, bye: p.bye || false };
            }).filter(p => p.player1);
            displayPairings(pairings);
            updateStandings();
        }
    }
}

// Record winner for knockout match
function recordWinner(round, player1Id, player2Id, winnerId) {
    const success = tournament.recordKnockoutResult(round, player1Id, player2Id, winnerId);
    
    if (success) {
        // Refresh display
        const system = pairingSystem.value;
        const currentRoundData = tournament.rounds.find(r => r.round === round);
        if (currentRoundData) {
            // Recreate pairings from round data
            const pairings = currentRoundData.pairings.map(p => {
                const p1 = tournament.players.find(pl => pl.id === p.player1Id);
                const p2 = p.player2Id ? tournament.players.find(pl => pl.id === p.player2Id) : null;
                return {
                    player1: p1,
                    player2: p2,
                    round: round,
                    bye: p.bye || false,
                    knockout: true
                };
            }).filter(p => p.player1 && (p.player2 || p.bye));
            
            displayPairings(pairings);
            updateStandings();
            
            // Check if all results recorded - message shown in displayPairings
            // No alert needed
        }
    }
    // Errors are handled silently - the display will update to show the result
}

// Update standings display
function updateStandings(sortBy = 'score') {
    const standings = tournament.getStandings(sortBy);
    const isKnockout = pairingSystem.value === 'knockout';

    if (standings.length === 0) {
        standingsContainer.innerHTML = '<p class="empty-message">No players registered yet.</p>';
        return;
    }

    let html = '';
    
    // Show knockout status header
    if (isKnockout && tournament.activePlayers) {
        html += `
            <div style="background: #d4edda; padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #28a745;">
                <strong>✅ Active: ${tournament.activePlayers.length}</strong> | 
                <span style="color: #721c24;"><strong>❌ Eliminated: ${tournament.eliminatedPlayers.length}</strong></span>
            </div>
        `;
    }

    html += `
        <table class="standings-table">
            <thead>
                <tr>
                    <th class="rank">Rank</th>
                    <th>Player ID</th>
                    <th>Score</th>
                    <th>Rating</th>
                    <th>Wins</th>
                    <th>Losses</th>
                    <th>Draws</th>
                    <th>Games</th>
                    ${isKnockout ? '<th>Status</th>' : ''}
                </tr>
            </thead>
            <tbody>
    `;

    standings.forEach(player => {
        const games = player.wins + player.losses + player.draws;
        const isActive = !player.eliminated;
        const statusCell = isKnockout ? `<td>${isActive ? '<span style="color: #28a745;">✅ Active</span>' : '<span style="color: #e74c3c;">❌ Eliminated</span>'}</td>` : '';
        const rowStyle = isKnockout && !isActive ? 'style="opacity: 0.6; background-color: #f8d7da;"' : '';
        
        html += `
            <tr ${rowStyle}>
                <td class="rank">${player.rank}</td>
                <td><strong>${player.id}</strong></td>
                <td class="score">${player.score.toFixed(1)}</td>
                <td>${player.rating}</td>
                <td>${player.wins}</td>
                <td>${player.losses}</td>
                <td>${player.draws}</td>
                <td>${games}</td>
                ${statusCell}
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    standingsContainer.innerHTML = html;
}

// Download shortlist as Excel/CSV (player name + rating) for dashboard manager
function downloadShortlist() {
    let standings = tournament.getStandings('score');
    const isKnockout = pairingSystem.value === 'knockout';
    // Knockout: export only qualifying winners (active players), not eliminated
    if (isKnockout) {
        standings = standings.filter(p => !p.eliminated);
    }
    if (standings.length === 0) {
        if (standingsContainer && standingsContainer.querySelector) {
            const msg = standingsContainer.querySelector('.empty-message');
            if (msg) msg.textContent = isKnockout ? 'No shortlisted players yet. Record results or add players.' : 'No players to download. Add players first.';
        }
        return;
    }
    const escapeCsv = (val) => {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };
    const headers = ['Rank', 'Player Name', 'Rating', 'Score', 'Wins', 'Losses', 'Draws', 'Games'];
    if (isKnockout) headers.push('Status');
    const rows = [headers.join(',')];
    standings.forEach((p, index) => {
        const games = p.wins + p.losses + p.draws;
        const rank = index + 1; // shortlist rank 1, 2, 3...
        const row = [
            rank,
            escapeCsv(p.id),
            p.rating,
            p.score.toFixed(1),
            p.wins,
            p.losses,
            p.draws,
            games
        ];
        if (isKnockout) row.push('Active');
        rows.push(row.join(','));
    });
    const csv = rows.join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess_tournament_shortlist_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Update player count
function updatePlayerCount() {
    const countElement = document.getElementById('playerCount');
    if (countElement) {
        const count = tournament.players.length;
        countElement.textContent = count;
        console.log(`Player count updated: ${count} players`);
    }
}

// Reset tournament but keep players
function resetTournament() {
    tournament.resetTournament();
    updatePlayerCount();
    updateStandings();
    roundSection.style.display = 'none';
    pairingsContainer.innerHTML = '';
    
    // Show confirmation in player count area
    const countElement = document.getElementById('playerCount');
    const originalText = countElement.textContent;
    countElement.textContent = `${tournament.players.length} players registered (tournament reset)`;
    setTimeout(() => {
        countElement.textContent = originalText;
    }, 2000);
}

// Initialize - wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    console.log('Tournament object:', tournament);
    console.log('Initial player count:', tournament.players.length);
    updatePlayerCount();
    updateStandings();
});

// Also run immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already loaded
    console.log('DOM already loaded, initializing...');
    console.log('Tournament object:', tournament);
    console.log('Initial player count:', tournament.players.length);
    updatePlayerCount();
    updateStandings();
}
