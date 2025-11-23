import { DEEPSEEK_CONFIG } from "../config/deepseek";

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

export async function generateWithDeepSeek(prompt: string): Promise<string> {
  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
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

    const result: DeepSeekResponse = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    const message = result.choices[0]?.message?.content;
    return message?.toString() ?? "";
  } catch (error) {
    console.error("DeepSeek API error:", error);
    throw new Error("Failed to generate content with DeepSeek");
  }
}