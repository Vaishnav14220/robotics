
import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { LiveAPIClient } from '../utils/live-api';
import { detectObjects } from '../utils/gemini'; // Reuse the robotics logic
import Overlay from './Overlay';

const LiveDemo = ({ apiKey }) => {
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState("disconnected");
    const [logs, setLogs] = useState([]);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [predictions, setPredictions] = useState([]); // For object labels

    const clientRef = useRef(null);
    const webcamRef = useRef(null);
    const videoIntervalRef = useRef(null);
    const detectionIntervalRef = useRef(null);

    const addLog = (msg) => {
        setLogs(prev => [...prev.slice(-9), msg]); // Keep last 10 logs
    };

    const startVideoLoop = () => {
        if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
        if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);

        // 1. Send frames to Live API (for Audio context) - 5 FPS
        videoIntervalRef.current = setInterval(() => {
            if (!clientRef.current || !webcamRef.current) return;

            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                const base64 = imageSrc.split(',')[1];
                clientRef.current.sendVideoChunk(base64);
            }
        }, 200);

        // 2. Run Object Detection (Robotics API) - 2 FPS (slower to save quota/bandwidth)
        detectionIntervalRef.current = setInterval(async () => {
            if (!webcamRef.current || !apiKey) return;

            // Resize for detection (same optimization as App.jsx)
            const video = webcamRef.current.video;
            if (!video || video.readyState !== 4) return;

            const canvas = document.createElement('canvas');
            const scale = 512 / video.videoWidth;
            canvas.width = 512;
            canvas.height = video.videoHeight * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

            try {
                // We use the same detectObjects function!
                const results = await detectObjects(base64, apiKey);
                setPredictions(results);
            } catch (e) {
                console.error("Detection error in Live Demo:", e);
            }
        }, 500);
    };

    const stopVideoLoop = () => {
        if (videoIntervalRef.current) {
            clearInterval(videoIntervalRef.current);
            videoIntervalRef.current = null;
        }
        if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
        }
        setPredictions([]);
    };

    useEffect(() => {
        if (connected && videoEnabled) {
            startVideoLoop();
        } else {
            stopVideoLoop();
        }
        return () => stopVideoLoop();
    }, [connected, videoEnabled]);

    const handleConnect = async () => {
        if (!apiKey) {
            alert("API Key required");
            return;
        }

        if (connected) {
            // Disconnect
            if (clientRef.current) {
                clientRef.current.disconnect();
            }
            setConnected(false);
            setVideoEnabled(false);
            return;
        }

        // Connect
        const client = new LiveAPIClient(apiKey);
        clientRef.current = client;

        client.onStatusChange = (newStatus) => {
            setStatus(newStatus);
            if (newStatus === "connected") {
                setConnected(true);
                addLog("Connected to Gemini Live");
                // Start audio automatically on connect
                client.startAudioStream().catch(err => {
                    console.error(err);
                    addLog("Error starting audio: " + err.message);
                });
            } else if (newStatus === "disconnected") {
                setConnected(false);
                addLog("Disconnected");
            }
        };

        client.onResponse = (data) => {
            if (data.text) {
                addLog("Gemini: " + data.text);
            }
        };

        try {
            await client.connect();
        } catch (e) {
            addLog("Connection failed: " + e.message);
        }
    };

    return (
        <div className="card" style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '20px' }}>
            <h2>Gemini Live API Demo (Multimodal)</h2>
            <p style={{ fontSize: '0.9em', color: '#aaa' }}>
                Model: gemini-2.5-flash-native-audio-preview-09-2025
            </p>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={handleConnect}
                    style={{
                        backgroundColor: connected ? '#ff4444' : '#44ff44',
                        color: connected ? 'white' : 'black',
                        marginRight: '10px'
                    }}
                >
                    {connected ? "Disconnect" : "Connect & Start"}
                </button>

                <button
                    onClick={() => setVideoEnabled(!videoEnabled)}
                    disabled={!connected}
                    style={{
                        backgroundColor: videoEnabled ? '#44ff44' : '#555',
                        color: videoEnabled ? 'black' : 'white',
                        opacity: connected ? 1 : 0.5
                    }}
                >
                    {videoEnabled ? "Stop Video" : "Start Video"}
                </button>

                <span style={{ marginLeft: '15px', textTransform: 'capitalize' }}>
                    Status: {status}
                </span>
            </div>

            {/* Video Preview with Overlay */}
            <div style={{ marginBottom: '20px', display: videoEnabled ? 'block' : 'none', position: 'relative' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        width={640}
                        height={480}
                        videoConstraints={{
                            width: 640,
                            height: 480,
                            facingMode: "user"
                        }}
                        style={{ borderRadius: '8px', border: '2px solid #444' }}
                    />
                    <Overlay
                        predictions={predictions}
                        width={640}
                        height={480}
                    />
                </div>
            </div>

            <div style={{
                background: '#1a1a1a',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'left',
                height: '200px',
                overflowY: 'auto',
                fontFamily: 'monospace'
            }}>
                {logs.map((log, i) => (
                    <div key={i} style={{ marginBottom: '5px', borderBottom: '1px solid #333', paddingBottom: '2px' }}>
                        {log}
                    </div>
                ))}
                {logs.length === 0 && <div style={{ color: '#666' }}>Logs will appear here...</div>}
            </div>
        </div>
    );
};

export default LiveDemo;

