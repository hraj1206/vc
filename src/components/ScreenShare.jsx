import React, { useRef, useEffect, useState } from 'react';
import { FiMonitor, FiStopCircle, FiInfo, FiCheckCircle } from 'react-icons/fi';
import './ScreenShare.css';

function ScreenShare({ socket, roomId, userName, screenSharing, onStart, onStop, localStream, screenStream }) {
    const previewRef = useRef(null);
    const [quality, setQuality] = useState('hd');
    const [sharerName, setSharerName] = useState(null); // someone else sharing

    useEffect(() => {
        if (!socket) return;
        socket.on('screen-share-started', ({ fromName }) => {
            setSharerName(fromName);
        });
        socket.on('screen-share-stopped', () => {
            setSharerName(null);
        });
        return () => {
            socket.off('screen-share-started');
            socket.off('screen-share-stopped');
        };
    }, [socket]);

    // Show preview of own screen share
    useEffect(() => {
        if (screenSharing && screenStream && previewRef.current) {
            previewRef.current.srcObject = screenStream;
        } else if (previewRef.current) {
            previewRef.current.srcObject = null;
        }
    }, [screenSharing, screenStream]);

    const handleStart = async () => {
        const constraints = {
            video: quality === 'hd'
                ? { cursor: 'always', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
                : { cursor: 'always', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
            audio: true
        };
        await onStart(constraints);
    };

    return (
        <div className="screenshare-container">
            {/* Status Banner */}
            {screenSharing ? (
                <div className="ss-status-banner sharing">
                    <FiCheckCircle />
                    <span>You are sharing your screen</span>
                </div>
            ) : sharerName ? (
                <div className="ss-status-banner remote">
                    <FiMonitor />
                    <span><strong>{sharerName}</strong> is sharing their screen</span>
                </div>
            ) : (
                <div className="ss-status-banner idle">
                    <FiInfo />
                    <span>No one is sharing their screen</span>
                </div>
            )}

            {/* Preview */}
            {screenSharing && (
                <div className="ss-preview-wrapper">
                    <video ref={previewRef} autoPlay muted playsInline className="ss-preview" />
                    <div className="ss-preview-label">Your screen preview</div>
                </div>
            )}

            {/* Controls */}
            <div className="ss-controls">
                {!screenSharing ? (
                    <>
                        <div className="ss-quality-group">
                            <label>Quality</label>
                            <div className="ss-quality-btns">
                                <button
                                    className={`ss-q-btn ${quality === 'hd' ? 'active' : ''}`}
                                    onClick={() => setQuality('hd')}
                                >
                                    HD 1080p
                                </button>
                                <button
                                    className={`ss-q-btn ${quality === 'sd' ? 'active' : ''}`}
                                    onClick={() => setQuality('sd')}
                                >
                                    SD 720p
                                </button>
                            </div>
                        </div>
                        <button className="btn btn-primary btn-full" onClick={handleStart}>
                            <FiMonitor /> Start Screen Share
                        </button>
                        <p className="ss-hint">Participants will see your screen in real time. You can share a window, tab, or full screen.</p>
                    </>
                ) : (
                    <button className="btn btn-danger btn-full" onClick={onStop}>
                        <FiStopCircle /> Stop Sharing
                    </button>
                )}
            </div>

            {/* Tips */}
            <div className="ss-tips">
                <h4>Tips</h4>
                <ul>
                    <li>Choose "Tab" for best quality when sharing a browser tab</li>
                    <li>Enable "Share audio" in the picker dialog to share sound</li>
                    <li>Your camera feed is paused while sharing your screen</li>
                    <li>Click Stop Sharing or press ESC to end</li>
                </ul>
            </div>
        </div>
    );
}

export default ScreenShare;
