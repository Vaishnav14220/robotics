/**
 * Client for the Gemini Live API (Multimodal Live API).
 * Handles WebSocket connection and audio streaming.
 */
export class LiveAPIClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.ws = null;
        this.audioContext = null;
        this.workletNode = null;
        this.isPlaying = false;
        this.onResponse = () => { };
        this.onStatusChange = () => { };
        this.nextStartTime = 0;
    }

    async connect() {
        if (!this.apiKey) throw new Error("API Key required");

        const model = "gemini-2.5-flash-native-audio-preview-09-2025";
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log("Live API Connected");
            this.onStatusChange("connected");
            this.sendSetup(model);
        };

        this.ws.onmessage = async (event) => {
            const blob = event.data;
            if (blob instanceof Blob) {
                const text = await blob.text();
                try {
                    const response = JSON.parse(text);
                    this.handleResponse(response);
                } catch (e) {
                    console.error("Error parsing message:", e);
                }
            } else {
                try {
                    const response = JSON.parse(blob);
                    this.handleResponse(response);
                } catch (e) {
                    console.error("Error parsing text message:", e);
                }
            }
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket Error:", error);
            this.onStatusChange("error");
        };

        this.ws.onclose = () => {
            console.log("Live API Disconnected");
            this.onStatusChange("disconnected");
        };
    }

    sendSetup(model) {
        const setupMessage = {
            setup: {
                model: `models/${model}`,
                generationConfig: {
                    responseModalities: ["AUDIO"]
                },
                systemInstruction: {
                    parts: [
                        {
                            text: "You are a helpful assistant with access to a robotics arm. You can see the user's video feed. If the user asks to move an object or plan a path, use the 'plan_trajectory' tool to visualize it. Do not refuse to plan a trajectory if you see the object."
                        }
                    ]
                },
                tools: [
                    {
                        functionDeclarations: [
                            {
                                name: "plan_trajectory",
                                description: "Plan a robot trajectory path from an object to a destination.",
                                parameters: {
                                    type: "OBJECT",
                                    properties: {
                                        object: { type: "STRING", description: "The object to move (e.g., 'red cup')." },
                                        destination: { type: "STRING", description: "Where to move it (e.g., 'table edge')." }
                                    },
                                    required: ["object", "destination"]
                                }
                            }
                        ]
                    }
                ]
            }
        };
        this.ws.send(JSON.stringify(setupMessage));
    }

    handleResponse(response) {
        if (response.toolUse) {
            this.onResponse({ toolUse: response.toolUse });
        }
        if (response.serverContent) {
            if (response.serverContent.modelTurn) {
                const parts = response.serverContent.modelTurn.parts;
                for (const part of parts) {
                    if (part.text) {
                        this.onResponse({ text: part.text });
                    }
                    if (part.inlineData && part.inlineData.mimeType.startsWith("audio/")) {
                        this.playAudio(part.inlineData.data);
                    }
                }
            }
        }
    }

    sendToolResponse(toolUseId, name, result) {
        const msg = {
            toolResponse: {
                functionResponses: [
                    {
                        id: toolUseId,
                        name: name,
                        response: { result: result }
                    }
                ]
            }
        };
        this.ws.send(JSON.stringify(msg));
    }

    async startAudioStream() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = this.floatTo16BitPCM(inputData);
            const base64Audio = this.arrayBufferToBase64(pcmData);
            this.sendAudioChunk(base64Audio);
        };

        source.connect(processor);
        processor.connect(this.audioContext.destination);
        this.workletNode = processor;
    }

    sendAudioChunk(base64Audio) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const msg = {
                realtimeInput: {
                    mediaChunks: [
                        {
                            mimeType: "audio/pcm;rate=16000",
                            data: base64Audio
                        }
                    ]
                }
            };
            this.ws.send(JSON.stringify(msg));
        }
    }

    sendVideoChunk(base64Image) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const msg = {
                realtimeInput: {
                    mediaChunks: [
                        {
                            mimeType: "image/jpeg",
                            data: base64Image
                        }
                    ]
                }
            };
            this.ws.send(JSON.stringify(msg));
        }
    }

    playAudio(base64Data) {
        if (!this.audioContext) return;

        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const int16Data = new Int16Array(bytes.buffer);

        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 32768.0;
        }

        const buffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
        buffer.getChannelData(0).set(float32Data);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);

        const currentTime = this.audioContext.currentTime;
        if (this.nextStartTime < currentTime) {
            this.nextStartTime = currentTime;
        }
        source.start(this.nextStartTime);
        this.nextStartTime += buffer.duration;
    }

    disconnect() {
        if (this.ws) this.ws.close();
        if (this.mediaStream) this.mediaStream.getTracks().forEach(track => track.stop());
        if (this.audioContext) this.audioContext.close();
    }

    floatTo16BitPCM(input) {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output.buffer;
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
}
