import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiSmile } from 'react-icons/fi';
import './Chat.css';

function Chat({ messages, onSend, myId, userName }) {
    const [text, setText] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!text.trim()) return;
        onSend(text.trim());
        setText('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <FiSmile size={40} />
                        <p>No messages yet</p>
                        <span>Start the conversation!</span>
                    </div>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`chat-message ${msg.userId === myId ? 'mine' : 'theirs'}`}
                    >
                        {msg.userId !== myId && (
                            <div className="msg-avatar">
                                {msg.userName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="msg-content">
                            {msg.userId !== myId && (
                                <span className="msg-sender">{msg.userName}</span>
                            )}
                            <div className="msg-bubble">
                                <p>{msg.text}</p>
                            </div>
                            <span className="msg-time">{formatTime(msg.timestamp)}</span>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-area">
                <input
                    className="input chat-input"
                    placeholder="Type a message..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={500}
                />
                <button className="btn btn-primary btn-icon" onClick={handleSend} disabled={!text.trim()}>
                    <FiSend />
                </button>
            </div>
        </div>
    );
}

export default Chat;
