import { GoogleGenAI } from "@google/genai";
import { Message, Role, Attachment, GroundingSource } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface SendMessageOptions {
  history: Message[];
  newMessage: string;
  attachments?: Attachment[];
  useSearch: boolean;
  modelId: string;
  onChunk: (text: string) => void;
  onGrounding: (sources: GroundingSource[]) => void;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const streamGeminiResponse = async ({
  history,
  newMessage,
  attachments = [],
  useSearch,
  modelId,
  onChunk,
  onGrounding
}: SendMessageOptions) => {
  let attempt = 0;
  const maxRetries = 3;
  let currentModelId = modelId;

  while (attempt <= maxRetries) {
    try {
      // 1. Prepare Tools
      const tools = [];
      if (useSearch) {
        tools.push({ googleSearch: {} });
      }

      // 2. Prepare Contents (History + New Message)
      const contents = history
        .filter(msg => !msg.isThinking && msg.text) 
        .map(msg => {
          const parts = [{ text: msg.text }];
          return {
            role: msg.role === Role.USER ? 'user' : 'model',
            parts: parts
          };
        });

      // 3. Prepare the Current Message Parts
      const currentParts = [];
      
      // Add attachments
      if (attachments.length > 0) {
        attachments.forEach(att => {
          currentParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data
            }
          });
        });
      }
      
      // Add text prompt
      let finalMessage = newMessage;
      if (useSearch && newMessage) {
        finalMessage += "\n(Важно: Используй инструмент Google Search для поиска актуальной информации и подтверждения фактов. Обязательно укажи источники.)";
      }

      if (finalMessage) {
        currentParts.push({ text: finalMessage });
      }

      contents.push({
        role: 'user',
        parts: currentParts
      });

      // 4. Send Request
      const result = await ai.models.generateContentStream({
        model: currentModelId,
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: tools,
          maxOutputTokens: 8192, 
          temperature: 0.7,
        }
      });

      let fullText = "";

      for await (const chunk of result) {
        // Handle Text
        const chunkText = chunk.text;
        if (chunkText) {
          fullText += chunkText;
          onChunk(fullText);
        }

        // Handle Grounding (Search Results)
        const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata || chunk.groundingMetadata;
        
        if (groundingMetadata?.groundingChunks) {
          const sources: GroundingSource[] = groundingMetadata.groundingChunks
            .map((c: any) => c.web)
            .filter((w: any) => w && w.uri && w.title);
          
          if (sources.length > 0) {
            onGrounding(sources);
          }
        }
      }

      // If we finished the stream successfully, break the retry loop
      break;

    } catch (error: any) {
      console.error(`Gemini API Error (Attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isOverloaded = errorMessage.includes("503") || errorMessage.includes("Overloaded");
      const isQuota = errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED");

      // Only retry on 503 (Server Error) or 429 (Rate Limit)
      if ((isOverloaded || isQuota) && attempt < maxRetries) {
        const delay = 1500 * Math.pow(2, attempt); // Exponential backoff: 1.5s, 3s, 6s
        console.log(`Retrying in ${delay}ms...`);
        
        // INTELLIGENT FALLBACK:
        // If we hit a quota limit (429) AND Search is enabled AND we aren't already using the stable experimental model:
        // Switch to 'gemini-2.0-flash-exp' which often has separate/better limits for tools.
        if (isQuota && useSearch && currentModelId !== 'gemini-2.0-flash-exp') {
            currentModelId = 'gemini-2.0-flash-exp';
            onChunk("⚠️ Лимит модели при поиске (429). Переключение на Gemini 2.0 Flash...");
        } else if (attempt === 0) {
             onChunk("Сервер занят, повторная попытка...");
        }

        await sleep(delay);
        attempt++;
        continue;
      }

      // Final Error Handling
      let finalErrorMsg = "Произошла неизвестная ошибка.";
      
      if (isQuota) {
        finalErrorMsg = `Превышен лимит запросов (429). \n\nЭто частая проблема при использовании веб-поиска на бесплатных тарифах. \nПопробуйте отключить "Web" или подождите немного.`;
      } else if (isOverloaded) {
        finalErrorMsg = "Серверы Google перегружены (503). Пожалуйста, подождите минуту и попробуйте снова.";
      } else if (errorMessage) {
        // Try to extract JSON error message if present
        try {
           const jsonMatch = errorMessage.match(/\{.*\}/);
           if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.error && parsed.error.message) {
                 finalErrorMsg = parsed.error.message;
              }
           } else {
             finalErrorMsg = errorMessage;
           }
        } catch (e) {
           finalErrorMsg = errorMessage;
        }
      }
      
      onChunk("Ошибка: " + finalErrorMsg);
      break; // Exit loop
    }
  }
};