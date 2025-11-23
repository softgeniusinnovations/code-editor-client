import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAppContext } from '@/context/AppContext';
import { Tooltip } from 'react-tooltip';
import { tooltipStyles } from '@/components/sidebar/tooltipStyles';

interface AudioControlProps {
    roomId: string;
    username: string;
}

type AudioBlobPayload = {
    from: string;
    blob: ArrayBuffer;
};

const AudioControl: React.FC<AudioControlProps> = ({ roomId, username }) => {
    const { socket } = useSocket();
    const { setUserAudioStreams } = useAppContext();

    const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(false);
    const [hasPermission, setHasPermission] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showTooltip, setShowTooltip] = useState<boolean>(true);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

    useEffect(() => {
        if (!socket || !roomId) return;

        socket.emit('JOIN_ROOM', { roomId, username });

        const handleAudioBlob = (data: AudioBlobPayload) => {
            playIncomingAudio(data.from, data.blob);
        };

        const handleUserAudioToggled = (data: { username: string; isAudioEnabled: boolean }) => {
            if (data.username !== username) {
                console.log(`User ${data.username} ${data.isAudioEnabled ? 'enabled' : 'disabled'} audio`);
            }
        };

        socket.on('AUDIO_BLOB', handleAudioBlob);
        socket.on('USER_AUDIO_TOGGLED', handleUserAudioToggled);

        checkAudioPermission().catch(() => { /* ignore */ });

        return () => {
            socket.off('AUDIO_BLOB', handleAudioBlob);
            socket.off('USER_AUDIO_TOGGLED', handleUserAudioToggled);
            stopAudioAnalysis();
            stopSendingAudio();
            remoteAudioElsRef.current.forEach((el) => {
                try { el.pause(); } catch { /* */ }
                try { URL.revokeObjectURL(el.src); } catch { /* */ }
            });
            remoteAudioElsRef.current.clear();
        };
    }, [socket, roomId, username, setUserAudioStreams]);

    const checkAudioPermission = async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
            setHasPermission(true);
            return true;
        } catch (err) {
            setHasPermission(false);
            return false;
        }
    };

    const requestAudioPermission = async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
            setHasPermission(true);
            return true;
        } catch (err) {
            console.error('Audio permission denied:', err);
            setHasPermission(false);
            return false;
        }
    };

    const startSendingAudio = async (): Promise<void> => {
        if (!socket) return;
        if (mediaRecorderRef.current) return; 

        try {
            const granted = hasPermission || (await requestAudioPermission());
            if (!granted) {
                alert('Microphone access is required for audio communication');
                return;
            }

            setIsLoading(true);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;

            setupAudioAnalysis(stream);

            const mimeTypeCandidate = 'audio/webm;codecs=opus';
            let recorder: MediaRecorder;
            try {
                recorder = new MediaRecorder(stream, { mimeType: mimeTypeCandidate });
            } catch {
                recorder = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (ev: BlobEvent) => {
                const blob = ev.data;
                if (!blob || blob.size === 0) return;
                blob.arrayBuffer()
                    .then((buffer) => {
                        socket.emit('AUDIO_BLOB', {
                            roomId,
                            username,
                            blob: buffer
                        });
                    })
                    .catch((err) => {
                        console.error('Failed to read audio blob as arrayBuffer:', err);
                    });
            };

            recorder.onstart = () => {
                socket.emit('USER_AUDIO_TOGGLED', { roomId, username, isAudioEnabled: true });
                setIsAudioEnabled(true);
                setIsLoading(false);
            };

            recorder.onstop = () => {
                socket.emit('USER_AUDIO_TOGGLED', { roomId, username, isAudioEnabled: false });
                setIsAudioEnabled(false);
                setIsLoading(false);
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((t) => t.stop());
                    localStreamRef.current = null;
                }
            };

            recorder.start(250);
        } catch (err) {
            console.error('Failed to start sending audio:', err);
            setIsLoading(false);
        }
    };

    const stopSendingAudio = (): void => {
        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        } catch (err) {
            console.error('Error stopping mediaRecorder:', err);
        } finally {
            mediaRecorderRef.current = null;
            stopAudioAnalysis();
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
                localStreamRef.current = null;
            }
        }
    };

    // --- Audio analysis (speaking detection) ---
    const setupAudioAnalysis = (stream: MediaStream): void => {
        try {
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => { /* ignore */ });
            }

            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            analyserRef.current = analyser;

            const src = audioCtx.createMediaStreamSource(stream);
            src.connect(analyser);

            tickAnalyze();
        } catch (err) {
            console.error('Error setting up audio analysis:', err);
        }
    };

    const tickAnalyze = (): void => {
        const analyser = analyserRef.current;
        if (!analyser) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;

        // threshold adjustable
        setIsSpeaking(avg > 20);

        animationFrameRef.current = requestAnimationFrame(tickAnalyze);
    };

    const stopAudioAnalysis = (): void => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { /* ignore */ });
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        setIsSpeaking(false);
    };

    // --- Play incoming audio blob (per-user element for overlap) ---
    const playIncomingAudio = (fromUser: string, buffer: ArrayBuffer): void => {
        try {
            const audioBlob = new Blob([buffer], { type: 'audio/webm;codecs=opus' });
            const url = URL.createObjectURL(audioBlob);

            // reuse audio element per user (so that simultaneous chunks from same user queue up)
            let audioEl = remoteAudioElsRef.current.get(fromUser);
            if (!audioEl) {
                audioEl = new Audio();
                audioEl.autoplay = true;
                remoteAudioElsRef.current.set(fromUser, audioEl);
                try {
                    // @ts-ignore captureStream may exist on HTMLMediaElement
                    const remoteStream = (audioEl.captureStream && audioEl.captureStream()) as MediaStream | undefined;
                    if (remoteStream && setUserAudioStreams) {
                        // register to app context (merge)
                        setUserAudioStreams((prev: Record<string, MediaStream>) => ({
                            ...prev,
                            [fromUser]: remoteStream
                        }));
                    }
                } catch {

                }
            } else {

            }

            // Assign new url and play
            audioEl.src = url;
            audioEl.play().catch((err) => {
                console.warn('Play blocked:', err);
            });

            const cleanup = () => {
                try { URL.revokeObjectURL(url); } catch { /* */ }
                audioEl?.removeEventListener('ended', cleanup);
            };
            audioEl.addEventListener('ended', cleanup);
            setTimeout(cleanup, 5000);
        } catch (err) {
            console.error('Failed to play incoming audio:', err);
        }
    };

    // --- Toggle button handler (UI) ---
    const toggleAudio = async (): Promise<void> => {
        if (!socket) return;
        setIsLoading(true);
        try {
            if (!isAudioEnabled) {
                await startSendingAudio();
            } else {
                stopSendingAudio();
            }
        } catch (err) {
            console.error('Error toggling audio:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const getButtonText = (): string => {
        if (!hasPermission) return 'No Microphone Access';
        if (isLoading) return 'Loading...';
        if (isAudioEnabled) {
            return isSpeaking ? 'Speaking...' : 'Microphone On';
        }
        return 'Enable Audio';
    };

    const getIcon = () => {
        const baseProps = {
            width: '20',
            height: '20',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2'
        } as React.SVGProps<SVGSVGElement>;

        if (isAudioEnabled && hasPermission) {
            return (
                <svg {...baseProps} className="text-green-400">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                    {isSpeaking && (
                        <>
                            <path d="M3 12h1" className="animate-pulse" />
                            <path d="M6 9h1" className="animate-pulse" style={{ animationDelay: '0.1s' }} />
                            <path d="M9 6h1" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
                        </>
                    )}
                </svg>
            );
        }

        return (
            <svg {...baseProps} className="text-red-400">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
                <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" />
            </svg>
        );
    };

    return (
        <div className="flex items-center justify-center">
            <button
                className={`flex items-center justify-center rounded p-1.5 transition-colors duration-200 ease-in-out hover:bg-[#3D404A] ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
