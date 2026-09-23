import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GradingResult {
  transcript: string;
  grade: number;
  feedback: string;
}

export async function gradeSubmission(
  audioBase64: string, 
  problemTitle: string, 
  problemContext: string,
  question?: string,
  solution?: string
): Promise<GradingResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `You are an expert technical tutor. I am providing an audio recording of a student explaining their solution to a technical problem.
              
              Problem: ${problemTitle}
              ${question ? `Question Description: ${question}` : ''}
              ${solution ? `Ideal Solution: ${solution}` : ''}
              Context/Notes: ${problemContext}
              
              Please:
              1. Transcribe the explanation (best effort).
              2. Grade the explanation on a scale of 1-5 (1: Poor, 5: Excellent).
              3. Provide constructive feedback on logic, clarity, and technical accuracy.
              
              Return the result in JSON format with keys: transcript, grade, feedback.`
            },
            {
              inlineData: {
                mimeType: "audio/webm",
                data: audioBase64
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            grade: { type: Type.NUMBER },
            feedback: { type: Type.STRING }
          },
          required: ["transcript", "grade", "feedback"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from Gemini");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error grading submission:", error);
    throw error;
  }
}
