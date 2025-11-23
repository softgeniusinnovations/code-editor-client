import { io } from "socket.io-client";

let socket: any = null;
let mediaRecorder: MediaRecorder | null = null;
let sending = false;

let roomId = "";
let username = "";

// --------------------------
// INIT + SOCKET SETUP
// --------------------------
export function initWebRTC(_roomId: string, _username: string) {
    roomId = _roomId;
    username = _username;

    socket = io();

    // join room
    socket.emit("JOIN_ROOM", {
        roomId,
        username
    });

    // receive audio from others
    socket.on("AUDIO_BLOB", (data: { from: string; blob: ArrayBuffer }) => {
        playIncomingAudio(data.from, data.blob);
    });

    // receive mute/unmute updates
    socket.on("USER_AUDIO_TOGGLED", (data: { username: string; isAudioEnabled: boolean }) => {
        const state = data.isAudioEnabled ? "unmuted" : "muted";
        console.log(`User ${data.username} is now ${state}`);
    });
}

// --------------------------
// START SENDING AUDIO
// --------------------------
export async function startSendingAudio() {
    try {
        if (sending) return;
        sending = true;

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        const options: MediaRecorderOptions = {
            mimeType: "audio/webm;codecs=opus"
        };

        try {
            mediaRecorder = new MediaRecorder(stream, options);
        } catch {
            mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (ev: BlobEvent) => {
            const chunk = ev.data;
            if (chunk && chunk.size > 0) {
                chunk.arrayBuffer().then((buffer: ArrayBuffer) => {
                    socket.emit("AUDIO_BLOB", {
                        roomId,
                        username,
                        blob: buffer
                    });
                });
            }
        };

        mediaRecorder.start(250); // send 4 chunks per second

        socket.emit("USER_AUDIO_TOGGLED", {
            roomId,
            username,
            isAudioEnabled: true
        });

        console.log("Microphone streaming ON");
    } catch (err) {
        console.error("Mic error:", err);
    }
}

// --------------------------
// STOP SENDING AUDIO
// --------------------------
export function stopSendingAudio() {
    if (!mediaRecorder) return;

    mediaRecorder.stop();
    mediaRecorder = null;
    sending = false;

    socket.emit("USER_AUDIO_TOGGLED", {
        roomId,
        username,
        isAudioEnabled: false
    });

    console.log("Microphone streaming OFF");
}

// --------------------------
// PLAY RECEIVED AUDIO
// --------------------------
function playIncomingAudio(from: string, blob: ArrayBuffer) {
    const audioBlob = new Blob([blob], { type: "audio/webm;codecs=opus" });
    const url = URL.createObjectURL(audioBlob);

    const audio = new Audio(url);
    audio.autoplay = true;

    audio.onended = () => {
        URL.revokeObjectURL(url);
    };

    console.log("Playing audio from:", from);
}
