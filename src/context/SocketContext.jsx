import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://vc-production-eb7c.up.railway.app';

export function SocketProvider({ children }) {
    const [socket, setSocket] = useState(null);
    const [myId, setMyId] = useState('');
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        console.log('Attempting to connect to socket server at:', SERVER_URL);
        const newSocket = io(SERVER_URL, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        newSocket.on('connect', () => {
            setConnected(true);
            console.log('Connected to server');
        });

        newSocket.on('me', (id) => {
            setMyId(id);
        });

        newSocket.on('disconnect', () => {
            setConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, myId, connected }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
}
