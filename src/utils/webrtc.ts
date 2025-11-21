export class WebRTCManager {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStreams: Map<string, MediaStream> = new Map();
    private isAudioEnabled: boolean = false;

    constructor(private socket: any, private roomId: string, private username: string) {
        this.initializePeerConnection();
    }

    private initializePeerConnection() {
        const configuration: RTCConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        // Handle incoming tracks
        this.peerConnection.ontrack = (event) => {
            const [remoteStream] = event.streams;
            const userId = event.transceiver.mid || 'unknown';
            this.remoteStreams.set(userId, remoteStream);
            
            // Emit event for UI to handle new remote stream
            this.socket.emit('REMOTE_AUDIO_STREAM_ADDED', { 
                userId, 
                roomId: this.roomId,
                username: this.username 
            });
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('WEBRTC_ICE_CANDIDATE', {
                    candidate: event.candidate,
                    roomId: this.roomId,
                    targetUser: this.username
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('WebRTC connection state:', this.peerConnection?.connectionState);
        };
    }

    async enableAudio(): Promise<boolean> {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: false 
            });

            // Add audio tracks to peer connection
            this.localStream.getAudioTracks().forEach(track => {
                this.peerConnection?.addTrack(track, this.localStream!);
            });

            this.isAudioEnabled = true;
            return true;
        } catch (error) {
            console.error('Error enabling audio:', error);
            this.isAudioEnabled = false;
            return false;
        }
    }

    disableAudio() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }

        // Remove all senders
        if (this.peerConnection) {
            this.peerConnection.getSenders().forEach(sender => {
                if (sender.track) {
                    sender.track.stop();
                }
            });
        }

        this.isAudioEnabled = false;
    }

    async createOffer(): Promise<RTCSessionDescriptionInit | null> {
        try {
            if (!this.peerConnection) return null;

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            return offer;
        } catch (error) {
            console.error('Error creating offer:', error);
            return null;
        }
    }

    async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
        try {
            if (!this.peerConnection) return null;

            await this.peerConnection.setRemoteDescription(offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            return answer;
        } catch (error) {
            console.error('Error handling offer:', error);
            return null;
        }
    }

    async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
        try {
            if (!this.peerConnection) return;
            await this.peerConnection.setRemoteDescription(answer);
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        try {
            if (!this.peerConnection) return;
            await this.peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    getLocalStream(): MediaStream | null {
        return this.localStream;
    }

    getRemoteStreams(): Map<string, MediaStream> {
        return this.remoteStreams;
    }

    getIsAudioEnabled(): boolean {
        return this.isAudioEnabled;
    }

    close() {
        this.disableAudio();
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.remoteStreams.clear();
    }
}