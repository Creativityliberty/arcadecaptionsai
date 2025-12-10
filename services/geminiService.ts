import { GoogleGenAI, Type } from "@google/genai";
import { SubtitleSegment } from "../types";

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateSubtitlesFromAudio = async (audioBlob: Blob): Promise<SubtitleSegment[]> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("No API Key found. Using mock data.");
      return generateMockSubtitles();
    }

    const ai = new GoogleGenAI({ apiKey });
    const base64Audio = await blobToBase64(audioBlob);

    // Schema for the response
    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start: { type: Type.NUMBER, description: "Start time in seconds relative to video start" },
          end: { type: Type.NUMBER, description: "End time in seconds" },
          text: { type: Type.STRING, description: "The spoken text, cleaned and formatted" },
          emotion: { 
            type: Type.STRING, 
            description: "The emotion of the segment. One of: anger, joy, sad, neutral, hype",
            enum: ["anger", "joy", "sad", "neutral", "hype"]
          }
        },
        required: ["start", "end", "text", "emotion"]
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || "audio/webm",
              data: base64Audio
            }
          },
          {
            text: `
            Analyze this audio. 
            1. Transcribe the speech to text. 
            2. Break it down into short, punchy subtitle segments suitable for a fast-paced TikTok/Reels video.
            3. Assign an emotion (anger, joy, sad, neutral, hype) to each segment based on the tone of voice and content.
            4. Ensure 'start' and 'end' timestamps are accurate relative to the beginning of the audio.
            5. If the audio is silent or unintelligible, return an empty array.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return data as SubtitleSegment[];
    }
    
    throw new Error("No response text from Gemini");

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback for demo purposes if API fails or key is missing
    return generateMockSubtitles(); 
  }
};

const generateMockSubtitles = (): Promise<SubtitleSegment[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { start: 0.5, end: 2.0, text: "Processing failed (check API Key)", emotion: "neutral" },
        { start: 2.2, end: 4.0, text: "But here is a demo of the style!", emotion: "hype" },
        { start: 4.2, end: 6.0, text: "Look at this ANGER animation!", emotion: "anger" },
        { start: 6.2, end: 8.0, text: "And this smooth joy...", emotion: "joy" }
      ]);
    }, 2000);
  });
};