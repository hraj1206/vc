import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import Peer from 'simple-peer';
import {
    FiVideo, FiVideoOff, FiMic, FiMicOff, FiMonitor,
    FiPhone, FiMessageSquare, FiFile, FiPlay, FiGrid,
    FiCopy, FiCheck, FiUsers, FiMaximize, FiMinimize,
    FiSend, FiX, FiChevronLeft, FiRefreshCw
} from 'react-icons/fi';
import Chat from '../components/Chat';
import FileShare from '../components/FileShare';
import WatchTogether from '../components/WatchTogether';
import Games from '../components/Games';
import ScreenShare from '../components/ScreenShare';
import './Room.css';

function Room() {
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { socket, myId } = useSocket();
    const [userName, setUserName] = useState(location.state?.userName || sessionStorage.getItem('vc_userName') || '');

    useEffect(() => {
        if (!userName) {
            const savedName = sessionStorage.getItem('vc_userName');
            if (savedName) {
                setUserName(savedName);
            } else {
                const promptName = prompt("Enter your name to join the call:");
                if (promptName) {
                    setUserName(promptName);
                    sessionStorage.setItem('vc_userName', promptName);
                } else {
                    navigate('/');
                }
            }
        }
    }, [userName, navigate]);

    // Media state
    const [stream, setStream] = useState(null);
    const [peers, setPeers] = useState({});
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [screenSharing, setScreenSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isMirrored, setIsMirrored] = useState(true);

    // UI state
    const [activePanel, setActivePanel] = useState(null); // 'chat', 'files', 'watch', 'games'
    const [messages, setMessages] = useState([]);
    const [unreadMessages, setUnreadMessages] = useState(0);
    // participants = list of OTHER users. allParticipants includes self.
    const [participants, setParticipants] = useState([]);
    const [fullscreenVideo, setFullscreenVideo] = useState(null);
    const [showParticipantsList, setShowParticipantsList] = useState(false);
    const [remoteScreenShare, setRemoteScreenShare] = useState(null); // { userId, userName }

    const signalQueue = useRef({}); // userId -> [signalData]

    const myVideoRef = useRef(null);
    const peersRef = useRef({});
    const screenStreamRef = useRef(null);

    // Initialize media & join room
    useEffect(() => {
        const init = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720, facingMode: 'user' },
                    audio: { echoCancellation: true, noiseSuppression: true }
                });
                setStream(mediaStream);
                if (socket) {
                    socket.emit('join-room', { roomId, userName }, (response) => {
                        if (response.error) {
                            console.warn('Join error:', response.error);
                            alert(`Joining failed: ${response.error}`);
                        } else {
                            if (response.users) {
                                const others = response.users.map(u => ({ id: u.id, name: u.name || 'User' }));
                                setParticipants(others);
                                if (mediaStream) {
                                    others.forEach(u => createPeer(u.id, mediaStream, true, u.name));
                                }
                            }
                            if (response.messages) {
                                setMessages(response.messages);
                            }
                        }
                    });
                }
            } catch (err) {
                console.error('Failed to get media:', err);
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    setStream(audioStream);
                    setVideoEnabled(false);
                } catch (e) {
                    console.error('No media available:', e);
                }
            }
        };
        init();

        // Re-join if socket reconnects
        if (socket) socket.on('connect', init);

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            Object.values(peersRef.current).forEach(p => {
                try { p.peer?.destroy(); } catch (e) { }
            });
            if (socket) socket.off('connect', init);
        };
    }, [socket, roomId, userName, navigate]); // Removed stream from here to prevent re-init loop

    // Store stream in ref to access it in event listeners without re-binding them
    const streamRef = useRef(null);
    useEffect(() => {
        streamRef.current = stream;
    }, [stream]);

    // Ensure local video stream is always attached to the current ref
    useEffect(() => {
        if (stream && myVideoRef.current) {
            myVideoRef.current.srcObject = stream;
        }

        // When stream becomes available, process any queued signals
        if (stream) {
            Object.keys(signalQueue.current).forEach(userId => {
                const signals = signalQueue.current[userId];
                const participant = participants.find(p => p.id === userId);
                const name = participant?.name || 'User';

                if (signals.length > 0 && !peersRef.current[userId]) {
                    const peer = createPeer(userId, stream, false, name);
                    signals.forEach(sig => peer.signal(sig));
                    signalQueue.current[userId] = [];
                }
            });
        }
    }, [stream, participants, videoEnabled]);

    // Socket events
    useEffect(() => {
        if (!socket) return;

        const onUserJoined = ({ userId, userName: name }) => {
            console.log(`${name} joined`);
            setParticipants(prev => {
                if (prev.find(p => p.id === userId)) return prev;
                return [...prev, { id: userId, name }];
            });
        };

        const onIncomingCall = ({ signal, from, userName: name }) => {
            console.log(`Incoming call from ${name}`);
            setParticipants(prev => {
                if (prev.find(p => p.id === from)) return prev;
                return [...prev, { id: from, name }];
            });

            if (streamRef.current) {
                let peerObj = peersRef.current[from];
                if (!peerObj) {
                    const peer = createPeer(from, streamRef.current, false, name);
                    peer.signal(signal);
                } else {
                    peerObj.peer.signal(signal);
                }
            } else {
                // Queue the signal until stream is ready
                if (!signalQueue.current[from]) signalQueue.current[from] = [];
                signalQueue.current[from].push(signal);
                console.log(`Queued signal from ${name} (waiting for stream)`);
            }
        };

        const onCallAccepted = ({ signal, from }) => {
            const peerObj = peersRef.current[from];
            if (peerObj && peerObj.peer) {
                peerObj.peer.signal(signal);
            }
        };

        const onNewMessage = (msg) => {
            setMessages(prev => [...prev, msg]);
            // Logic for unread messages (use ref or separate effect to avoid closure issues)
        };

        const onUserLeft = ({ userId, userName: name }) => {
            console.log(`${name} left`);
            setParticipants(prev => prev.filter(p => p.id !== userId));
            if (peersRef.current[userId]) {
                try { peersRef.current[userId].peer?.destroy(); } catch (e) { }
                delete peersRef.current[userId];
                setPeers(prev => {
                    const newPeers = { ...prev };
                    delete newPeers[userId];
                    return newPeers;
                });
            }
        };

        const onScreenShareStarted = ({ from, fromName }) => {
            setRemoteScreenShare({ userId: from, userName: fromName });
        };

        const onScreenShareStopped = ({ from }) => {
            setRemoteScreenShare(prev => prev?.userId === from ? null : prev);
        };

        socket.on('user-joined', onUserJoined);
        socket.on('incoming-call', onIncomingCall);
        socket.on('call-accepted', onCallAccepted);
        socket.on('new-message', onNewMessage);
        socket.on('user-left', onUserLeft);
        socket.on('screen-share-started', onScreenShareStarted);
        socket.on('screen-share-stopped', onScreenShareStopped);

        return () => {
            socket.off('user-joined', onUserJoined);
            socket.off('incoming-call', onIncomingCall);
            socket.off('call-accepted', onCallAccepted);
            socket.off('new-message', onNewMessage);
            socket.off('user-left', onUserLeft);
            socket.off('screen-share-started', onScreenShareStarted);
            socket.off('screen-share-stopped', onScreenShareStopped);
        };
    }, [socket]); // Fully stable dependencies

    const createPeer = (userId, mediaStream, initiator, name = '') => {
        const peer = new Peer({
            initiator,
            trickle: false, // More reliable for basic signaling
            stream: mediaStream,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                ]
            }
        });

        peer.on('signal', (data) => {
            if (initiator) {
                socket.emit('call-user', {
                    userToCall: userId,
                    signalData: data,
                    from: myId,
                    userName
                });
            } else {
                socket.emit('answer-call', { to: userId, signal: data });
            }
        });

        peer.on('stream', (remoteStream) => {
            console.log('Received remote stream from', name);
            setPeers(prev => ({
                ...prev,
                [userId]: { ...prev[userId], stream: remoteStream }
            }));
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
        });

        peersRef.current[userId] = { peer, name };
        setPeers(prev => ({
            ...prev,
            [userId]: { peer, stream: prev[userId]?.stream || null }
        }));
        return peer;
    };

    // Media controls
    const toggleVideo = () => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setVideoEnabled(videoTrack.enabled);
            }
        }
    };

    const toggleAudio = () => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setAudioEnabled(audioTrack.enabled);
            }
        }
    };

    const onStopScreenShare = useCallback(() => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
        }
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            const screenTrack = screenStreamRef.current?.getVideoTracks()[0]; // this will be null now
            Object.values(peersRef.current).forEach(({ peer }) => {
                // In standard simple-peer, you provide (trackToRemove, newTrack, stream)
                // But we need to know WHICH track to remove. Simple-peer abstracts this.
                // However, since we set trickle:false, it might be better to just re-init?
                // No, replaceTrack is supported if we have the tracks.
                // Actually, our createPeer used 'stream' directly.
                // For simplicity in this build, let's use the internal _pc if needed, 
                // but peer.replaceTrack is safer if we find the correct target.
                if (peer && videoTrack) {
                    try {
                        const senders = peer._pc.getSenders();
                        const sender = senders.find(s => s.track?.kind === 'video');
                        if (sender) sender.replaceTrack(videoTrack);
                    } catch (e) { console.error('Replace track failed:', e); }
                }
            });
        }
        setScreenSharing(false);
        socket.emit('screen-share-stopped', { roomId });
    }, [stream, roomId, socket]);

    const toggleScreenShare = async () => {
        if (screenSharing) {
            onStopScreenShare();
        } else {
            // This is now handled by the Panel UI
            setActivePanel('screen');
        }
    };

    const endCall = () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
        Object.values(peersRef.current).forEach(({ peer }) => peer?.destroy());
        navigate('/');
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sendMessage = (text) => {
        socket.emit('send-message', { roomId, message: text, userName });
    };

    const togglePanel = (panel) => {
        if (activePanel === panel) {
            setActivePanel(null);
        } else {
            setActivePanel(panel);
            if (panel === 'chat') setUnreadMessages(0);
        }
    };

    // Full participant list including self (for games, etc.)
    const allParticipants = [
        { id: myId, name: userName, isMe: true },
        ...participants
    ];

    const peerEntries = Object.entries(peers);
    const totalVideos = allParticipants.length;
    // For the grid layout, we only count videos that are NOT in PIP
    // If there are other participants, my video goes to PIP
    const visibleGridCount = participants.length > 0 ? participants.length : 1;
    const gridClass = visibleGridCount <= 1 ? 'grid-1' : visibleGridCount <= 2 ? 'grid-2' : visibleGridCount <= 4 ? 'grid-4' : 'grid-many';

    return (
        <div className="room-container">
            {/* Top Bar */}
            <div className="room-topbar">
                <div className="topbar-left">
                    <button className="btn btn-icon-sm btn-secondary" onClick={() => navigate('/')}>
                        <FiChevronLeft />
                    </button>
                    <div className="room-info">
                        <h3>Room</h3>
                        <div className="room-code-bar" onClick={copyRoomCode}>
                            <span>{roomId}</span>
                            {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
                        </div>
                    </div>
                </div>
                <div className="topbar-right">
                    <div
                        className="participants-count"
                        onClick={() => setShowParticipantsList(p => !p)}
                        style={{ cursor: 'pointer', position: 'relative' }}
                    >
                        <FiUsers size={14} />
                        <span>{totalVideos} {totalVideos === 1 ? 'person' : 'people'}</span>
                        {/* Avatar chips */}
                        <div className="participant-avatars">
                            {allParticipants.slice(0, 5).map((p) => (
                                <div key={p.id} className="participant-avatar-chip" title={p.name + (p.isMe ? ' (You)' : '')}>
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                            ))}
                            {allParticipants.length > 5 && (
                                <div className="participant-avatar-chip extra">+{allParticipants.length - 5}</div>
                            )}
                        </div>
                    </div>
                    {/* Participant dropdown */}
                    {showParticipantsList && (
                        <div className="participants-dropdown glass-card">
                            <div className="participants-dropdown-header">
                                <span>In this room</span>
                                <button className="btn btn-icon-sm btn-secondary" onClick={() => setShowParticipantsList(false)}><FiX size={12} /></button>
                            </div>
                            {allParticipants.map(p => (
                                <div key={p.id} className="participant-row">
                                    <div className="participant-row-avatar">{p.name.charAt(0).toUpperCase()}</div>
                                    <span>{p.name}{p.isMe ? ' (You)' : ''}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="room-body">
                {/* Video Grid */}
                <div className={`video-area ${activePanel ? 'with-panel' : ''}`}>
                    <div className={`video-grid ${gridClass} ${remoteScreenShare || screenSharing ? 'presentation-mode' : ''}`}>
                        {/* Main Spotlight (Remote Screen or Focused Peer) */}
                        {(remoteScreenShare || screenSharing) && (
                            <div className="video-tile spotlight">
                                {screenSharing ? (
                                    <video
                                        ref={(el) => { if (el && screenStreamRef.current) el.srcObject = screenStreamRef.current; }}
                                        autoPlay
                                        playsInline
                                        className="video-element"
                                    />
                                ) : (
                                    <PeerVideo
                                        peerId={remoteScreenShare?.userId}
                                        peerData={peers[remoteScreenShare?.userId]}
                                        isFullscreen={false}
                                        participant={participants.find(p => p.id === remoteScreenShare?.userId)}
                                        isSpotlight={true}
                                    />
                                )}
                                <div className="video-label spotlight-label">
                                    <FiMonitor size={14} />
                                    <span>{screenSharing ? 'Your Screen' : `${remoteScreenShare.userName}'s Screen`}</span>
                                </div>
                            </div>
                        )}

                        {/* Others Grid / Sidebar */}
                        <div className={`participants-videos ${(remoteScreenShare || screenSharing) ? 'sidebar' : 'grid'}`}>
                            {/* Peer Videos: Map through participants to ensure every person has a slot */}
                            {participants.filter(p => p.id !== remoteScreenShare?.userId).map((p) => (
                                <PeerVideo
                                    key={p.id}
                                    peerId={p.id}
                                    peerData={peers[p.id]}
                                    isFullscreen={fullscreenVideo === p.id}
                                    onToggleFullscreen={() =>
                                        setFullscreenVideo(fullscreenVideo === p.id ? null : p.id)
                                    }
                                    participant={p}
                                />
                            ))}

                            {/* My Video (Grid mode): Only if alone */}
                            {participants.length === 0 && (
                                <div className="video-tile local-video">
                                    <video
                                        ref={myVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className={`video-element ${!videoEnabled ? 'hidden' : ''} ${isMirrored ? 'mirrored' : ''}`}
                                    />
                                    {!videoEnabled && (
                                        <div className="video-avatar">
                                            <span>{userName.charAt(0).toUpperCase()}</span>
                                        </div>
                                    )}
                                    <div className="video-label">
                                        <span className="video-name">{userName} (You)</span>
                                    </div>
                                    <button
                                        className="mirror-toggle-btn"
                                        onClick={() => setIsMirrored(!isMirrored)}
                                        title="Flip Video"
                                    >
                                        <FiRefreshCw size={12} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* My Video (PIP mode): Only if others present */}
                        {participants.length > 0 && (
                            <div className="video-tile local-video pip">
                                <video
                                    ref={(el) => {
                                        myVideoRef.current = el;
                                        if (el && stream) el.srcObject = stream;
                                    }}
                                    autoPlay
                                    muted
                                    playsInline
                                    className={`video-element ${!videoEnabled ? 'hidden' : ''} ${isMirrored ? 'mirrored' : ''}`}
                                />
                                {!videoEnabled && (
                                    <div className="video-avatar">
                                        <span>{userName.charAt(0).toUpperCase()}</span>
                                    </div>
                                )}
                                <div className="video-label">
                                    <span className="video-name">You</span>
                                </div>
                                <button
                                    className="mirror-toggle-btn"
                                    onClick={() => setIsMirrored(!isMirrored)}
                                    title="Flip Video"
                                >
                                    <FiRefreshCw size={10} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Panels */}
                {activePanel && (
                    <div className="side-panel glass-card animate-scale-in">
                        <div className="panel-header">
                            <h3>
                                {activePanel === 'chat' && 'Chat'}
                                {activePanel === 'files' && 'File Sharing'}
                                {activePanel === 'watch' && 'Watch Together'}
                                {activePanel === 'games' && 'Games'}
                                {activePanel === 'screen' && 'Screen Share'}
                            </h3>
                            <button className="btn btn-icon-sm btn-secondary" onClick={() => setActivePanel(null)}>
                                <FiX size={16} />
                            </button>
                        </div>
                        <div className="panel-body">
                            {activePanel === 'chat' && (
                                <Chat messages={messages} onSend={sendMessage} myId={myId} userName={userName} />
                            )}
                            {activePanel === 'files' && (
                                <FileShare socket={socket} roomId={roomId} userName={userName} />
                            )}
                            {activePanel === 'watch' && (
                                <WatchTogether socket={socket} roomId={roomId} userName={userName} />
                            )}
                            {activePanel === 'games' && (
                                <Games
                                    socket={socket}
                                    roomId={roomId}
                                    myId={myId}
                                    userName={userName}
                                    participants={allParticipants}
                                />
                            )}
                            {activePanel === 'screen' && (
                                <ScreenShare
                                    socket={socket}
                                    roomId={roomId}
                                    userName={userName}
                                    screenSharing={screenSharing}
                                    onStart={async (constraints) => {
                                        try {
                                            const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
                                            screenStreamRef.current = screenStream;
                                            const screenTrack = screenStream.getVideoTracks()[0];

                                            // Standard replaceTrack method
                                            Object.values(peersRef.current).forEach(({ peer }) => {
                                                if (peer && stream) {
                                                    const videoTrack = stream.getVideoTracks()[0];
                                                    if (videoTrack) {
                                                        peer.replaceTrack(videoTrack, screenTrack, stream);
                                                    }
                                                }
                                            });

                                            screenTrack.onended = () => {
                                                onStopScreenShare();
                                            };
                                            setScreenSharing(true);
                                            socket.emit('screen-share-started', { roomId, fromName: userName });
                                        } catch (err) {
                                            console.error('Screen share failed:', err);
                                        }
                                    }}
                                    onStop={onStopScreenShare}
                                    screenStream={screenStreamRef.current}
                                    localStream={stream}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className="room-controls">
                <div className="controls-center">
                    <button
                        className={`btn btn-icon control-btn ${!audioEnabled ? 'off' : ''}`}
                        onClick={toggleAudio}
                        data-tooltip={audioEnabled ? 'Mute' : 'Unmute'}
                    >
                        {audioEnabled ? <FiMic /> : <FiMicOff />}
                    </button>
                    <button
                        className={`btn btn-icon control-btn ${!videoEnabled ? 'off' : ''}`}
                        onClick={toggleVideo}
                        data-tooltip={videoEnabled ? 'Camera Off' : 'Camera On'}
                    >
                        {videoEnabled ? <FiVideo /> : <FiVideoOff />}
                    </button>
                    <button
                        className={`btn btn-icon control-btn ${activePanel === 'screen' ? 'active-feature' : ''} ${screenSharing ? 'sharing-active' : ''}`}
                        onClick={() => togglePanel('screen')}
                        data-tooltip="Screen Share"
                    >
                        <FiMonitor />
                        {screenSharing && <span className="notif-badge" style={{ background: 'var(--success)' }}>●</span>}
                    </button>

                    <div className="controls-divider"></div>

                    <button
                        className={`btn btn-icon control-btn ${activePanel === 'chat' ? 'active-feature' : ''}`}
                        onClick={() => togglePanel('chat')}
                        data-tooltip="Chat"
                    >
                        <FiMessageSquare />
                        {unreadMessages > 0 && <span className="notif-badge">{unreadMessages}</span>}
                    </button>
                    <button
                        className={`btn btn-icon control-btn ${activePanel === 'files' ? 'active-feature' : ''}`}
                        onClick={() => togglePanel('files')}
                        data-tooltip="Files"
                    >
                        <FiFile />
                    </button>
                    <button
                        className={`btn btn-icon control-btn ${activePanel === 'watch' ? 'active-feature' : ''}`}
                        onClick={() => togglePanel('watch')}
                        data-tooltip="Watch Together"
                    >
                        <FiPlay />
                    </button>
                    <button
                        className={`btn btn-icon control-btn ${activePanel === 'games' ? 'active-feature' : ''}`}
                        onClick={() => togglePanel('games')}
                        data-tooltip="Games"
                    >
                        <FiGrid />
                    </button>

                    <div className="controls-divider"></div>

                    <button className="btn btn-icon control-btn end-call" onClick={endCall} data-tooltip="End Call">
                        <FiPhone style={{ transform: 'rotate(135deg)' }} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Peer Video sub-component
function PeerVideo({ peerId, peerData, isFullscreen, onToggleFullscreen, participant }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (peerData?.stream && videoRef.current) {
            videoRef.current.srcObject = peerData.stream;
        }
    }, [peerData?.stream]);

    const name = participant?.name || 'Peer';

    return (
        <div className={`video-tile ${isFullscreen ? 'fullscreen' : ''}`}>
            {peerData?.stream ? (
                <video ref={videoRef} autoPlay playsInline className="video-element" />
            ) : (
                <div className="video-avatar">
                    <span>{name.charAt(0).toUpperCase()}</span>
                </div>
            )}
            <div className="video-label">
                <span className="video-name">{name}</span>
            </div>
            <button className="video-fullscreen-btn" onClick={onToggleFullscreen}>
                {isFullscreen ? <FiMinimize size={14} /> : <FiMaximize size={14} />}
            </button>
        </div>
    );
}

export default Room;
