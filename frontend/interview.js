import { UIUtils } from './js/utils/ui.js';

const startButton = document.getElementById('startButton');
const startContent = document.getElementById('start-content');
const introVideo = document.getElementById('introVideo');
const introScreen = document.getElementById('intro-screen');
const interviewScreen = document.getElementById('interview-screen');

const avatarVideoElement = document.getElementById('avatarVideo');
const userVideoElement = document.getElementById('userVideo');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

const API_URL = "http://localhost:7860/api/offer";
let peerConnection;
let userStream;
let isConnected = false;

const setStatus = (text, color) => {
    statusText.innerText = text;
    statusIndicator.style.backgroundColor = color;
};

const cleanupAndRedirect = () => {
     if (isConnected) {
        window.location.href = 'outro.html';
    } else {
        // If connection failed, just reload to the start screen.
        window.location.reload();
    }
};

const connect = async () => {
    setStatus("Initializing...", "#f39c12");
    try {
        userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        userVideoElement.srcObject = userStream;
        peerConnection = new RTCPeerConnection();

        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            if (state === "connected") {
                setStatus("Connected", "#2ecc71");
                isConnected = true;
            } else if (["disconnected", "closed", "failed"].includes(state)) {
                cleanupAndRedirect();
            }
        };

        userStream.getTracks().forEach(track => peerConnection.addTrack(track, userStream));
        peerConnection.ontrack = (event) => {
            const stream = event.streams[0];
            if (stream) {
                avatarVideoElement.srcObject = stream;
                event.track.onended = cleanupAndRedirect;
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(offer)
        });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const answer = await response.json();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
        console.error("Connection failed:", err);
        cleanupAndRedirect();
    }
};

startButton.onclick = () => {
    // 1. Start connecting in the background
    connect();

    // 2. Hide the start button and show/play the intro video
    UIUtils.hide(startContent);
    UIUtils.show(introVideo);
    introVideo.play().catch(e => {
        console.error("Intro video play failed:", e);
        // If video fails, switch view immediately
        UIUtils.hide(introScreen);
        UIUtils.show(interviewScreen);
    });
};

// 3. When the intro video ends, switch to the interview screen
introVideo.onended = () => {
    UIUtils.hide(introScreen);
    UIUtils.show(interviewScreen);
};