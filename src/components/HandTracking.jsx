import React, { useState, useEffect, useRef } from 'react';
import { initializeHandLandmarker, detectHands } from '../services/mediapipe';

const HandTracking = ({ webcamRef, onResults, isEnabled }) => {
    const [isInitialized, setIsInitialized] = useState(false);
    const requestRef = useRef();

    useEffect(() => {
        const init = async () => {
            await initializeHandLandmarker();
            setIsInitialized(true);
        };
        init();
    }, []);

    const loop = () => {
        if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
            const results = detectHands(webcamRef.current.video);
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
        return <div style={{ color: '#888', fontSize: '12px' }}>Initializing Hand Tracking...</div>;
    }

    return null; // Logic only component
};

export default HandTracking;
