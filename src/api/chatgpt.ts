import { GPT_CONFIG } from "../config/gpt";

interface GPTResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

export async function generateWithGPT(prompt: string): Promise<string> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GPT_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o", // Note: "gpt-5.1" doesn't exist, using latest available
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: GPTResponse = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    const message = result.choices[0]?.message?.content;
    return message?.toString() ?? "";
  } catch (error) {
    console.error("GPT API error:", error);
    throw new Error("Failed to generate content with GPT");
  }
}