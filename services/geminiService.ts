import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AIRevisionMode, ChatMessage } from '../types';

const SYSTEM_INSTRUCTION = `
You are an expert Korean web novel editor (웹소설 PD/Editor).
Your task is to revise the provided text based on specific instructions.

RULES:
1. Output ONLY the revised text. Do not include any explanations, markdown formatting (like \`\`\`), or conversational filler.
2. LANGUAGE: The output MUST be in natural Korean (Hangul), appropriate for web novels.
3. AUTO-COMPLETION: If the input text contains incomplete sentences or fragments (e.g., ends abruptly), you MUST logically and naturally complete the sentence based on the context BEFORE applying the specific revision style.
4. FORMATTING IS CRITICAL: 
   - You must preserve the original line breaks, empty lines, and indentation style exactly.
   - Do NOT merge paragraphs.
   - Do NOT add extra blank lines between paragraphs.
   - Do NOT add newlines inside a sentence.
   - The number of text blocks/paragraphs should generally remain the same.
`;

const getPromptForMode = (mode: AIRevisionMode, text: string): string => {
  // Updated format note to explicitly request sentence completion in Korean
  const formatNote = "중요: 1. 원문의 줄바꿈과 문단 구분을 정확히 유지하세요. 2. 입력된 문장이 미완성(끊김) 상태라면, 문맥에 맞게 자연스럽게 문장을 완성시킨 후 수정하세요.";
  
  switch (mode) {
    case AIRevisionMode.GRAMMAR:
      return `다음 텍스트의 맞춤법, 띄어쓰기, 오탈자를 교정하세요. 문체나 톤은 변경하지 말고 오류만 수정하세요. ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.READABILITY:
      return `다음 텍스트의 문장을 더 매끄럽고 읽기 쉽게 다듬으세요(가독성 개선). 원문의 의미는 유지하되 문장 구조를 개선하세요. ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.ACTION:
      return `다음 텍스트의 전투 및 액션 장면을 더 역동적이고 박진감 넘치게 묘사하세요. 타격감, 속도감, 움직임을 생생하게 표현하세요. (반드시 한국어로 작성) ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.DIALOGUE:
      return `다음 텍스트의 대사(대화문)를 캐릭터의 성격이 잘 드러나고 입말(구어체)이 자연스럽게 들리도록 수정하세요. 티키타카와 현장감을 살리세요. (반드시 한국어로 작성) ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.EMOTIONAL:
      return `다음 텍스트의 감정 묘사를 더 깊이 있고 호소력 짙게 수정하세요. 인물의 내면 심리와 분위기를 감각적으로 표현하세요. ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.POLISH:
      return `다음 텍스트를 더 세련되고 기품 있는 문체로 윤문(다듬기)하세요. 단어 선택을 고급스럽게 하고 문장의 리듬감을 살리세요. ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.HANJA:
      return `Identify Sino-Korean words (Hanja-eo) in the following text and append their Chinese characters in parentheses.
      Format: Word -> Word(Hanja)
      Example: 화룡 -> 화룡(火龍), 천하 -> 천하(天下)
      Rules:
      - Only convert meaningful nouns, idioms, or compounds where Hanja clarifies the meaning or adds flavor (common in martial arts/fantasy novels).
      - Do NOT convert native Korean words.
      - Keep the rest of the text exactly as is in Korean.
      ${formatNote}\n\nText:\n${text}`;
    default:
      return `다음 텍스트를 수정하세요. ${formatNote}\n\n텍스트:\n${text}`;
  }
};

// Retry logic to handle transient network/server errors (Code 6 XHR, 500, 503)
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const msg = error?.message || '';
    const status = error?.status || error?.code;
    
    // Retry conditions: Network errors (xhr), Server errors (5xx)
    const shouldRetry = retries > 0 && (
      msg.includes('xhr error') || 
      msg.includes('fetch failed') || 
      msg.includes('NetworkError') ||
      status === 500 || 
      status === 503 ||
      status === 'UNKNOWN' // Code 6 often maps to UNKNOWN status in some SDK versions
    );

    if (shouldRetry) {
      console.warn(`API request failed (Status: ${status}). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

export const generateRevision = async (
  text: string, 
  mode: AIRevisionMode,
  modelName: string = 'gemini-3-pro-preview',
  apiKey?: string
): Promise<string> => {
  try {
    const key = (apiKey || process.env.API_KEY || '').trim();
    if (!key) {
      throw new Error("API Key is missing. Please check your settings.");
    }

    const ai = new GoogleGenAI({ apiKey: key });
    
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelName,
      contents: getPromptForMode(mode, text),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7, 
      }
    }));

    let result = response.text?.trim() || text;
    
    // Remove Markdown code blocks if present
    result = result.replace(/^```(?:html|text)?\s*/i, '').replace(/\s*```$/, '').trim();
    
    return result; 
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// General Chat Function for the Assistant Panel
export const chatWithAssistant = async (
  history: ChatMessage[],
  newMessage: string,
  modelName: string = 'gemini-2.5-flash',
  apiKey?: string
): Promise<string> => {
  try {
    const key = (apiKey || process.env.API_KEY || '').trim();
    if (!key) {
      throw new Error("API Key is missing. Please check your settings.");
    }

    const ai = new GoogleGenAI({ apiKey: key });

    // Transform internal ChatMessage format to Gemini API content format
    const contents = history
      .filter(msg => !msg.isLoading && msg.text)
      .map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));
    
    // Add the new message
    contents.push({
      role: 'user',
      parts: [{ text: newMessage }]
    });

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: "You are a helpful assistant for a web novel writer. Provide concise, creative, and accurate answers regarding plotting, character names, settings, synonyms, and general knowledge. You communicate in Korean.",
      }
    }));

    return response.text || "죄송합니다. 답변을 생성할 수 없습니다.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};
