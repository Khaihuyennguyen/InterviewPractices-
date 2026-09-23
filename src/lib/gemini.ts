import { GoogleGenAI, Type } from "@google/genai";

import { Card, Topic, Difficulty } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateStarterCards(topic: Topic, difficulty: Difficulty, count: number = 5) {
  const prompt = `Generate ${count} high-quality spaced repetition flashcards for ${topic} at a ${difficulty} level. 
  Each card should have a question (can include code snippets in markdown), a concise answer, and a detailed explanation.
  The explanation should clarify the concept being tested and why the correct answer is right.
  Assign a specific sub-topic (e.g., 'Data Types', 'SELECT Statements', 'Functions', 'JOINs').
  Return as a JSON array of objects with keys: question, answer, explanation, subTopic.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            subTopic: { type: Type.STRING },
          },
          required: ["question", "answer", "explanation", "subTopic"],
        },
      },
    },
  });

  return JSON.parse(response.text);
}
