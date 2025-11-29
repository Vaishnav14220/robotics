import React, { useState } from 'react';
import { callGemini } from '../services/gemini';

const ObjectDetection = ({ webcamRef, apiKey, onPredictionsUpdate }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleDetect = async () => {
        if (!webcamRef.current || !webcamRef.current.video || !apiKey || !query) {
            if (!apiKey) alert("Please enter a Gemini API Key first.");
            return;
        }

        setIsLoading(true);

        try {
            const video = webcamRef.current.video;

            // Capture frame
            const canvas = document.createElement('canvas');
            const scale = 512 / video.videoWidth;
            canvas.width = 512;
            canvas.height = video.videoHeight * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Image = canvas.toDataURL('image/jpeg', 0.7);

            const results = await callGemini(base64Image, query);
            console.log("Gemini Results:", results);
            onPredictionsUpdate(results);
        } catch (error) {
            console.error("Detection failed:", error);
            alert("Detection failed. See console for details.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="object-detection-controls" style={{
            marginBottom: '20px',
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#2a2a2a',
            padding: '15px',
            borderRadius: '8px'
        }}>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What to detect? (e.g. 'cup', 'person')"
                style={{
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #555',
                    width: '250px',
                    background: '#1a1a1a',
                    color: 'white'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleDetect()}
            />
            <button
                onClick={handleDetect}
                disabled={isLoading || !query}
                style={{
                    padding: '10px 20px',
                    background: isLoading ? '#555' : '#646cff',
                    cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
            >
                {isLoading ? 'Detecting...' : 'Detect'}
            </button>
        </div>
    );
};

export default ObjectDetection;
