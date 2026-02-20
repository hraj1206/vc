import React, { useState, useEffect, useRef } from 'react';
import { FiGrid, FiEdit3, FiRefreshCw, FiTrash2, FiAlertCircle } from 'react-icons/fi';
import './Games.css';

/* ───── game registry ───── */
const GAMES = [
    { id: 'tictactoe', name: 'Tic-Tac-Toe', icon: '⚔️', desc: '2-player classic', min: 2 },
    { id: 'connect4', name: 'Connect Four', icon: '🔴', desc: '4-in-a-row strategy', min: 2 },
    { id: 'rps', name: 'Rock Paper Scissors', icon: '✂️', desc: 'Best of 5 rounds', min: 2 },
    { id: 'hangman', name: 'Hangman', icon: '🪢', desc: 'Guess the hidden word', min: 2 },
    { id: 'memory', name: 'Memory Match', icon: '🃏', desc: 'Flip & match emoji cards', min: 2 },
    { id: 'numguess', name: 'Number Guess', icon: '🔢', desc: 'Guess 1-100, fewest tries wins', min: 2 },
    { id: 'mathquiz', name: 'Math Blitz', icon: '🧮', desc: 'Speed math race', min: 2 },
    { id: 'wordchain', name: 'Word Chain', icon: '🔗', desc: 'Last letter starts next', min: 2 },
    { id: 'drawing', name: 'Draw Together', icon: '🎨', desc: 'Collaborative canvas', min: 1 },
    { id: 'dice', name: 'Dice Roll', icon: '🎲', desc: 'Highest total wins', min: 2 },
    { id: 'coin', name: 'Coin Flip', icon: '🪙', desc: 'Call it – heads or tails', min: 2 },
    { id: 'snake', name: 'Snake Race', icon: '🐍', desc: 'Solo snake – share score', min: 1 },
];

export default function Games({ socket, roomId, myId, userName, participants = [] }) {
    const [activeGame, setActiveGame] = useState(null);
    const [invite, setInvite] = useState(null); // { gameId, fromName, fromId }
    const [currentGameState, setCurrentGameState] = useState(null);
    const canPlay2 = participants.length >= 2;

    useEffect(() => {
        if (!socket) return;

        // On mount, if we just joined a room with an active game, we might need state
        // This is usually handled by the join-room callback in Room.jsx, 
        // which should pass it to this component somehow. 
        // For now, let's listen for updates.

        const onInvite = (data) => {
            if (data.fromId !== myId) {
                setInvite({ gameId: data.gameId, fromName: data.fromName, fromId: data.fromId });
            }
        };
        const onGameSync = (data) => {
            if (data.action === 'start-sync') {
                setActiveGame(data.gameId);
                setCurrentGameState(data.gameState);
                setInvite(null);
            }
        };
        const onStateUpdate = (state) => {
            setCurrentGameState(state);
            if (state && state.gameId) setActiveGame(state.gameId);
        };

        socket.on('game-invite', onInvite);
        socket.on('game-sync-start', onGameSync);
        socket.on('game-state-update', onStateUpdate);

        return () => {
            socket.off('game-invite', onInvite);
            socket.off('game-sync-start', onGameSync);
            socket.off('game-state-update', onStateUpdate);
        };
    }, [socket, myId]);

    const sendInvite = (gameId) => {
        socket.emit('game-invite', { roomId, gameId, fromName: userName, fromId: myId });
        setActiveGame(gameId);
    };

    const acceptInvite = () => {
        if (!invite) return;
        socket.emit('game-accept', { roomId, gameId: invite.gameId });
        setInvite(null);
    };

    const gameComp = {
        tictactoe: <TicTacToe socket={socket} roomId={roomId} myId={myId} userName={userName} participants={participants} initialState={currentGameState} />,
        rps: <RPS socket={socket} roomId={roomId} myId={myId} userName={userName} participants={participants} initialState={currentGameState} />,
        connect4: <Connect4 socket={socket} roomId={roomId} myId={myId} userName={userName} participants={participants} initialState={currentGameState} />,
        // ... add others as they get server logic
    };

    return (
        <div className="games-container">
            {!activeGame ? (
                <>
                    {/* participants banner */}
                    <div className="games-participants-banner">
                        <span className="games-participants-label">👥 {participants.length} {participants.length === 1 ? 'person' : 'people'} in room</span>
                        <div className="games-participant-chips">
                            {participants.map(p => (
                                <div key={p.id} className={`games-chip ${p.isMe ? 'me' : ''}`}>
                                    <span className="games-chip-avatar">{p.name[0].toUpperCase()}</span>
                                    <span className="games-chip-name">{p.isMe ? `${p.name} (You)` : p.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {!canPlay2 && (
                        <div className="no-players-notice">
                            <FiAlertCircle size={18} />
                            <p>Share the room code to invite someone and unlock multiplayer games!</p>
                        </div>
                    )}
                    <div className="games-grid">
                        {GAMES.map(g => {
                            const locked = g.min > 1 && !canPlay2;
                            return (
                                <button
                                    key={g.id}
                                    className={`game-card-grid ${locked ? 'locked' : ''}`}
                                    onClick={() => !locked && sendInvite(g.id)}
                                    disabled={locked}
                                    title={locked ? 'Need 2+ players' : ''}
                                >
                                    <span className="gcg-icon">{g.icon}</span>
                                    <span className="gcg-name">{g.name}</span>
                                    <span className="gcg-desc">{g.desc}</span>
                                    {locked && <span className="gcg-lock">🔒</span>}
                                </button>
                            );
                        })}
                    </div>
                    {invite && (
                        <div className="game-invite-overlay">
                            <div className="game-invite-card glass-card animate-scale-in">
                                <div className="invite-icon">🎮</div>
                                <h3>Game Invite!</h3>
                                <p><strong>{invite.fromName}</strong> invited you to play <strong>{GAMES.find(g => g.id === invite.gameId)?.name}</strong></p>
                                <div className="invite-btns">
                                    <button className="btn btn-primary" onClick={acceptInvite}>Accept</button>
                                    <button className="btn btn-secondary" onClick={() => setInvite(null)}>Decline</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="game-view">
                    <button className="btn btn-secondary btn-sm game-back" onClick={() => { setActiveGame(null); setCurrentGameState(null); }}>← Games</button>
                    <div className="game-inner">{gameComp[activeGame]}</div>
                </div>
            )}
        </div>
    );
}

/* ── helpers ── */
function useGameSync(socket, handlers) {
    useEffect(() => {
        if (!socket) return;
        const onStateUpdate = (state) => {
            if (handlers.onStateUpdate) handlers.onStateUpdate(state);
        };
        socket.on('game-state-update', onStateUpdate);
        return () => { socket.off('game-state-update', onStateUpdate); };
    }, [socket, handlers.onStateUpdate]);
}

function emit(socket, roomId, gameId, action) {
    socket.emit('game-action', { roomId, gameId, action });
}
function emitReset(socket, roomId, gameId) {
    socket.emit('game-reset', { roomId, gameId });
}

/* ─────────────── 1. TIC-TAC-TOE ─────────────── */
function TicTacToe({ socket, roomId, myId, userName, participants, initialState }) {
    const [board, setBoard] = useState(initialState?.board || Array(9).fill(null));
    const [xTurn, setXTurn] = useState(initialState?.xTurn ?? true);
    const [winner, setWinner] = useState(initialState?.winner || null);
    const [gameUsers, setGameUsers] = useState(initialState?.users || []);

    useGameSync(socket, {
        onStateUpdate: (state) => {
            if (state.gameId === 'tictactoe') {
                setBoard(state.board);
                setXTurn(state.xTurn);
                setWinner(state.winner);
                setGameUsers(state.users);
            }
        }
    });

    const mySymbol = gameUsers[0] === myId ? 'X' : 'O';
    const oppSymbol = mySymbol === 'X' ? 'O' : 'X';
    const opp = participants.find(p => !p.isMe);
    const isMyTurn = (xTurn && mySymbol === 'X') || (!xTurn && mySymbol === 'O');

    const move = i => {
        if (board[i] || winner || !isMyTurn) return;
        socket.emit('game-action', { roomId, gameId: 'tictactoe', action: { i } });
    };

    const reset = () => socket.emit('game-reset', { roomId, gameId: 'tictactoe' });

    return (
        <div className="ttt-container">
            <div className="ttt-players">
                <PlayerChip name={userName} symbol={mySymbol} active={isMyTurn && !winner} color="#6c5ce7" />
                <span className="ttt-vs">VS</span>
                <PlayerChip name={opp?.name || 'Opp'} symbol={oppSymbol} active={!isMyTurn && !winner} color="#ec4899" />
            </div>
            <div className="ttt-status">
                {winner ? (winner === 'Draw' ? <span className="ttt-result draw">🤝 Draw!</span> : winner === mySymbol ? <span className="ttt-result win">🎉 You Won!</span> : <span className="ttt-result lose">😢 {opp?.name} Won!</span>)
                    : <span className="ttt-turn">{isMyTurn ? `Your turn (${mySymbol})` : `${opp?.name || 'Opp'}'s turn…`}</span>}
            </div>
            <div className="ttt-board">
                {board.map((c, i) => (
                    <button key={i} className={`ttt-cell ${c ? 'filled' : ''} ${c === 'X' ? 'x' : ''} ${c === 'O' ? 'o' : ''}`} onClick={() => move(i)} disabled={!!c || !!winner || !isMyTurn}>
                        {c && <span className="cell-symbol">{c}</span>}
                    </button>
                ))}
            </div>
            <button className="btn btn-secondary btn-full" onClick={reset}><FiRefreshCw size={13} /> New Game</button>
        </div>
    );
}

/* ─────────────── 2. CONNECT FOUR ─────────────── */
function Connect4({ socket, roomId, myId, userName, participants, initialState }) {
    const ROWS = 6, COLS = 7;
    const empty = () => Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    const [board, setBoard] = useState(initialState?.board || empty());
    const [rTurn, setRTurn] = useState(initialState?.rTurn ?? true);
    const [winner, setWinner] = useState(initialState?.winner || null);
    const [gameUsers, setGameUsers] = useState(initialState?.users || []);

    useGameSync(socket, {
        onStateUpdate: (state) => {
            if (state.gameId === 'connect4') {
                setBoard(state.board);
                setRTurn(state.rTurn);
                setWinner(state.winner);
                setGameUsers(state.users);
            }
        }
    });

    const myColor = gameUsers[0] === myId ? 'R' : 'Y';
    const oppColor = myColor === 'R' ? 'Y' : 'R';
    const opp = participants.find(p => !p.isMe);
    const isMyTurn = (rTurn && myColor === 'R') || (!rTurn && myColor === 'Y');

    const drop = col => {
        if (winner || !isMyTurn) return;
        socket.emit('game-action', { roomId, gameId: 'connect4', action: { c: col } });
    };

    const reset = () => socket.emit('game-reset', { roomId, gameId: 'connect4' });

    return (
        <div className="c4-container">
            <div className="ttt-players">
                <PlayerChip name={userName} symbol={myColor === 'R' ? '🔴' : '🟡'} active={isMyTurn && !winner} color="#6c5ce7" />
                <span className="ttt-vs">VS</span>
                <PlayerChip name={opp?.name || 'Opp'} symbol={myColor === 'R' ? '🟡' : '🔴'} active={!isMyTurn && !winner} color="#ec4899" />
            </div>
            {winner && <div className="ttt-status"><span className={`ttt-result ${winner === myColor ? 'win' : 'lose'}`}>{winner === myColor ? '🎉 You Won!' : '😢 They Won!'}</span></div>}
            {!winner && <div className="ttt-status"><span className="ttt-turn">{isMyTurn ? 'Your turn' : 'Opponent\'s turn…'}</span></div>}
            <div className="score-row">
                <ScoreBox label={userName} val={score.me} color="#6c5ce7" />
                <ScoreBox label={opp?.name || 'Opp'} val={score.them} color="#ec4899" />
            </div>
            <div className="c4-board">
                {Array(COLS).fill(0).map((_, c) => (
                    <div key={c} className="c4-col" onClick={() => drop(c)}>
                        {Array(ROWS).fill(0).map((_, r) => (
                            <div key={r} className={`c4-cell ${board[r][c] === 'R' ? 'red' : board[r][c] === 'Y' ? 'yellow' : ''}`} />
                        ))}
                    </div>
                ))}
            </div>
            <button className="btn btn-secondary btn-full" onClick={reset}><FiRefreshCw size={13} /> New Game</button>
        </div>
    );
}
function checkC4(board) {
    const R = 6, C = 7;
    const check = (r, c, dr, dc, color) => { for (let i = 0; i < 4; i++) { const nr = r + dr * i, nc = c + dc * i; if (nr < 0 || nr >= R || nc < 0 || nc >= C || board[nr][nc] !== color) return false; } return true; };
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const color of ['R', 'Y'])
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]])
            if (check(r, c, dr, dc, color)) return color;
    return board.every(row => row.every(c => c)) ? 'Draw' : null;
}

/* ─────────────── 3. ROCK PAPER SCISSORS ─────────────── */
function RPS({ socket, roomId, myId, userName, participants, initialState }) {
    const [picks, setPicks] = useState(initialState?.picks || {});
    const [reveal, setReveal] = useState(initialState?.reveal || false);
    const [result, setResult] = useState(initialState?.result || null);
    const [gameUsers, setGameUsers] = useState(initialState?.users || []);

    const choices = ['✊', '✋', '✌️'];
    const labels = ['Rock', 'Paper', 'Scissors'];

    useGameSync(socket, {
        onStateUpdate: (state) => {
            if (state.gameId === 'rps') {
                setPicks(state.picks);
                setReveal(state.reveal);
                setResult(state.result);
                setGameUsers(state.users);
            }
        }
    });

    const opp = participants.find(p => !p.isMe);
    const myPick = picks[myId];
    const oppPick = gameUsers.find(uid => uid !== myId) ? picks[gameUsers.find(uid => uid !== myId)] : null;

    const pick = p => {
        if (myPick) return;
        socket.emit('game-action', { roomId, gameId: 'rps', action: { pick: p } });
    };

    const reset = () => socket.emit('game-reset', { roomId, gameId: 'rps' });

    let resultText = '';
    if (result === 'Draw') resultText = '🤝 Draw!';
    else if (result === myId) resultText = '🎉 You Won!';
    else if (result) resultText = `😢 ${opp?.name || 'Opponent'} Won!`;

    return (
        <div className="rps-container">
            <div className="score-row">
                <ScoreBox label={userName} val={score.me} color="#6c5ce7" />
                <ScoreBox label="Draws" val={score.draws} color="#f59e0b" />
                <ScoreBox label={opp?.name || 'Opp'} val={score.them} color="#ec4899" />
            </div>

            <div className="rps-arena">
                <div className={`rps-side ${myPick ? 'picked' : ''}`}>
                    {reveal ? myPick : (myPick ? '✅' : '?')}
                    <div className="rps-side-label">You</div>
                </div>

                <div className="rps-vs-box">
                    <span className="rps-vs">VS</span>
                </div>

                <div className={`rps-side ${oppPick ? 'picked' : ''}`}>
                    {reveal ? oppPick : (oppPick ? '✅' : '?')}
                    <div className="rps-side-label">{opp?.name || 'Opp'}</div>
                </div>
            </div>

            {result && <div className={`rps-result`}>{resultText}</div>}

            {!myPick && (
                <div className="rps-choices">
                    {choices.map((c, i) => (
                        <button key={c} className="rps-btn" onClick={() => pick(c)}>
                            <span className="rps-emoji">{c}</span>
                            <span className="rps-label">{labels[i]}</span>
                        </button>
                    ))}
                </div>
            )}

            {result && <button className="btn btn-secondary btn-full" onClick={reset}><FiRefreshCw size={13} /> Play Again</button>}
            {myPick && !reveal && <p className="waiting-text">Waiting for {opp?.name || 'opponent'}…</p>}
        </div>
    );
}

/* ─────────────── 4. HANGMAN ─────────────── */
const WORD_LIST = ['ELEPHANT', 'GUITAR', 'MOUNTAIN', 'PLANET', 'OCEAN', 'LIBRARY', 'DIAMOND', 'PENGUIN', 'FESTIVAL', 'UNIVERSE', 'TIGER', 'CASTLE', 'ROCKET', 'BUTTERFLY', 'THUNDER'];
function Hangman({ socket, roomId, myId, userName, participants }) {
    const opp = participants.find(p => !p.isMe);
    const sorted = [...participants].sort((a, b) => a.id.localeCompare(b.id));
    const isSetter = sorted[0]?.id === myId; // setter chooses word

    const [word, setWord] = useState('');
    const [guessed, setGuessed] = useState([]);
    const [wrong, setWrong] = useState(0);
    const [phase, setPhase] = useState('waiting'); // waiting | playing | won | lost
    const [customWord, setCustomWord] = useState('');
    const maxWrong = 6;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    useGameSync(socket, {
        onStateUpdate: (state) => {
            if (state.gameId === 'hangman') {
                // setter logic is currently client-side only
            }
        }
    });

    useEffect(() => {
        if (!word || phase !== 'playing') return;
        const allGuessed = word.split('').every(c => guessed.includes(c));
        if (allGuessed) setPhase('won');
        else if (wrong >= maxWrong) setPhase('lost');
    }, [guessed, wrong, word]);

    const startRandom = () => {
        const w = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        emit(socket, roomId, 'hangman', { type: 'start', word: w });
        setWord(w); setGuessed([]); setWrong(0); setPhase('playing');
    };
    const startCustom = () => {
        if (!customWord.trim()) return;
        const w = customWord.toUpperCase().replace(/[^A-Z]/g, '');
        emit(socket, roomId, 'hangman', { type: 'start', word: w });
        setWord(w); setGuessed([]); setWrong(0); setPhase('playing'); setCustomWord('');
    };
    const guess = l => {
        if (guessed.includes(l) || phase !== 'playing') return;
        setGuessed(g => [...g, l]);
        if (!word.includes(l)) setWrong(w => w + 1);
        emit(socket, roomId, 'hangman', { type: 'guess', letter: l });
    };
    const reset = () => { setWord(''); setGuessed([]); setWrong(0); setPhase('waiting'); emitReset(socket, roomId, 'hangman'); };

    const display = word ? word.split('').map(c => guessed.includes(c) ? c : '_') : [];
    const wrongLetters = guessed.filter(l => word && !word.includes(l));

    return (
        <div className="hangman-container">
            <div className="hangman-drawing">{HANGMAN_SVGS[Math.min(wrong, 6)]}</div>
            {phase === 'waiting' && isSetter && (
                <div className="hangman-setup">
                    <p className="hangman-role">You are the <strong>Word Setter</strong></p>
                    <button className="btn btn-primary btn-full" onClick={startRandom}>🎲 Random Word</button>
                    <div className="hangman-custom">
                        <input className="input" placeholder="Or type a custom word…" value={customWord} onChange={e => setCustomWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && startCustom()} maxLength={15} />
                        <button className="btn btn-secondary" onClick={startCustom}>Set</button>
                    </div>
                </div>
            )}
            {phase === 'waiting' && !isSetter && (
                <div className="hangman-setup"><p className="hangman-role">Waiting for <strong>{opp?.name}</strong> to choose a word…</p></div>
            )}
            {(phase === 'playing' || phase === 'won' || phase === 'lost') && (
                <>
                    <div className="hangman-word">{display.map((c, i) => <span key={i} className="hangman-letter">{c}</span>)}</div>
                    <p className="hangman-wrong">Wrong: <span>{wrongLetters.join(' ') || '—'}</span> ({wrong}/{maxWrong})</p>
                    {phase !== 'playing' && (
                        <div className={`rps-result ${phase}`}>{phase === 'won' ? '🎉 Word Guessed!' : '💀 Game Over! Word: ' + word}</div>
                    )}
                    <div className="hangman-keys">
                        {letters.map(l => (
                            <button key={l} className={`hk-btn ${guessed.includes(l) ? (word.includes(l) ? 'correct' : 'wrong') : ''}`} onClick={() => guess(l)} disabled={guessed.includes(l) || phase !== 'playing'}>
                                {l}
                            </button>
                        ))}
                    </div>
                    {phase !== 'playing' && <button className="btn btn-secondary btn-full" onClick={reset}><FiRefreshCw size={13} /> New Word</button>}
                </>
            )}
        </div>
    );
}
const HANGMAN_SVGS = [
    <svg viewBox="0 0 100 120" className="hg-svg"><line x1="10" y1="115" x2="90" y2="115" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="115" x2="30" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="10" x2="65" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="65" y1="10" x2="65" y2="25" stroke="#6c5ce7" strokeWidth="3" /></svg>,
    <svg viewBox="0 0 100 120" className="hg-svg"><line x1="10" y1="115" x2="90" y2="115" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="115" x2="30" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="10" x2="65" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="65" y1="10" x2="65" y2="25" stroke="#6c5ce7" strokeWidth="3" /><circle cx="65" cy="33" r="8" stroke="#ef4444" strokeWidth="2.5" fill="none" /></svg>,
    <svg viewBox="0 0 100 120" className="hg-svg"><line x1="10" y1="115" x2="90" y2="115" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="115" x2="30" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="10" x2="65" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="65" y1="10" x2="65" y2="25" stroke="#6c5ce7" strokeWidth="3" /><circle cx="65" cy="33" r="8" stroke="#ef4444" strokeWidth="2.5" fill="none" /><line x1="65" y1="41" x2="65" y2="70" stroke="#ef4444" strokeWidth="2.5" /></svg>,
    <svg viewBox="0 0 100 120" className="hg-svg"><line x1="10" y1="115" x2="90" y2="115" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="115" x2="30" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="10" x2="65" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="65" y1="10" x2="65" y2="25" stroke="#6c5ce7" strokeWidth="3" /><circle cx="65" cy="33" r="8" stroke="#ef4444" strokeWidth="2.5" fill="none" /><line x1="65" y1="41" x2="65" y2="70" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="52" x2="50" y2="63" stroke="#ef4444" strokeWidth="2.5" /></svg>,
    <svg viewBox="0 0 100 120" className="hg-svg"><line x1="10" y1="115" x2="90" y2="115" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="115" x2="30" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="10" x2="65" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="65" y1="10" x2="65" y2="25" stroke="#6c5ce7" strokeWidth="3" /><circle cx="65" cy="33" r="8" stroke="#ef4444" strokeWidth="2.5" fill="none" /><line x1="65" y1="41" x2="65" y2="70" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="52" x2="50" y2="63" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="52" x2="80" y2="63" stroke="#ef4444" strokeWidth="2.5" /></svg>,
    <svg viewBox="0 0 100 120" className="hg-svg"><line x1="10" y1="115" x2="90" y2="115" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="115" x2="30" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="10" x2="65" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="65" y1="10" x2="65" y2="25" stroke="#6c5ce7" strokeWidth="3" /><circle cx="65" cy="33" r="8" stroke="#ef4444" strokeWidth="2.5" fill="none" /><line x1="65" y1="41" x2="65" y2="70" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="52" x2="50" y2="63" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="52" x2="80" y2="63" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="70" x2="52" y2="90" stroke="#ef4444" strokeWidth="2.5" /></svg>,
    <svg viewBox="0 0 100 120" className="hg-svg"><line x1="10" y1="115" x2="90" y2="115" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="115" x2="30" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="30" y1="10" x2="65" y2="10" stroke="#6c5ce7" strokeWidth="3" /><line x1="65" y1="10" x2="65" y2="25" stroke="#6c5ce7" strokeWidth="3" /><circle cx="65" cy="33" r="8" stroke="#ef4444" strokeWidth="2.5" fill="none" /><line x1="65" y1="41" x2="65" y2="70" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="52" x2="50" y2="63" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="52" x2="80" y2="63" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="70" x2="52" y2="90" stroke="#ef4444" strokeWidth="2.5" /><line x1="65" y1="70" x2="78" y2="90" stroke="#ef4444" strokeWidth="2.5" /></svg>,
];

/* ─────────────── 5. MEMORY MATCH ─────────────── */
const EMOJI_PAIRS = ['🐶', '🐱', '🐸', '🦊', '🐧', '🦁', '🐨', '🐯', '🦄', '🐙', '🦋', '🌸', '🍕', '🎸', '⚽'];
function Memory({ socket, roomId, myId, userName, participants }) {
    const opp = participants.find(p => !p.isMe);
    const makeCards = () => {
        const pairs = EMOJI_PAIRS.slice(0, 8);
        const deck = [...pairs, ...pairs].map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false }));
        for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; }
        return deck;
    };
    const [cards, setCards] = useState(makeCards);
    const [flipped, setFlipped] = useState([]);
    const [myScore, setMyScore] = useState(0);
    const [themScore, setThemScore] = useState(0);

    // who's turn: alternates, my turn if myScore+themScore is even and I have lower id
    const sorted = [...participants].sort((a, b) => a.id.localeCompare(b.id));
    const iFirst = sorted[0]?.id === myId;
    const totalMatched = myScore + themScore;
    const isMyTurn = (totalMatched % 2 === 0) === iFirst;

    useGameSync(socket, {
        onStateUpdate: (state) => {
            if (state.gameId === 'memory') {
                // memory logic is currently client-side only
            }
        }
    });

    const flip = idx => {
        if (!isMyTurn || cards[idx].flipped || cards[idx].matched || flipped.length >= 2) return;
        const nf = [...flipped, idx];
        setCards(cs => { const nc = [...cs]; nc[idx] = { ...nc[idx], flipped: true }; return nc; });
        emit(socket, roomId, 'memory', { type: 'flip', idx });
        if (nf.length === 2) {
            setFlipped([]);
            const [a, b] = nf;
            setTimeout(() => {
                setCards(cs => {
                    const nc = [...cs];
                    if (nc[a].emoji === nc[b].emoji) { nc[a] = { ...nc[a], matched: true }; nc[b] = { ...nc[b], matched: true }; setMyScore(s => s + 1); }
                    else { nc[a] = { ...nc[a], flipped: false }; nc[b] = { ...nc[b], flipped: false }; }
                    return nc;
                });
            }, 900);
        } else setFlipped(nf);
    };
    const reset = () => { setCards(makeCards()); setFlipped([]); setMyScore(0); setThemScore(0); emitReset(socket, roomId, 'memory'); };

    return (
        <div className="memory-container">
            <div className="score-row">
                <ScoreBox label={userName} val={myScore} color="#6c5ce7" />
                <ScoreBox label={opp?.name || 'Opp'} val={themScore} color="#ec4899" />
            </div>
            <div className="ttt-status"><span className="ttt-turn">{isMyTurn ? 'Your turn' : 'Opponent\'s turn…'}</span></div>
            <div className="memory-grid">
                {cards.map((c, i) => (
                    <button key={i} className={`mem-card ${(c.flipped || c.matched) ? 'revealed' : ''} ${c.matched ? 'matched' : ''}`} onClick={() => flip(i)}>
                        {(c.flipped || c.matched) ? <span className="mem-emoji">{c.emoji}</span> : <span className="mem-back">?</span>}
                    </button>
                ))}
            </div>
            {myScore + themScore === 8 && <button className="btn btn-secondary btn-full" onClick={reset}><FiRefreshCw size={13} /> Play Again</button>}
        </div>
    );
}

/* shared sub-components */
function PlayerChip({ name, symbol, active, color }) {
    return (
        <div className={`ttt-player ${active ? 'active' : ''}`} style={active ? { borderColor: color, background: `${color}15` } : {}}>
            <div className="ttt-player-avatar" style={{ background: color }}>{(name || '?')[0].toUpperCase()}</div>
            <span className="ttt-player-name">{name}</span>
            <span className="ttt-player-symbol">{symbol}</span>
        </div>
    );
}
function ScoreBox({ label, val, color }) {
    return (
        <div className="ttt-score">
            <span className="score-label" style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <span className="score-value" style={{ color }}>{val}</span>
        </div>
    );
}

/* ─────────────── 6. NUMBER GUESS ─────────────── */
function NumGuess({ socket, roomId, myId, userName, participants }) {
    const opp = participants.find(p => !p.isMe);
    const sorted = [...participants].sort((a, b) => a.id.localeCompare(b.id));
    const isHost = sorted[0]?.id === myId;

    const [secret, setSecret] = useState(null);
    const [guess, setGuessVal] = useState('');
    const [myGuesses, setMyGuesses] = useState([]);
    const [theirGuesses, setTheirGuesses] = useState([]);
    const [myDone, setMyDone] = useState(false);
    const [theirDone, setTheirDone] = useState(false);

    useEffect(() => {
        if (isHost && !secret) {
            const n = Math.floor(Math.random() * 100) + 1;
            setSecret(n);
            emit(socket, roomId, 'numguess', { type: 'secret', n });
        }
    }, [isHost]);

    useGameSync(socket, {
        onStateUpdate: (state) => {
            if (state.gameId === 'numguess') {
                // numguess logic is currently client-side only
            }
        }
    });

    const submit = () => {
        if (!guess || myDone || !secret) return;
        const g = parseInt(guess);
        if (isNaN(g) || g < 1 || g > 100) return;
        const diff = Math.abs(g - secret);
        const hint = diff === 0 ? '🎯 Exact!' : g < secret ? `⬆️ Higher (off by ${diff})` : `⬇️ Lower (off by ${diff})`;
        setMyGuesses(prev => [...prev, { val: g, hint }]);
        emit(socket, roomId, 'numguess', { type: 'guess', g });
        setGuessVal('');
        if (diff === 0) setMyDone(true);
    };

    const reset = () => {
        setSecret(null); setGuessVal(''); setMyGuesses([]); setTheirGuesses([]);
        setMyDone(false); setTheirDone(false);
        emitReset(socket, roomId, 'numguess');
    };

    const myWon = myDone && myGuesses.length <= (theirDone ? theirGuesses.length : Infinity);

    return (
        <div className="numguess-container">
            <p className="numguess-desc">Both players guess the same secret number (1–100). Fewest guesses wins!</p>
            <div className="ng-cols">
                <div className="ng-col">
                    <h4 className="ng-col-title">You ({myGuesses.length} guesses)</h4>
                    <div className="ng-log">
                        {myGuesses.map((g, i) => <div key={i} className={`ng-entry ${g.hint.startsWith('🎯') ? 'exact' : ''}`}><strong>{g.val}</strong> — {g.hint}</div>)}
                    </div>
                    {!myDone && (
                        <div className="ng-input-row">
                            <input className="input" type="number" min={1} max={100} value={guess} onChange={e => setGuessVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="1–100" />
                            <button className="btn btn-primary" onClick={submit}>Guess</button>
                        </div>
                    )}
                    {myDone && <div className="rps-result win">🎉 Guessed in {myGuesses.length}!</div>}
                </div>
                <div className="ng-col">
                    <h4 className="ng-col-title">{opp?.name || 'Opp'} ({theirGuesses.length} guesses)</h4>
                    <div className="ng-log">
                        {theirGuesses.map((g, i) => <div key={i} className={`ng-entry ${g.hint.startsWith('🎯') ? 'exact' : ''}`}><strong>{g.val}</strong> — {g.hint}</div>)}
                    </div>
                    {theirDone && <div className="rps-result lose">Guessed in {theirGuesses.length}!</div>}
                </div>
            </div>
            {(myDone || theirDone) && <button className="btn btn-secondary btn-full" onClick={reset}><FiRefreshCw size={13} /> New Round</button>}
        </div>
    );
}

/* ─────────────── 7. MATH BLITZ ─────────────── */
function genQ() {
    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * 3)];
    let a, b, ans;
    if (op === '+') { a = Math.floor(Math.random() * 50) + 1; b = Math.floor(Math.random() * 50) + 1; ans = a + b; }
    else if (op === '-') { a = Math.floor(Math.random() * 50) + 10; b = Math.floor(Math.random() * a); ans = a - b; }
    else { a = Math.floor(Math.random() * 12) + 1; b = Math.floor(Math.random() * 12) + 1; ans = a * b; }
    return { q: `${a} ${op} ${b}`, ans };
}

function MathQuiz({ socket, roomId, myId, userName, participants }) {
    const opp = participants.find(p => !p.isMe);
    const sorted = [...participants].sort((a, b) => a.id.localeCompare(b.id));
    const isHost = sorted[0]?.id === myId;

    const [question, setQuestion] = useState(null);
    const [ans, setAns] = useState('');
    const [myScore, setMyScore] = useState(0);
    const [theirScore, setTheirScore] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [round, setRound] = useState(0);
    const MAX_ROUNDS = 10;

    useEffect(() => {
        if (isHost && round === 0) nextQ(true);
    }, [isHost]);

    const nextQ = (first = false) => {
        const q = genQ();
        setQuestion(q);
        setAns('');
        setFeedback(null);
        if (!first) emit(socket, roomId, 'mathquiz', { type: 'question', ...q });
    };

    useGameSync(socket, {
        onStateUpdate: (state) => {
            if (state.gameId === 'mathquiz') {
                // mathquiz logic is currently client-side only
            }
        }
    });

    const submit = () => {
        if (!question || feedback) return;
        if (parseInt(ans) === question.ans) {
            setFeedback('correct');
            setMyScore(s => s + 1);
            emit(socket, roomId, 'mathquiz', { type: 'answer', by: myId });
            const nextRound = round + 1;
            setRound(nextRound);
            if (isHost && nextRound < MAX_ROUNDS) setTimeout(() => nextQ(), 1200);
        } else {
            setFeedback('wrong');
        }
    };

    const done = round >= MAX_ROUNDS;

    return (
        <div className="mathquiz-container">
            <div className="score-row">
                <ScoreBox label={userName} val={myScore} color="#6c5ce7" />
                <ScoreBox label={`Round ${Math.min(round + 1, MAX_ROUNDS)}/${MAX_ROUNDS}`} val="⚡" color="#f59e0b" />
                <ScoreBox label={opp?.name || 'Opp'} val={theirScore} color="#ec4899" />
            </div>
            {question && !done && (
                <div className="mq-card">
                    <div className="mq-question">{question.q} = ?</div>
                    <div className="mq-input-row">
                        <input className={`input mq-input ${feedback === 'correct' ? 'correct' : feedback === 'wrong' ? 'wrong' : ''}`} type="number" value={ans} onChange={e => setAns(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Answer…" autoFocus />
                        <button className="btn btn-primary" onClick={submit}>✓</button>
                    </div>
                    {feedback && <div className={`mq-feedback ${feedback}`}>{feedback === 'correct' ? '✅ Correct!' : '❌ Try again…'}</div>}
                </div>
            )}
            {done && (
                <>
                    <div className={`rps-result ${myScore > theirScore ? 'win' : myScore < theirScore ? 'lose' : 'draw'}`}>
                        {myScore > theirScore ? '🏆 You Win!' : myScore < theirScore ? '😢 You Lose!' : '🤝 Draw!'}
                    </div>
                    <button className="btn btn-secondary btn-full" onClick={() => { setMyScore(0); setTheirScore(0); setRound(0); emitReset(socket, roomId, 'mathquiz'); if (isHost) nextQ(true); }}>
                        <FiRefreshCw size={13} /> New Game
                    </button>
                </>
            )}
        </div>
    );
}

/* ─────────────── 8. WORD CHAIN ─────────────── */
function WordChain({ socket, roomId, myId, userName, participants }) {
    const opp = participants.find(p => !p.isMe);
    const sorted = [...participants].sort((a, b) => a.id.localeCompare(b.id));
    const iFirst = sorted[0]?.id === myId;

    const [chain, setChain] = useState([]);
    const [input, setInput] = useState('');
    const [myTurn, setMyTurn] = useState(iFirst);
    const [error, setError] = useState('');

    useGameSync(socket, {
        onStateUpdate: (state) => {
            if (state.gameId === 'wordchain') {
                // wordchain logic is currently client-side only
            }
        }
    });

    const submit = () => {
        const w = input.trim().toUpperCase();
        if (!w) return;
        const last = chain[chain.length - 1];
        if (last && w[0] !== last.word[last.word.length - 1]) {
            setError(`Must start with "${last.word[last.word.length - 1]}"`); return;
        }
        if (chain.some(c => c.word === w)) { setError('Word already used!'); return; }
        setError('');
        setChain(c => [...c, { word: w, who: userName }]);
        setMyTurn(false);
        emit(socket, roomId, 'wordchain', { type: 'word', word: w, who: userName });
        setInput('');
    };

    const lastLetter = chain.length ? chain[chain.length - 1].word.slice(-1) : null;

    return (
        <div className="wordchain-container">
            <p className="numguess-desc">Each word must start with the last letter of the previous word. No repeats!</p>
            {lastLetter && <div className="wc-hint">Next word must start with: <strong className="wc-letter">{lastLetter}</strong></div>}
            {error && <div className="wc-error">{error}</div>}
            <div className="wc-chain">
                {chain.map((c, i) => (
                    <span key={i} className={`wc-word ${c.who === userName ? 'mine' : 'theirs'}`} title={c.who}>{c.word}</span>
                ))}
                {chain.length === 0 && <span className="wc-empty">Be the first to start the chain!</span>}
            </div>
            <div className="ttt-status"><span className="ttt-turn">{myTurn ? 'Your turn' : `${opp?.name || 'Opponent'}'s turn…`}</span></div>
            {myTurn && (
                <div className="ng-input-row">
                    <input className="input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder={lastLetter ? `Starts with ${lastLetter}…` : 'Any word…'} autoFocus />
                    <button className="btn btn-primary" onClick={submit}>Add</button>
                </div>
            )}
            <button className="btn btn-secondary" onClick={() => { setChain([]); setInput(''); setMyTurn(iFirst); setError(''); emitReset(socket, roomId, 'wordchain'); }}>
                <FiRefreshCw size={13} /> Reset
            </button>
        </div>
    );
}

/* ─────────────── 9. DRAW TOGETHER ─────────────── */
function DrawTogether({ socket, roomId, myId, userName }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#6c5ce7');
    const [brushSize, setBrushSize] = useState(3);
    const [isEraser, setIsEraser] = useState(false);
    const lastPos = useRef(null);
    const COLORS = ['#6c5ce7', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4', '#ffffff', '#64748b'];

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const resize = () => { const w = canvas.parentElement; canvas.width = w.offsetWidth; canvas.height = w.offsetHeight; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#1a1a3e'; ctx.fillRect(0, 0, canvas.width, canvas.height); };
        resize(); window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    useGameSync(socket, 'drawing', {
        onUpdate: (action) => { if (action.type === 'draw') drawLine(action.from, action.to, action.color, action.size); },
        onReset: () => { const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d'); ctx.fillStyle = '#1a1a3e'; ctx.fillRect(0, 0, c.width, c.height); }
    });

    const drawLine = (from, to, c, s) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = c; ctx.lineWidth = s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    };
    const getPos = e => { const r = canvasRef.current.getBoundingClientRect(); const cx = e.touches ? e.touches[0].clientX : e.clientX; const cy = e.touches ? e.touches[0].clientY : e.clientY; return { x: cx - r.left, y: cy - r.top }; };
    const handleStart = e => { setIsDrawing(true); lastPos.current = getPos(e); };
    const handleMove = e => {
        if (!isDrawing) return; e.preventDefault();
        const cur = getPos(e); const dc = isEraser ? '#1a1a3e' : color;
        drawLine(lastPos.current, cur, dc, brushSize);
        socket.emit('game-action', { roomId, gameType: 'drawing', action: { type: 'draw', from: lastPos.current, to: cur, color: dc, size: brushSize } });
        lastPos.current = cur;
    };
    const handleEnd = () => { setIsDrawing(false); lastPos.current = null; };
    const clearAll = () => { const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d'); ctx.fillStyle = '#1a1a3e'; ctx.fillRect(0, 0, c.width, c.height); socket.emit('game-reset', { roomId, gameType: 'drawing' }); };

    return (
        <div className="draw-container">
            <div className="draw-toolbar">
                <div className="color-picker">{COLORS.map(c => <button key={c} className={`color-swatch ${color === c && !isEraser ? 'active' : ''}`} style={{ background: c }} onClick={() => { setColor(c); setIsEraser(false); }} />)}</div>
                <div className="draw-tools-row">
                    <input type="range" min={1} max={20} value={brushSize} onChange={e => setBrushSize(+e.target.value)} className="brush-slider" />
                    <span className="brush-label">{brushSize}px</span>
                    <button className={`btn btn-icon-sm ${isEraser ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIsEraser(e => !e)} title="Eraser">🧹</button>
                    <button className="btn btn-icon-sm btn-secondary" onClick={clearAll} title="Clear"><FiTrash2 size={13} /></button>
                </div>
            </div>
            <div className="draw-canvas-wrapper">
                <canvas ref={canvasRef} className="draw-canvas" onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd} onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd} />
            </div>
        </div>
    );
}

/* ─────────────── 10. DICE ROLL ─────────────── */
function DiceRoll({ socket, roomId, myId, userName, participants }) {
    const opp = participants.find(p => !p.isMe);
    const [myRoll, setMyRoll] = useState(null);
    const [theirRoll, setTheirRoll] = useState(null);
    const [rolling, setRolling] = useState(false);
    const [score, setScore] = useState({ me: 0, them: 0 });
    const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    useGameSync(socket, 'dice', {
        onUpdate: (action) => { if (action.type === 'roll') setTheirRoll(action.val); },
        onReset: () => { setMyRoll(null); setTheirRoll(null); }
    });

    useEffect(() => {
        if (myRoll !== null && theirRoll !== null) {
            if (myRoll > theirRoll) setScore(s => ({ ...s, me: s.me + 1 }));
            else if (theirRoll > myRoll) setScore(s => ({ ...s, them: s.them + 1 }));
        }
    }, [myRoll, theirRoll]);

    const roll = () => {
        if (myRoll !== null || rolling) return;
        setRolling(true);
        setTimeout(() => {
            const val = Math.floor(Math.random() * 6) + 1;
            setMyRoll(val); setRolling(false);
            emit(socket, roomId, 'dice', { type: 'roll', val });
        }, 700);
    };

    const reset = () => { setMyRoll(null); setTheirRoll(null); emitReset(socket, roomId, 'dice'); };
    const result = myRoll !== null && theirRoll !== null;

    return (
        <div className="dice-container">
            <div className="score-row">
                <ScoreBox label={userName} val={score.me} color="#6c5ce7" />
                <ScoreBox label={opp?.name || 'Opp'} val={score.them} color="#ec4899" />
            </div>
            <div className="dice-arena">
                <div className="dice-side">
                    <div className={`dice-face ${rolling ? 'rolling' : ''}`}>{myRoll !== null ? FACES[myRoll - 1] : '🎲'}</div>
                    <span className="dice-label">{userName}</span>
                </div>
                <div className="dice-side">
                    <div className="dice-face">{theirRoll !== null ? FACES[theirRoll - 1] : (myRoll ? '⏳' : '🎲')}</div>
                    <span className="dice-label">{opp?.name || 'Opp'}</span>
                </div>
            </div>
            {result && (
                <div className={`rps-result ${myRoll > theirRoll ? 'win' : myRoll < theirRoll ? 'lose' : 'draw'}`}>
                    {myRoll > theirRoll ? '🎉 You Win!' : myRoll < theirRoll ? '😢 They Win!' : '🤝 Tie!'}
                </div>
            )}
            {!myRoll && <button className="btn btn-primary btn-full" onClick={roll} disabled={rolling}>{rolling ? 'Rolling…' : '🎲 Roll Dice'}</button>}
            {result && <button className="btn btn-secondary btn-full" onClick={reset}><FiRefreshCw size={13} /> Roll Again</button>}
        </div>
    );
}

/* ─────────────── 11. COIN FLIP ─────────────── */
function CoinFlip({ socket, roomId, myId, userName, participants }) {
    const opp = participants.find(p => !p.isMe);
    const sorted = [...participants].sort((a, b) => a.id.localeCompare(b.id));
    const isCaller = sorted[0]?.id === myId;

    const [call, setCall] = useState(null);
    const [result, setResult] = useState(null);
    const [flipping, setFlipping] = useState(false);
    const [score, setScore] = useState({ me: 0, them: 0 });

    useGameSync(socket, 'coin', {
        onUpdate: (action) => {
            if (action.type === 'call') {
                const res = Math.random() < 0.5 ? 'Heads' : 'Tails';
                setResult(res);
                const won = (action.call === res) === isCaller;
                if (!isCaller) { if (action.call === res) setScore(s => ({ ...s, them: s.them + 1 })); else setScore(s => ({ ...s, me: s.me + 1 })); }
                emit(socket, roomId, 'coin', { type: 'flip', result: res });
            }
            if (action.type === 'flip') { setResult(action.result); }
        },
        onReset: () => { setCall(null); setResult(null); }
    });

    const makeCall = (c) => {
        if (call || result) return;
        setCall(c); setFlipping(true);
        setTimeout(() => {
            const res = Math.random() < 0.5 ? 'Heads' : 'Tails';
            setResult(res); setFlipping(false);
            emit(socket, roomId, 'coin', { type: 'call', call: c });
            if (c === res) setScore(s => ({ ...s, me: s.me + 1 }));
            else setScore(s => ({ ...s, them: s.them + 1 }));
        }, 1200);
    };

    const reset = () => { setCall(null); setResult(null); setFlipping(false); emitReset(socket, roomId, 'coin'); };

    return (
        <div className="coin-container">
            <div className="score-row">
                <ScoreBox label={userName} val={score.me} color="#6c5ce7" />
                <ScoreBox label={opp?.name || 'Opp'} val={score.them} color="#ec4899" />
            </div>
            <div className={`coin-display ${flipping ? 'flipping' : ''}`}>{result ? result === 'Heads' ? '🪙 H' : '🪙 T' : '🪙'}</div>
            {isCaller && !call && !result && (
                <>
                    <p className="numguess-desc">You get to call it — Heads or Tails?</p>
                    <div className="coin-btns">
                        <button className="btn btn-primary" onClick={() => makeCall('Heads')}>Heads</button>
                        <button className="btn btn-secondary" onClick={() => makeCall('Tails')}>Tails</button>
                    </div>
                </>
            )}
            {!isCaller && !result && <p className="waiting-text">Waiting for {opp?.name || 'caller'} to call…</p>}
            {result && !flipping && (
                <>
                    <div className="coin-result-big">{result}</div>
                    <div className={`rps-result ${call === result || (!isCaller && !(result === 'Heads' && call === 'Tails')) ? 'win' : 'lose'}`}>
                        {call === result ? '🎉 You called it!' : result ? '😢 Wrong call!' : ''}
                    </div>
                    <button className="btn btn-secondary btn-full" onClick={reset}><FiRefreshCw size={13} /> Flip Again</button>
                </>
            )}
        </div>
    );
}

/* ─────────────── 12. SNAKE ─────────────── */
const GRID = 20;
function Snake({ socket, roomId, myId, userName, participants }) {
    const opp = participants.find(p => !p.isMe);
    const canvasRef = useRef(null);
    const gameRef = useRef({ snake: [{ x: 10, y: 10 }], dir: { x: 1, y: 0 }, food: { x: 5, y: 5 }, score: 0, alive: true, loop: null });
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState({ name: '', val: 0 });
    const [alive, setAlive] = useState(true);
    const [started, setStarted] = useState(false);

    useGameSync(socket, 'snake', {
        onUpdate: (action) => {
            if (action.type === 'score') {
                setHighScore(prev => action.val > prev.val ? { name: action.who, val: action.val } : prev);
            }
        }
    });

    const draw = () => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d'); const g = gameRef.current;
        const cell = canvas.width / GRID;
        ctx.fillStyle = '#0d0d2b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        // food
        ctx.font = `${cell}px serif`; ctx.fillText('🍎', g.food.x * cell, (g.food.y + 1) * cell);
        // snake
        g.snake.forEach((s, i) => { ctx.fillStyle = i === 0 ? '#6c5ce7' : '#a855f7'; ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2); ctx.beginPath(); ctx.arc(s.x * cell + cell / 2, s.y * cell + cell / 2, (cell - 4) / 2, 0, 2 * Math.PI); ctx.fill(); });
    };

    const tick = () => {
        const g = gameRef.current; if (!g.alive) return;
        const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y };
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID || g.snake.some(s => s.x === head.x && s.y === head.y)) {
            g.alive = false; setAlive(false);
            emit(socket, roomId, 'snake', { type: 'score', val: g.score, who: userName });
            return;
        }
        g.snake.unshift(head);
        if (head.x === g.food.x && head.y === g.food.y) {
            g.score += 1; setScore(g.score);
            g.food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        } else g.snake.pop();
        draw();
    };

    const start = () => {
        const g = gameRef.current;
        g.snake = [{ x: 10, y: 10 }]; g.dir = { x: 1, y: 0 };
        g.food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        g.score = 0; g.alive = true;
        setScore(0); setAlive(true); setStarted(true);
        clearInterval(g.loop); g.loop = setInterval(tick, 150);
    };

    useEffect(() => {
        const handler = e => {
            const g = gameRef.current;
            if (!g.alive) return;
            const map = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };
            const nd = map[e.key]; if (!nd) return;
            if (nd.x !== -g.dir.x || nd.y !== -g.dir.y) g.dir = nd;
            e.preventDefault();
        };
        window.addEventListener('keydown', handler);
        return () => { window.removeEventListener('keydown', handler); clearInterval(gameRef.current.loop); };
    }, []);

    useEffect(() => { if (started) draw(); }, [started]);

    return (
        <div className="snake-container">
            <div className="score-row" style={{ justifyContent: 'center', gap: 32 }}>
                <ScoreBox label="Score" val={score} color="#6c5ce7" />
                {highScore.val > 0 && <ScoreBox label={`🏆 ${highScore.name}`} val={highScore.val} color="#f59e0b" />}
            </div>
            <canvas ref={canvasRef} width={240} height={240} className="snake-canvas" />
            <div className="snake-dpad">
                <button className="dpad-btn" onClick={() => { gameRef.current.dir = { x: 0, y: -1 } }}>▲</button>
                <div className="dpad-row">
                    <button className="dpad-btn" onClick={() => { gameRef.current.dir = { x: -1, y: 0 } }}>◀</button>
                    <button className="dpad-btn" onClick={() => { gameRef.current.dir = { x: 0, y: 1 } }}>▼</button>
                    <button className="dpad-btn" onClick={() => { gameRef.current.dir = { x: 1, y: 0 } }}>▶</button>
                </div>
            </div>
            {!started && <button className="btn btn-primary btn-full" onClick={start}>🐍 Start Game</button>}
            {started && !alive && <button className="btn btn-secondary btn-full" onClick={start}><FiRefreshCw size={13} /> Try Again</button>}
            <p className="snake-hint">Use arrow keys or WASD or D-pad</p>
        </div>
    );
}

