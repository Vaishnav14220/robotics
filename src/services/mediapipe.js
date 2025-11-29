import { FilesetResolver, HandLandmarker, ObjectDetector } from "@mediapipe/tasks-vision";

let handLandmarker = null;
let objectDetector = null;
let runningMode = "VIDEO";

export async function initializeHandLandmarker() {
    if (handLandmarker) return handLandmarker;

    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: runningMode,
            numHands: 2
        });

        console.log("HandLandmarker initialized");
        return handLandmarker;
    } catch (error) {
        console.error("Error initializing HandLandmarker:", error);
        throw error;
    }
}

export async function initializeObjectDetector() {
    if (objectDetector) return objectDetector;

    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        objectDetector = await ObjectDetector.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
                delegate: "GPU"
            },
            scoreThreshold: 0.5,
            runningMode: runningMode
        });

        console.log("ObjectDetector initialized");
        return objectDetector;
    } catch (error) {
        console.error("Error initializing ObjectDetector:", error);
        throw error;
    }
}

export function detectHands(videoElement) {
    if (!handLandmarker) return null;

    // Ensure running mode is correct
    if (runningMode !== "VIDEO") {
        runningMode = "VIDEO";
        handLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    const startTimeMs = performance.now();
    const results = handLandmarker.detectForVideo(videoElement, startTimeMs);
    return results;
}

export function detectObjectsMediaPipe(videoElement) {
    if (!objectDetector) return null;

    if (runningMode !== "VIDEO") {
        runningMode = "VIDEO";
        objectDetector.setOptions({ runningMode: "VIDEO" });
    }

    const startTimeMs = performance.now();
    const results = objectDetector.detectForVideo(videoElement, startTimeMs);
    return results;
}
