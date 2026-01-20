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

export const streamGeminiResponse = async ({
  history,
  newMessage,
  attachments = [],
  useSearch,
  modelId,
  onChunk,
  onGrounding
}: SendMessageOptions) => {
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
      // Force the model to understand it has tools and should use them for updated info
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
      model: modelId,
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
      // Check candidate level (standard) and top level (sometimes occurs in streams)
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

  } catch (error) {
    console.error("Gemini API Error:", error);
    let errorMessage = "Произошла неизвестная ошибка.";
    if (error instanceof Error) {
       errorMessage = error.message;
       if (errorMessage.includes("429") || errorMessage.includes("quota")) {
         errorMessage = "Превышен лимит запросов API (429). Попробуйте сменить модель на 'Gemini 3 Flash' в боковом меню или подождите немного.";
       }
    }
    onChunk("Ошибка: " + errorMessage);
  }
};