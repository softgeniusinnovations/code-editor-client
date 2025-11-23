import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_CONFIG } from "../config/gemini";

const genAI = new GoogleGenerativeAI(GEMINI_CONFIG.apiKey);

export async function askGemini(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("API error:", error);
    throw new Error("Location Not Supported Please use VPN and Connect USA or UK or Germany");
  }
}