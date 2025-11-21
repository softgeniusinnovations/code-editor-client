import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAppContext } from '@/context/AppContext';
import { WebRTCManager } from '@/utils/webrtc';
import { Tooltip } from 'react-tooltip';
import { tooltipStyles } from '@/components/sidebar/tooltipStyles';

interface AudioControlProps {
    roomId: string;
    username: string;
}

const AudioControl: React.FC<AudioControlProps> = ({ roomId, username }) => {
    const { socket } = useSocket();
    const { setUserAudioStreams } = useAppContext();
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showTooltip, setShowTooltip] = useState(true);
    
    const webRTCManagerRef = useRef<WebRTCManager | null>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!socket || !roomId) return;

        // Initialize WebRTC manager
        webRTCManagerRef.current = new WebRTCManager(socket, roomId, username);

        // Socket event listeners for WebRTC
        socket.on('WEBRTC_OFFER', async (data: { offer: RTCSessionDescriptionInit; fromUser: string }) => {
            if (!webRTCManagerRef.current) return;

            const answer = await webRTCManagerRef.current.handleOffer(data.offer);
            if (answer) {
                socket.emit('WEBRTC_ANSWER', {
                    answer,
                    roomId,
                    targetUser: data.fromUser
                });
            }
        });

        socket.on('WEBRTC_ANSWER', async (data: { answer: RTCSessionDescriptionInit; fromUser: string }) => {
            await webRTCManagerRef.current?.handleAnswer(data.answer);
        });

        socket.on('WEBRTC_ICE_CANDIDATE', async (data: { candidate: RTCIceCandidateInit; fromUser: string }) => {
            await webRTCManagerRef.current?.addIceCandidate(data.candidate);
        });

        socket.on('REMOTE_AUDIO_STREAM_ADDED', (data: { userId: string; username: string }) => {
            const remoteStreams = webRTCManagerRef.current?.getRemoteStreams();
            if (remoteStreams && remoteStreams.has(data.userId)) {
                const stream = remoteStreams.get(data.userId);
                if (stream) {
                    setUserAudioStreams(prev => ({
                        ...prev,
                        [data.username]: stream
                    }));
                }
            }
        });

        socket.on('USER_AUDIO_TOGGLED', (data: { username: string; isAudioEnabled: boolean }) => {
            if (data.username !== username) {
                console.log(`User ${data.username} ${data.isAudioEnabled ? 'enabled' : 'disabled'} audio`);
            }
        });

        // Check initial permission
        checkAudioPermission();

        return () => {
            // Cleanup
            socket.off('WEBRTC_OFFER');
            socket.off('WEBRTC_ANSWER');
            socket.off('WEBRTC_ICE_CANDIDATE');
            socket.off('REMOTE_AUDIO_STREAM_ADDED');
            socket.off('USER_AUDIO_TOGGLED');
            
            webRTCManagerRef.current?.close();
        };
    }, [socket, roomId, username, setUserAudioStreams]);

    const checkAudioPermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setHasPermission(true);
        } catch (error) {
            setHasPermission(false);
        }
    };

    const requestAudioPermission = async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setHasPermission(true);
            return true;
        } catch (error) {
            console.error('Audio permission denied:', error);
            setHasPermission(false);
            return false;
        }
    };

    const toggleAudio = async () => {
        if (!webRTCManagerRef.current || !socket) return;

        setIsLoading(true);

        try {
            if (!isAudioEnabled) {
                // Enable audio
                if (!hasPermission) {
                    const granted = await requestAudioPermission();
                    if (!granted) {
                        alert('Microphone access is required for audio communication');
                        return;
                    }
                }

                const success = await webRTCManagerRef.current.enableAudio();
                if (success) {
                    setIsAudioEnabled(true);
                    
                    // Create offer and send to all users in room
                    const offer = await webRTCManagerRef.current.createOffer();
                    if (offer) {
                        socket.emit('WEBRTC_OFFER', {
                            offer,
                            roomId,
                            targetUser: 'all' // Send to all users in room
                        });
                    }

                    // Update local audio element
                    const localStream = webRTCManagerRef.current.getLocalStream();
                    if (localAudioRef.current && localStream) {
                        localAudioRef.current.srcObject = localStream;
                    }

                    // Notify other users
                    socket.emit('USER_AUDIO_TOGGLED', {
                        roomId,
                        username,
                        isAudioEnabled: true
                    });
                }
            } else {
                // Disable audio
                webRTCManagerRef.current.disableAudio();
                setIsAudioEnabled(false);

                if (localAudioRef.current) {
                    localAudioRef.current.srcObject = null;
                }

                // Notify other users
                socket.emit('USER_AUDIO_TOGGLED', {
                    roomId,
                    username,
                    isAudioEnabled: false
                });
            }
        } catch (error) {
            console.error('Error toggling audio:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getButtonText = () => {
        if (!hasPermission) return 'No Microphone Access';
        if (isLoading) return 'Loading...';
        return isAudioEnabled ? 'Mute Audio' : 'Enable Audio';
    };

    const getIcon = () => {
        const baseProps = {
            width: "20",
            height: "20",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2"
        };

        // Microphone ON (green)
        if (isAudioEnabled && hasPermission) {
            return (
                <svg {...baseProps} className="text-green-400">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
            );
        }

        // Microphone OFF with red cross (no permission or disabled)
        return (
            <svg {...baseProps} className="text-red-400">
                {/* Microphone body */}
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
                {/* Red cross line through the microphone */}
                <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2.5" />
                <line x1="20" y1="4" x2="4" y2="20" stroke="currentColor" strokeWidth="2.5" />
            </svg>
        );
    };

    return (
        <div className="flex items-center justify-center">
            <button
                className={`flex items-center justify-center rounded p-1.5 transition-colors duration-200 ease-in-out hover:bg-[#3D404A] ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={toggleAudio}
                disabled={isLoading}
                onMouseEnter={() => setShowTooltip(true)}
                data-tooltip-id="audio-control-tooltip"
                data-tooltip-content={getButtonText()}
            >
                {getIcon()}
            </button>

            {showTooltip && (
                <Tooltip
                    id="audio-control-tooltip"
                    place="right"
                    offset={15}
                    className="!z-50"
                    style={tooltipStyles}
                    noArrow={false}
                    positionStrategy="fixed"
                    float={true}
                />
            )}
        </div>
    );
};

export default AudioControl;