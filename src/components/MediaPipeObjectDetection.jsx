import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeObjectDetector, detectObjectsMediaPipe } from '../services/mediapipe';

const MediaPipeObjectDetection = ({ webcamRef, onResults, isEnabled }) => {
    const [isInitialized, setIsInitialized] = useState(false);
    const requestRef = useRef();
    const lastTimeRef = useRef(0);
    const FPS = 10; // Limit to 10 FPS as object detection can be heavier
    const INTERVAL = 1000 / FPS;
    const loopRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            await initializeObjectDetector();
            setIsInitialized(true);
        };
        init();
    }, []);

    const loop = useCallback((timestamp) => {
        if (loopRef.current) {
            requestRef.current = requestAnimationFrame(loopRef.current);
        }

        const elapsed = timestamp - lastTimeRef.current;
        if (elapsed < INTERVAL) {
            return;
        }

        lastTimeRef.current = timestamp - (elapsed % INTERVAL);

        if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
            const results = detectObjectsMediaPipe(webcamRef.current.video);
            if (results) {
                onResults(results);
            }
        }
    }, [webcamRef, onResults, INTERVAL]);

    useEffect(() => {
        loopRef.current = loop;
    }, [loop]);

    useEffect(() => {
        if (isEnabled && isInitialized && loopRef.current) {
            requestRef.current = requestAnimationFrame(loopRef.current);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            // Clear results when disabled
            onResults(null);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isEnabled, isInitialized, onResults]);

    if (!isInitialized) {
        return <div style={{ color: '#888', fontSize: '12px' }}>Initializing Object Detector...</div>;
    }

    return null; // Logic only component
};

export default MediaPipeObjectDetection;
