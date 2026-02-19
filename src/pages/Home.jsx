import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { FiVideo, FiUsers, FiMonitor, FiFile, FiPlay, FiZap, FiArrowRight, FiCopy, FiCheck } from 'react-icons/fi';
import { SiGamejolt } from 'react-icons/si';
import './Home.css';

function Home() {
    const { socket, connected } = useSocket();
    const navigate = useNavigate();
    const [userName, setUserName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [createdRoom, setCreatedRoom] = useState('');
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState('create');
    const [error, setError] = useState('');

    const createRoom = () => {
        if (!userName.trim()) {
            setError('Please enter your name');
            return;
        }
        setError('');
        socket.emit('create-room', (roomId) => {
            setCreatedRoom(roomId);
        });
    };

    const joinRoom = () => {
        if (!userName.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!joinCode.trim()) {
            setError('Please enter a room code');
            return;
        }
        setError('');
        socket.emit('join-room', { roomId: joinCode.toUpperCase(), userName }, (response) => {
            if (response.error) {
                setError(response.error);
            } else {
                navigate(`/room/${joinCode.toUpperCase()}`, { state: { userName } });
            }
        });
    };

    const enterCreatedRoom = () => {
        socket.emit('join-room', { roomId: createdRoom, userName }, () => { });
        navigate(`/room/${createdRoom}`, { state: { userName } });
    };

    const copyCode = () => {
        navigator.clipboard.writeText(createdRoom);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const features = [
        { icon: <FiVideo />, title: 'Video Calls', desc: 'Crystal clear HD video with low latency', color: '#6c5ce7' },
        { icon: <FiMonitor />, title: 'Screen Share', desc: 'Share your screen instantly with everyone', color: '#a855f7' },
        { icon: <FiPlay />, title: 'Watch Together', desc: 'Sync YouTube videos and watch as a group', color: '#ec4899' },
        { icon: <SiGamejolt />, title: 'Play Games', desc: 'Tic-tac-toe, drawing, and more mini games', color: '#f59e0b' },
        { icon: <FiFile />, title: 'File Sharing', desc: 'Share files up to 50MB with drag and drop', color: '#10b981' },
        { icon: <FiUsers />, title: 'Group Chat', desc: 'Real-time text messaging during calls', color: '#3b82f6' },
    ];

    return (
        <div className="home-container">
            {/* Floating orbs */}
            <div className="orb orb-1"></div>
            <div className="orb orb-2"></div>
            <div className="orb orb-3"></div>

            <div className="home-content">
                {/* Left Hero Section */}
                <div className="hero-section animate-fade-in">
                    <div className="hero-badge">
                        <FiZap /> <span>Real-time Communication</span>
                    </div>
                    <h1 className="hero-title">
                        Connect, Play &<br />
                        <span className="gradient-text">Share Together</span>
                    </h1>
                    <p className="hero-subtitle">
                        Your all-in-one video chatting app. Video call, watch movies together,
                        play games, share files — all in one beautiful space.
                    </p>

                    <div className="features-grid">
                        {features.map((f, i) => (
                            <div
                                key={i}
                                className="feature-card animate-slide-up"
                                style={{ animationDelay: `${i * 0.1}s`, '--feature-color': f.color }}
                            >
                                <div className="feature-icon" style={{ color: f.color }}>
                                    {f.icon}
                                </div>
                                <div>
                                    <h3>{f.title}</h3>
                                    <p>{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Action Section */}
                <div className="action-section animate-scale-in">
                    <div className="action-card glass-card">
                        <div className="connection-status">
                            <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
                            <span>{connected ? 'Connected to server' : 'Connecting...'}</span>
                        </div>

                        <h2>Get Started</h2>

                        <div className="name-input-group">
                            <label>Your Name</label>
                            <input
                                className="input"
                                placeholder="Enter your name..."
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                maxLength={20}
                            />
                        </div>

                        <div className="tab-switch">
                            <button
                                className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('create'); setError(''); }}
                            >
                                Create Room
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'join' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('join'); setError(''); }}
                            >
                                Join Room
                            </button>
                        </div>

                        {activeTab === 'create' ? (
                            <div className="tab-content">
                                {!createdRoom ? (
                                    <button className="btn btn-primary btn-full" onClick={createRoom} disabled={!connected}>
                                        <FiVideo /> Create New Room
                                    </button>
                                ) : (
                                    <div className="room-created">
                                        <p className="room-created-label">Room Created! Share this code:</p>
                                        <div className="room-code-display">
                                            <span className="room-code">{createdRoom}</span>
                                            <button className="btn btn-icon-sm btn-secondary" onClick={copyCode}>
                                                {copied ? <FiCheck /> : <FiCopy />}
                                            </button>
                                        </div>
                                        <button className="btn btn-primary btn-full" onClick={enterCreatedRoom}>
                                            <FiArrowRight /> Enter Room
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="tab-content">
                                <input
                                    className="input"
                                    placeholder="Enter room code..."
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    maxLength={8}
                                    style={{ textTransform: 'uppercase', letterSpacing: '3px', textAlign: 'center', fontWeight: 700 }}
                                />
                                <button className="btn btn-primary btn-full" onClick={joinRoom} disabled={!connected}>
                                    <FiArrowRight /> Join Room
                                </button>
                            </div>
                        )}

                        {error && <p className="error-text">{error}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
