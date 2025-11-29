import React, { useEffect, useRef } from 'react';

const Overlay = ({ predictions, width, height, targetObject, staticTrajectory }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(0);

    // Helper to calculate distance between two points
    const getDistance = (p1, p2) => {
        return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    };

    // Helper to draw an arrowhead
    const drawArrowhead = (ctx, x, y, angle, size = 10, color = '#39ff14') => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, size / 2);
        ctx.lineTo(-size, -size / 2);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const render = () => {
            ctx.clearRect(0, 0, width, height);

            // Update animation offset
            animationRef.current = (animationRef.current + 2) % 100; // Speed of flow

            // Determine which trajectory to use
            let trajectoryPoints = [];
            if (staticTrajectory && staticTrajectory.length > 0) {
                trajectoryPoints = staticTrajectory;
            } else if (predictions.trajectory && predictions.trajectory.length > 0) {
                trajectoryPoints = predictions.trajectory;
            }

            // 1. Draw Trajectory - REMOVED as per user request
            // if (trajectoryPoints.length > 0) { ... }

            // 2. Draw Object Labels (Standard)
            const objects = Array.isArray(predictions) ? predictions : (predictions.objects || []);
            objects.forEach((prediction) => {
                const [y, x] = prediction.point;
                const xPixel = (x / 1000) * width;
                const yPixel = (y / 1000) * height;
                const label = prediction.label;

                ctx.fillStyle = '#00d2ff';
                ctx.beginPath();
                ctx.arc(xPixel, yPixel, 5, 0, 2 * Math.PI);
                ctx.fill();

                const textWidth = ctx.measureText(label).width;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(xPixel + 8, yPixel - 12, textWidth + 8, 20);
                ctx.fillStyle = '#ffffff';
                ctx.font = '14px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(label, xPixel + 12, yPixel + 4);
            });

            // 3. Draw Hand Landmarks
            if (predictions.handLandmarks && predictions.handLandmarks.length > 0) {
                const HAND_CONNECTIONS = [
                    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
                    [0, 5], [5, 6], [6, 7], [7, 8], // Index
                    [5, 9], [9, 10], [10, 11], [11, 12], // Middle
                    [9, 13], [13, 14], [14, 15], [15, 16], // Ring
                    [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
                ];

                for (const landmarks of predictions.handLandmarks) {
                    // Draw connections
                    ctx.strokeStyle = '#00FF00';
                    ctx.lineWidth = 2;
                    for (const [start, end] of HAND_CONNECTIONS) {
                        const p1 = landmarks[start];
                        const p2 = landmarks[end];
                        ctx.beginPath();
                        ctx.moveTo(p1.x * width, p1.y * height);
                        ctx.lineTo(p2.x * width, p2.y * height);
                        ctx.stroke();
                    }

                    // Draw landmarks
                    ctx.fillStyle = '#FF0000';
                    for (const landmark of landmarks) {
                        ctx.beginPath();
                        ctx.arc(landmark.x * width, landmark.y * height, 4, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }
            }

            // 4. Draw MediaPipe Objects
            if (predictions.mediaPipeObjects && predictions.mediaPipeObjects.length > 0) {
                for (const detection of predictions.mediaPipeObjects) {
                    const { boundingBox, categories } = detection;
                    const { originX, originY, width: boxWidth, height: boxHeight } = boundingBox;
                    const category = categories[0];
                    const label = `${category.categoryName} ${(category.score * 100).toFixed(1)}%`;

                    // Draw bounding box
                    // MediaPipe returns pixel coordinates, so we use them directly.
                    // If they were normalized (0-1), we would multiply by width/height.
                    // We can check if they are small (< 1.0) to be safe, but usually they are pixels.

                    const x = originX;
                    const y = originY;
                    const w = boxWidth;
                    const h = boxHeight;

                    ctx.strokeStyle = '#FF00FF';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x, y, w, h);

                    // Draw label background
                    const textWidth = ctx.measureText(label).width;
                    ctx.fillStyle = 'rgba(255, 0, 255, 0.7)';
                    ctx.fillRect(x, y - 25, textWidth + 10, 25);

                    // Draw label text
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 16px Inter, sans-serif';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(label, x + 5, y - 5);
                }
            }

            requestAnimationFrame(render);
        };

        const animationId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationId);

    }, [predictions, width, height, targetObject, staticTrajectory]);

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
