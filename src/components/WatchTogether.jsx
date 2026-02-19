import React, { useState, useEffect, useRef } from 'react';
import { FiPlay, FiPause, FiLink, FiVolume2, FiVolumeX } from 'react-icons/fi';
import './WatchTogether.css';

function WatchTogether({ socket, roomId, userName }) {
    const [url, setUrl] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [syncLog, setSyncLog] = useState([]);
    const iframeRef = useRef(null);

    useEffect(() => {
        if (!socket) return;

        socket.on('watch-update', ({ url, from }) => {
            setCurrentUrl(url);
            addLog(`${from} shared a video`);
        });

        socket.on('watch-control', ({ action, time, from }) => {
            addLog(`${from} ${action}ed the video`);
            if (action === 'play') setIsPlaying(true);
            if (action === 'pause') setIsPlaying(false);
        });

        return () => {
            socket.off('watch-update');
            socket.off('watch-control');
        };
    }, [socket]);

    const addLog = (msg) => {
        setSyncLog(prev => [...prev.slice(-20), { id: Date.now(), text: msg, time: new Date() }]);
    };

    const shareVideo = () => {
        if (!url.trim()) return;
        const embedUrl = convertToEmbed(url.trim());
        setCurrentUrl(embedUrl);
        socket.emit('watch-sync', { roomId, url: embedUrl });
        addLog(`You shared a video`);
        setUrl('');
    };

    const convertToEmbed = (videoUrl) => {
        // YouTube
        const ytMatch = videoUrl.match(
            /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        if (ytMatch) {
            return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&enablejsapi=1`;
        }
        // If it's already an embed URL or another URL, return as-is
        return videoUrl;
    };

    const togglePlay = () => {
        const newState = !isPlaying;
        setIsPlaying(newState);
        socket.emit('watch-control', {
            roomId,
            action: newState ? 'play' : 'pause',
            time: 0
        });
        addLog(`You ${newState ? 'played' : 'paused'} the video`);
    };

    return (
        <div className="watch-container">
            {/* URL Input */}
            <div className="watch-input-area">
                <div className="watch-input-group">
                    <FiLink size={16} />
                    <input
                        className="input watch-input"
                        placeholder="Paste YouTube URL..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && shareVideo()}
                    />
                    <button className="btn btn-primary btn-sm" onClick={shareVideo}>
                        Share
                    </button>
                </div>
            </div>

            {/* Video Player */}
            {currentUrl ? (
                <div className="watch-player">
                    <div className="player-wrapper">
                        <iframe
                            ref={iframeRef}
                            src={currentUrl}
                            title="Watch Together"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="player-iframe"
                        />
                    </div>
                    <div className="player-controls">
                        <button className="btn btn-icon-sm btn-secondary" onClick={togglePlay}>
                            {isPlaying ? <FiPause size={14} /> : <FiPlay size={14} />}
                        </button>
                        <span className="player-status">
                            {isPlaying ? '▶ Playing' : '⏸ Paused'}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="watch-empty">
                    <div className="watch-empty-icon">
                        <FiPlay size={48} />
                    </div>
                    <h3>Watch Together</h3>
                    <p>Paste a YouTube link above to start watching together with your friends!</p>
                </div>
            )}

            {/* Sync Log */}
            <div className="sync-log">
                <h4>Activity</h4>
                <div className="sync-log-list">
                    {syncLog.map(log => (
                        <div key={log.id} className="sync-log-item">
                            <span className="log-dot"></span>
                            <span>{log.text}</span>
                        </div>
                    ))}
                    {syncLog.length === 0 && (
                        <p className="log-empty">No activity yet</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default WatchTogether;
