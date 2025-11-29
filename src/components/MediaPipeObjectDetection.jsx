import React, { useState, useEffect, useRef } from 'react';
import { initializeObjectDetector, detectObjectsMediaPipe } from '../services/mediapipe';

const MediaPipeObjectDetection = ({ webcamRef, onResults, isEnabled }) => {
    const [isInitialized, setIsInitialized] = useState(false);
    const requestRef = useRef();

    useEffect(() => {
        const init = async () => {
            await initializeObjectDetector();
            setIsInitialized(true);
        };
        init();
    }, []);

    const loop = () => {
        if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
            const results = detectObjectsMediaPipe(webcamRef.current.video);
            if (results) {
                onResults(results);
            }
        }
        requestRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => {
        if (isEnabled && isInitialized) {
            requestRef.current = requestAnimationFrame(loop);
        } else {
            cancelAnimationFrame(requestRef.current);
            // Clear results when disabled
            onResults(null);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [isEnabled, isInitialized, webcamRef, onResults]);

    if (!isInitialized) {
        return <div style={{ color: '#888', fontSize: '12px' }}>Initializing Object Detector...</div>;
    }

    return null; // Logic only component
};

export default MediaPipeObjectDetection;
