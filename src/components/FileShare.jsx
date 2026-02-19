import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiFile, FiImage, FiFilm, FiMusic, FiDownload, FiCheck } from 'react-icons/fi';
import './FileShare.css';

function FileShare({ socket, roomId, userName }) {
    const [sharedFiles, setSharedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        if (!socket) return;

        socket.on('file-received', ({ from, fromName, fileName, fileType, fileSize, fileData }) => {
            setSharedFiles(prev => [...prev, {
                id: Date.now(),
                fileName,
                fileType,
                fileSize,
                fileData,
                from: fromName,
                received: true,
                timestamp: new Date()
            }]);
        });

        return () => {
            socket.off('file-received');
        };
    }, [socket]);

    const onDrop = useCallback(async (acceptedFiles) => {
        for (const file of acceptedFiles) {
            if (file.size > 50 * 1024 * 1024) {
                alert(`${file.name} is too large. Max 50MB.`);
                continue;
            }

            setUploading(true);
            setUploadProgress(0);

            const reader = new FileReader();
            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    setUploadProgress(Math.round((e.loaded / e.total) * 100));
                }
            };
            reader.onload = () => {
                const fileData = reader.result;
                socket.emit('file-share', {
                    roomId,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    fileData
                });

                setSharedFiles(prev => [...prev, {
                    id: Date.now(),
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    fileData,
                    from: userName,
                    received: false,
                    timestamp: new Date()
                }]);

                setUploading(false);
                setUploadProgress(100);
            };
            reader.readAsArrayBuffer(file);
        }
    }, [socket, roomId, userName]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxSize: 50 * 1024 * 1024
    });

    const downloadFile = (file) => {
        const blob = new Blob([file.fileData], { type: file.fileType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getFileIcon = (type) => {
        if (type?.startsWith('image/')) return <FiImage />;
        if (type?.startsWith('video/')) return <FiFilm />;
        if (type?.startsWith('audio/')) return <FiMusic />;
        return <FiFile />;
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="fileshare-container">
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                <input {...getInputProps()} />
                <div className="dropzone-content">
                    <FiUploadCloud size={36} />
                    {isDragActive ? (
                        <p>Drop files here...</p>
                    ) : (
                        <>
                            <p>Drag & drop files here</p>
                            <span>or click to browse (max 50MB)</span>
                        </>
                    )}
                </div>
                {uploading && (
                    <div className="upload-progress">
                        <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                )}
            </div>

            <div className="shared-files">
                {sharedFiles.length === 0 && (
                    <div className="files-empty">
                        <FiFile size={32} />
                        <p>No files shared yet</p>
                    </div>
                )}
                {sharedFiles.map((file) => (
                    <div key={file.id} className="file-item">
                        <div className="file-icon">
                            {getFileIcon(file.fileType)}
                        </div>
                        <div className="file-info">
                            <span className="file-name">{file.fileName}</span>
                            <span className="file-meta">
                                {formatSize(file.fileSize)} • {file.received ? `From ${file.from}` : 'Sent by you'}
                            </span>
                        </div>
                        <button className="btn btn-icon-sm btn-secondary" onClick={() => downloadFile(file)}>
                            <FiDownload size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default FileShare;
