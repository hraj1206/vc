const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGIN,
        methods: ['GET', 'POST']
    },
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
            users: [socket.id],
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
        room.users.push(socket.id);
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
            users: room.users.filter(u => u !== socket.id),
            messages: room.messages
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
    socket.on('game-action', ({ roomId, gameType, action }) => {
        socket.to(roomId).emit('game-update', {
            gameType,
            action,
            from: socket.id,
            fromName: socket.userName
        });
    });

    socket.on('game-reset', ({ roomId, gameType }) => {
        socket.to(roomId).emit('game-reset', { gameType });
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
                room.users = room.users.filter(u => u !== socket.id);
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 VideoChat server running on http://localhost:${PORT}`);
});
