import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { detectObjects } from './utils/gemini';
import Overlay from './components/Overlay';
import ObjectDetection from './components/ObjectDetection';
import './App.css';
import LiveDemo from './components/LiveDemo';
import { trajectoryData } from './data/trajectoryData';
import HandTracking from './components/HandTracking';
import MediaPipeObjectDetection from './components/MediaPipeObjectDetection';

function App() {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || "");
  const [activeTab, setActiveTab] = useState('robotics'); // 'robotics' or 'live'

  // Robotics State
  const [isScanning, setIsScanning] = useState(false);
  const [isHandTrackingEnabled, setIsHandTrackingEnabled] = useState(false);
  const [isObjectDetectionEnabled, setIsObjectDetectionEnabled] = useState(false);
  const [predictions, setPredictions] = useState({});
  const webcamRef = useRef(null);
  const [videoSize, setVideoSize] = useState({ width: 640, height: 480 });
  const [facingMode, setFacingMode] = useState("environment");

  // Optimization Refs
  const captureCanvasRef = useRef(null);
  const captureContextRef = useRef(null);
  const lastCaptureTimeRef = useRef(0);
  const GEMINI_FPS = 2; // Limit Gemini API calls to 2 FPS
  const GEMINI_INTERVAL = 1000 / GEMINI_FPS;

  // Ref to track scanning state inside the async function without dependency issues
  const isScanningRef = useRef(false);

  // We use a ref to hold the loop function to break cyclic dependency
  const loopCaptureRef = useRef(null);

  const loopCapture = useCallback(async () => {
    if (!isScanningRef.current || !webcamRef.current || !apiKey) return;

    const currentTime = performance.now();
    const timeSinceLastCapture = currentTime - lastCaptureTimeRef.current;

    // Throttle Gemini API calls
    if (timeSinceLastCapture < GEMINI_INTERVAL) {
      if (loopCaptureRef.current) requestAnimationFrame(loopCaptureRef.current);
      return;
    }

    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) {
      if (loopCaptureRef.current) requestAnimationFrame(loopCaptureRef.current);
      return;
    }

    // Reuse canvas and context
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
      captureCanvasRef.current.width = 512;
      captureContextRef.current = captureCanvasRef.current.getContext('2d', { willReadFrequently: true });
    }

    const canvas = captureCanvasRef.current;
    const ctx = captureContextRef.current;

    // Update height if aspect ratio changes (though width is fixed to 512)
    const scale = 512 / video.videoWidth;
    const targetHeight = video.videoHeight * scale;
    if (canvas.height !== targetHeight) {
       canvas.height = targetHeight;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]; // Lower quality slightly for speed

    lastCaptureTimeRef.current = currentTime;

    try {
      const results = await detectObjects(base64Image, apiKey);
      console.log("Predictions:", results);
      setPredictions(prev => ({ ...prev, objects: results }));
    } catch (error) {
      console.error("Detection failed:", error);
    }

    if (isScanningRef.current && loopCaptureRef.current) {
      requestAnimationFrame(loopCaptureRef.current);
    }
  }, [apiKey, GEMINI_INTERVAL]);

  // Update the ref when loopCapture changes
  useEffect(() => {
    loopCaptureRef.current = loopCapture;
  }, [loopCapture]);


  useEffect(() => {
    isScanningRef.current = isScanning;
    if (isScanning && loopCaptureRef.current) {
      loopCaptureRef.current();
    }
  }, [isScanning]); // removed loopCapture from deps because we use ref

  // Moved setIsScanning out of effect to tab change handler
  const handleTabChange = (tab) => {
      setActiveTab(tab);
      if (tab !== 'robotics') {
          setIsScanning(false);
          isScanningRef.current = false;
      }
  };


  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const handleStartStop = () => {
    if (!apiKey) {
      alert("Please enter a Gemini API Key first.");
      return;
    }
    setIsScanning(!isScanning);
    if (isScanning) {
      setPredictions(prev => ({ ...prev, objects: [] }));
    }
  };

  const handleUserMedia = (mediaStream) => {
    const track = mediaStream.getVideoTracks()[0];
    const settings = track.getSettings();
    setVideoSize({ width: settings.width, height: settings.height });
  };

  // Memoized handlers to prevent infinite loops
  const handleHandTrackingResults = useCallback((results) => {
    setPredictions(prev => {
      if (!results) {
        // Only update if we actually have handLandmarks to remove
        if (!prev.handLandmarks) return prev;
        const { handLandmarks, ...rest } = prev; // eslint-disable-line no-unused-vars
        return rest;
      }
      return { ...prev, handLandmarks: results.landmarks };
    });
  }, []);

  const handleObjectDetectionResults = useCallback((results) => {
    setPredictions(prev => {
      if (!results) {
        if (!prev.mediaPipeObjects) return prev;
        const { mediaPipeObjects, ...rest } = prev; // eslint-disable-line no-unused-vars
        return rest;
      }
      return { ...prev, mediaPipeObjects: results.detections };
    });
  }, []);

  return (
    <div className="App">
      <h1>Gemini Robotics & Live Demo</h1>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => handleTabChange('robotics')}
          style={{
            marginRight: '10px',
            background: activeTab === 'robotics' ? '#646cff' : '#1a1a1a'
          }}
        >
          Robotics (Vision)
        </button>
        <button
          onClick={() => handleTabChange('live')}
          style={{
            background: activeTab === 'live' ? '#646cff' : '#1a1a1a'
          }}
        >
          Live API (Audio)
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="password"
          placeholder="Enter Gemini API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ width: '100%', maxWidth: '400px' }}
        />
      </div>

      {activeTab === 'robotics' && (
        <div className="card">
          <div style={{ marginBottom: '20px' }}>
            <ObjectDetection
              webcamRef={webcamRef}
              onPredictions={(newPredictions) => {
                setIsScanning(false);
                setPredictions(prev => ({ ...prev, objects: newPredictions }));
              }}
            />

            <HandTracking
              webcamRef={webcamRef}
              isEnabled={isHandTrackingEnabled}
              onResults={handleHandTrackingResults}
            />

            <MediaPipeObjectDetection
              webcamRef={webcamRef}
              isEnabled={isObjectDetectionEnabled}
              onResults={handleObjectDetectionResults}
            />

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              <button onClick={handleStartStop}>
                {isScanning ? 'Stop Continuous Scan' : 'Start Continuous Scan'}
              </button>
              <button onClick={() => setIsHandTrackingEnabled(!isHandTrackingEnabled)}>
                {isHandTrackingEnabled ? 'Disable Hand Tracking' : 'Enable Hand Tracking'}
              </button>
              <button onClick={() => setIsObjectDetectionEnabled(!isObjectDetectionEnabled)}>
                {isObjectDetectionEnabled ? 'Disable Object Detection' : 'Enable Object Detection'}
              </button>
              <button onClick={toggleCamera}>
                Switch Camera
              </button>
            </div>
          </div>

          <div className="webcam-container" style={{ position: 'relative', display: 'inline-block' }}>
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
              style={{ width: '100%', maxWidth: '640px', height: 'auto' }}
            />
            <Overlay
              predictions={predictions}
              width={videoSize.width}
              height={videoSize.height}
              staticTrajectory={trajectoryData}
            />
          </div>

          <p style={{ marginTop: '20px', color: '#888' }}>
            {isScanning ? "Scanning... (Realtime)" : "Ready to scan"}
          </p>

          <div style={{ marginTop: '20px', textAlign: 'left', background: '#333', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Debug Info</h3>
            <div><strong>Predictions:</strong> {JSON.stringify(Object.keys(predictions))}</div>
            <pre style={{ overflowX: 'auto' }}>{JSON.stringify(predictions, null, 2)}</pre>
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <LiveDemo apiKey={apiKey} />
      )}
    </div>
  );
}

export default App;
