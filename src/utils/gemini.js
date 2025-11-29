import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_NAME = "gemini-robotics-er-1.5-preview";

/**
 * Detects objects in an image using the Gemini API.
 * @param {string} imageBase64 - Base64 encoded image string (without data:image/... prefix).
 * @param {string} apiKey - The user's API key.
 * @returns {Promise<Array<{label: string, point: number[]}>>} - Array of detected objects.
 */
export async function detectObjects(imageBase64, apiKey) {
    if (!apiKey) {
        throw new Error("API Key is required");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Point to no more than 10 items in the image. The label returned should be an identifying name for the object detected. The answer should follow the json format: [{"point": [y, x], "label": "label1"}, ...]. The points are in [y, x] format normalized to 0-1000.`;

    const imagePart = {
        inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg",
        },
    };

    try {
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();
        console.log("Raw Gemini response:", text);

        // Clean up the response text to ensure it's valid JSON
        const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Gemini API Error:", error);
        return [];
    }
}

export async function detectTrajectory(base64Image, promptText, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-robotics-er-1.5-preview" });

    const fullPrompt = `
    ${promptText}
    The answer should follow the json format: [{"point": [y, x], "label": "label"}]. 
    The points are in [y, x] format normalized to 0-1000.
    Return a list of points representing the trajectory.
    `;

    try {
        const result = await model.generateContent([
            fullPrompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: "image/jpeg",
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();
        console.log("Raw Gemini Trajectory response:", text);

        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            return JSON.parse(jsonStr);
        }
        return [];
    } catch (error) {
        console.error("Gemini Trajectory Error:", error);
        return [];
    }
}
