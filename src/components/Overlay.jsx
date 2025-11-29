import React, { useEffect, useRef } from 'react';

const Overlay = ({ predictions, width, height }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        // Set styles
        ctx.font = '16px Inter, sans-serif';
        ctx.lineWidth = 3;

        predictions.forEach((prediction) => {
            const [y, x] = prediction.point;
            const xPixel = (x / 1000) * width;
            const yPixel = (y / 1000) * height;
            const label = prediction.label;

            // Draw point
            ctx.fillStyle = '#00d2ff'; // Cyan
            ctx.beginPath();
            ctx.arc(xPixel, yPixel, 5, 0, 2 * Math.PI);
            ctx.fill();

            // Draw label background
            const textWidth = ctx.measureText(label).width;
            const padding = 4;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(xPixel + 8, yPixel - 12, textWidth + padding * 2, 20);

            // Draw label text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, xPixel + 8 + padding, yPixel + 4);
        });
    }, [predictions, width, height]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                width: '100%',
                height: '100%',
                objectFit: 'cover'
            }}
        />
    );
};

export default Overlay;
