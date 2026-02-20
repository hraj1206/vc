const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vc-sand-delta.vercel.app';

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    maxHttpBufferSize: 50e6 // 50MB for file sharing
});

app.use(cors());
app.get('/', (req, res) => res.send('VideoChat Server Running'));

// Room management
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.emit('me', socket.id);

    // ── Room Management ──
    socket.on('create-room', (callback) => {
        const roomId = generateRoomId();
        rooms.set(roomId, {
            users: [{ id: socket.id, name: socket.userName || 'Creator' }],
            messages: [],
            watchUrl: '',
            gameState: null
        });
        socket.join(roomId);
        socket.roomId = roomId;
        callback(roomId);
        console.log(`Room created: ${roomId}`);
    });

    socket.on('join-room', ({ roomId, userName }, callback) => {
        const room = rooms.get(roomId);
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }
        if (room.users.length >= 10) {
            callback({ error: 'Room is full (max 10)' });
            return;
        }

        // Avoid duplicate users
        const exists = room.users.find(u => u.id === socket.id);
        if (!exists) {
            room.users.push({ id: socket.id, name: userName });
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.userName = userName;

        // Notify others in the room
        socket.to(roomId).emit('user-joined', {
            userId: socket.id,
            userName: userName
        });

        callback({
            success: true,
            users: room.users.filter(u => u.id !== socket.id),
            messages: room.messages,
            gameState: room.gameState
        });
        console.log(`${userName} joined room: ${roomId}`);
    });

    // ── WebRTC Signaling ──
    socket.on('call-user', ({ userToCall, signalData, from, userName }) => {
        io.to(userToCall).emit('incoming-call', {
            signal: signalData,
            from,
            userName
        });
    });

    socket.on('answer-call', ({ to, signal }) => {
        io.to(to).emit('call-accepted', { signal, from: socket.id });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
        io.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

    // ── Text Chat ──
    socket.on('send-message', ({ roomId, message, userName }) => {
        const msg = {
            id: Date.now(),
            text: message,
            userName,
            userId: socket.id,
            timestamp: new Date().toISOString()
        };
        const room = rooms.get(roomId);
        if (room) {
            room.messages.push(msg);
            if (room.messages.length > 200) room.messages.shift();
        }
        io.in(roomId).emit('new-message', msg);
    });

    // ── File Sharing ──
    socket.on('file-share', ({ roomId, fileName, fileType, fileSize, fileData }) => {
        socket.to(roomId).emit('file-received', {
            from: socket.id,
            fromName: socket.userName || 'Anonymous',
            fileName,
            fileType,
            fileSize,
            fileData
        });
    });

    // ── Watch Together ──
    socket.on('watch-sync', ({ roomId, url }) => {
        const room = rooms.get(roomId);
        if (room) room.watchUrl = url;
        socket.to(roomId).emit('watch-update', { url, from: socket.userName });
    });

    socket.on('watch-control', ({ roomId, action, time }) => {
        socket.to(roomId).emit('watch-control', { action, time, from: socket.userName });
    });

    // ── Games ──
    const initGame = (gameId, roomId) => {
        const room = rooms.get(roomId);
        if (!room) return null;

        let state = { gameId, users: room.users.slice(0, 2).map(u => u.id) };

        if (gameId === 'tictactoe') {
            state = { ...state, board: Array(9).fill(null), xTurn: true, winner: null };
        } else if (gameId === 'rps') {
            state = { ...state, picks: {}, result: null, reveal: false };
        } else if (gameId === 'connect4') {
            state = { ...state, board: Array(6).fill(null).map(() => Array(7).fill(null)), rTurn: true, winner: null };
        }

        room.gameState = state;
        return state;
    };

    socket.on('game-action', ({ roomId, gameId, action }) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameState) return;

        let state = room.gameState;

        // 1. TIC-TAC-TOE Server Logic
        if (gameId === 'tictactoe') {
            if (state.winner || state.board[action.i]) return;
            const mySymbol = state.users[0] === socket.id ? 'X' : 'O';
            const isMyTurn = (state.xTurn && mySymbol === 'X') || (!state.xTurn && mySymbol === 'O');
            if (!isMyTurn) return;

            state.board[action.i] = mySymbol;
            state.xTurn = !state.xTurn;

            // Check winner on server
            const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
            for (let line of lines) {
                const [a, b, c] = line;
                if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
                    state.winner = state.board[a];
                    break;
                }
            }
            if (!state.winner && state.board.every(b => b)) state.winner = 'Draw';
        }

        // 2. RPS Server Logic (Secret Picks)
        if (gameId === 'rps') {
            if (state.picks[socket.id]) return; // already picked
            state.picks[socket.id] = action.pick;

            const players = state.users;
            if (state.picks[players[0]] && state.picks[players[1]]) {
                state.reveal = true;
                // Calculate winner
                const p1 = state.picks[players[0]], p2 = state.picks[players[1]];
                if (p1 === p2) state.result = 'Draw';
                else {
                    const ci = ['✊', '✋', '✌️'];
                    const i1 = ci.indexOf(p1), i2 = ci.indexOf(p2);
                    state.result = ((i1 - i2 + 3) % 3 === 1) ? players[0] : players[1];
                }
            }
        }

        // 3. CONNECT FOUR Server Logic
        if (gameId === 'connect4') {
            if (state.winner) return;
            const myColor = state.users[0] === socket.id ? 'R' : 'Y';
            const isMyTurn = (state.rTurn && myColor === 'R') || (!state.rTurn && myColor === 'Y');
            if (!isMyTurn) return;

            // Find lowest available row in column action.c
            let row = -1;
            for (let r = 5; r >= 0; r--) {
                if (!state.board[r][action.c]) {
                    row = r;
                    break;
                }
            }
            if (row === -1) return; // Column full

            state.board[row][action.c] = myColor;
            state.rTurn = !state.rTurn;

            // Check winner
            const R = 6, C = 7;
            const check = (r, c, dr, dc, color) => {
                for (let i = 0; i < 4; i++) {
                    const nr = r + dr * i, nc = c + dc * i;
                    if (nr < 0 || nr >= R || nc < 0 || nc >= C || state.board[nr][nc] !== color) return false;
                }
                return true;
            };

            let foundWinner = false;
            for (let r = 0; r < R; r++) {
                for (let c = 0; c < C; c++) {
                    for (const color of ['R', 'Y']) {
                        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
                            if (check(r, c, dr, dc, color)) {
                                state.winner = color;
                                foundWinner = true;
                                break;
                            }
                        }
                        if (foundWinner) break;
                    }
                    if (foundWinner) break;
                }
                if (foundWinner) break;
            }
            if (!state.winner && state.board.every(row => row.every(c => c))) state.winner = 'Draw';
        }

        room.gameState = state;
        io.in(roomId).emit('game-state-update', state);
    });

    socket.on('game-reset', ({ roomId, gameId }) => {
        const newState = initGame(gameId, roomId);
        io.in(roomId).emit('game-state-update', newState);
    });

    socket.on('game-invite', (data) => {
        socket.to(data.roomId).emit('game-invite', {
            gameId: data.gameId,
            fromName: data.fromName,
            fromId: data.fromId
        });
    });

    socket.on('game-accept', (data) => {
        const state = initGame(data.gameId, data.roomId);
        io.to(data.roomId).emit('game-sync-start', {
            action: 'start-sync',
            gameId: data.gameId,
            gameState: state
        });
    });

    // ── Screen Share ──
    socket.on('screen-share-started', ({ roomId }) => {
        socket.to(roomId).emit('screen-share-started', { from: socket.id, fromName: socket.userName });
    });

    socket.on('screen-share-stopped', ({ roomId }) => {
        socket.to(roomId).emit('screen-share-stopped', { from: socket.id });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (socket.roomId) {
            const room = rooms.get(socket.roomId);
            if (room) {
                room.users = room.users.filter(u => u.id !== socket.id);
                socket.to(socket.roomId).emit('user-left', {
                    userId: socket.id,
                    userName: socket.userName
                });
                if (room.users.length === 0) {
                    rooms.delete(socket.roomId);
                    console.log(`Room deleted: ${socket.roomId}`);
                }
            }
        }
    });
});

function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// server/index.js
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => { // <--- '0.0.0.0' zaroor add karein
    console.log(`🚀 Server running on port ${PORT}`);
});