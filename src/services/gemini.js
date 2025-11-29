import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Initialize the Google Generative AI client
// Ensure API key is available before using
let genAI = null;
if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
}

export async function callGemini(imageBase64, objectQuery) {
    if (!API_KEY) {
        console.error("VITE_GEMINI_API_KEY is not set");
        throw new Error("VITE_GEMINI_API_KEY is not set. Please add it to your .env file.");
    }

    if (!genAI) {
        genAI = new GoogleGenerativeAI(API_KEY);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

    const prompt = `
    Get all points matching ${objectQuery}. The label returned should be an identifying
    name for the object detected.

    The answer should follow the JSON format:
    [{"point": [y, x], "label": "label1"}, ...]

    The points are in [y, x] format normalized to 0-1000.
    Return ONLY the JSON array.
  `;

    // Remove the data:image/jpeg;base64, prefix if present
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const imagePart = {
        inlineData: {
            data: base64Data,
            mimeType: "image/jpeg",
        },
    };

    try {
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error calling Gemini:", error);
        throw error;
    }
}
