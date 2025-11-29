import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { detectObjects } from './utils/gemini';
import Overlay from './components/Overlay';
import './App.css'; // We can keep this empty or remove it, but Vite creates it.

function App() {
  const [apiKey, setApiKey] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const webcamRef = useRef(null);
  const [videoSize, setVideoSize] = useState({ width: 640, height: 480 });
  const [facingMode, setFacingMode] = useState("environment");

  // Removed old capture function

  useEffect(() => {
    if (isScanning && apiKey) {
      loopCapture();
    }
    // We don't return a cleanup function for the loop itself, 
    // but the capture function checks isScanning before proceeding.
  }, [isScanning, apiKey]);
  // Removed capture from dependency to avoid infinite loop re-triggering issues if not careful, but capture is stable via useCallback. 
  // Actually, better to just trigger once when isScanning becomes true.

  // We need to modify capture to call itself if still scanning.
  // But we can't modify the existing capture easily without changing the dependency graph.
  // Let's rewrite the effect and capture logic slightly.

  // Ref to track scanning state inside the async function without dependency issues
  const isScanningRef = useRef(false);
  useEffect(() => {
    isScanningRef.current = isScanning;
    if (isScanning) {
      loopCapture();
    }
  }, [isScanning]);

  const loopCapture = async () => {
    if (!isScanningRef.current || !webcamRef.current || !apiKey) return;

    // Get the video element
    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) {
      requestAnimationFrame(loopCapture);
      return;
    }

    // Create an off-screen canvas to resize the image
    const canvas = document.createElement('canvas');
    const scale = 512 / video.videoWidth; // Resize to 512px width
    canvas.width = 512;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get base64 from resized canvas
    const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]; // Quality 0.7

    try {
      const results = await detectObjects(base64Image, apiKey);
      console.log("Predictions:", results);
      setPredictions(results);
    } catch (error) {
      console.error("Detection failed:", error);
    }

    // Schedule next frame immediately
    if (isScanningRef.current) {
      requestAnimationFrame(loopCapture);
    }
  };

  // Removed duplicate declaration

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  // Removed unused capture placeholder

  // ... loopCapture ...

  const handleStartStop = () => {
    if (!apiKey) {
      alert("Please enter a Gemini API Key first.");
      return;
    }
    setIsScanning(!isScanning);
    if (isScanning) {
      setPredictions([]);
    }
  };

  const handleUserMedia = (mediaStream) => {
    // Get actual video dimensions
    const track = mediaStream.getVideoTracks()[0];
    const settings = track.getSettings();
    setVideoSize({ width: settings.width, height: settings.height });
  };

  return (
    <div className="App">
      <h1>Gemini Robotics Demo</h1>
      <div className="card">
        <div style={{ marginBottom: '20px' }}>
          <input
            type="password"
            placeholder="Enter Gemini API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={isScanning}
          />
          <button onClick={handleStartStop}>
            {isScanning ? 'Stop Scanning' : 'Start Scanning'}
          </button>
          <button onClick={toggleCamera} style={{ marginLeft: '10px' }}>
            Switch Camera
          </button>
        </div>

        <div className="webcam-container">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              width: 1280,
              height: 720,
              facingMode: facingMode
            }}
            className="webcam-video"
            onUserMedia={handleUserMedia}
          />
          <Overlay
            predictions={predictions}
            width={webcamRef.current?.video?.clientWidth || 640}
            height={webcamRef.current?.video?.clientHeight || 480}
          />
        </div>

        <p style={{ marginTop: '20px', color: '#888' }}>
          {isScanning ? "Scanning... (Realtime)" : "Ready to scan"}
        </p>

        {/* Debug Info */}
        <div style={{ marginTop: '20px', textAlign: 'left', background: '#333', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Debug Info</h3>
          <div><strong>Predictions:</strong> {predictions.length}</div>
          {predictions.length > 0 && (
            <pre style={{ overflowX: 'auto' }}>{JSON.stringify(predictions[0], null, 2)} ...</pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
