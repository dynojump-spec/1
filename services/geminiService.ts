

import { GoogleGenAI, GenerateContentResponse, Part, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AIRevisionMode, ChatMessage, SearchSource, AssistantPersona } from '../types';

const SYSTEM_INSTRUCTION = `
You are an expert Korean web novel editor (웹소설 PD/Editor).
Your task is to revise the provided text based on specific instructions.

RULES:
1. Output ONLY the revised text. Do not include any explanations, markdown formatting (like \`\`\`), or conversational filler.
2. LANGUAGE: The output MUST be in natural Korean (Hangul), appropriate for web novels.
3. AUTO-COMPLETION: If the input text contains incomplete sentences or fragments (e.g., ends abruptly), you MUST logically and naturally complete the sentence based on the context BEFORE applying the specific revision style.
4. FORMATTING IS CRITICAL - STRICT ADHERENCE REQUIRED: 
   - **PRESERVE LINE BREAKS EXACTLY**: You must maintain the original line breaks (Enter) and paragraph separations.
   - **DO NOT MERGE PARAGRAPHS**: Keep the exact same number of text blocks/paragraphs as the input.
   - **DO NOT ADD EXTRA BLANK LINES**: Maintain the original vertical spacing.
   - **DO NOT ADD NEWLINES INSIDE A SENTENCE**: Keep sentences within their original paragraphs.
`;

// Safety Settings: Disable all filters for creative writing context
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const getPromptForMode = (mode: AIRevisionMode, text: string): string => {
  const formatNote = "매우 중요: 1. 원문의 줄바꿈(엔터) 위치와 문단 구분을 **절대 변경하지 마세요**. 문단을 합치거나 나누지 말고 원형을 유지하세요. 2. 입력된 문장이 미완성(끊김) 상태라면, 문맥에 맞게 자연스럽게 문장을 완성시킨 후 수정하세요.";
  
  switch (mode) {
    case AIRevisionMode.GRAMMAR:
      return `다음 텍스트의 맞춤법, 띄어쓰기, 오탈자를 교정하세요. 문체나 톤은 변경하지 말고 오류만 수정하세요. ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.ACTION:
      return `다음 텍스트의 전투 및 액션 장면을 더 역동적이고 박진감 넘치게 묘사하세요. 타격감, 속도감, 움직임을 생생하게 표현하세요. (반드시 한국어로 작성) ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.DIALOGUE:
      return `다음 텍스트의 대사(대화문)를 캐릭터의 성격이 잘 드러나고 입말(구어체)이 자연스럽게 들리도록 수정하세요. 티키타카와 현장감을 살리세요. (반드시 한국어로 작성) ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.EMOTIONAL:
      return `다음 텍스트의 감정 묘사를 더 깊이 있고 호소력 짙게 수정하세요. 인물의 내면 심리와 분위기를 감각적으로 표현하세요. ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.POLISH:
      return `다음 텍스트를 **세련되고 기품 있는 문체**로 윤문(다듬기)하세요.
      - **핵심**: 불필요한 수식과 군더더기를 과감히 제거하여 문장을 **압축**하세요.
      - **분량**: 결과물의 분량이 원문보다 **늘어나지 않게** 하세요. (원문과 비슷하거나 더 짧게 유지)
      - 단어 선택을 고급스럽게 하되, 호흡을 정돈하여 간결하고 임팩트 있는 문장을 만드세요.
      ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.HANJA:
      return `Identify Sino-Korean words (Hanja-eo) in the following text and append their Chinese characters in parentheses.
      Format: Word -> Word(Hanja)
      Example: 화룡 -> 화룡(火龍), 천하 -> 천하(天下)
      Rules:
      - Only convert meaningful nouns, idioms, or compounds where Hanja clarifies the meaning or adds flavor (common in martial arts/fantasy novels).
      - Do NOT convert native Korean words.
      - Keep the rest of the text exactly as is in Korean.
      ${formatNote}\n\nText:\n${text}`;
    case AIRevisionMode.COMPACT:
      return `다음 텍스트(일명 벽돌체)의 맥락과 의도를 파악하여, 가독성이 좋고 직관적인 문장으로 완전히 재구성하세요. 
      - 불필요한 수식어를 줄이고 문장을 간결하게 만들어, 기존 5~6줄 분량이라면 4~5줄 내외로 줄이되 핵심 내용은 유지하세요.
      - 꽉 막힌 문장을 시원하게 뚫어주고 읽기 편하게 만드세요.
      ${formatNote}\n\n텍스트:\n${text}`;
    case AIRevisionMode.SCENERY:
      return `다음 텍스트(지시문 또는 키워드)를 바탕으로 소설의 배경 묘사를 작성하세요. 
      - 분량은 공백 포함 약 150~300자 내외로 작성하세요.
      - 시각, 청각, 후각 등 감각적인 심상을 활용하여 분위기를 생생하게 살리세요.
      - 문맥에 자연스럽게 녹아들도록 작성하세요.
      ${formatNote}\n\n텍스트:\n${text}`;
    default:
      return `다음 텍스트를 수정하세요. ${formatNote}\n\n텍스트:\n${text}`;
  }
};

// Helper to detect Quota errors
const isQuotaError = (error: any): boolean => {
  const msg = error?.message || '';
  const status = error?.status || error?.code || error?.response?.status;
  return status === 429 || msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('Too Many Requests') || msg.includes('resource has been exhausted');
};

// Helper to translate Gemini errors into friendly Korean messages
const handleGeminiError = (error: any, modelName: string) => {
    const msg = error?.message || '';
    const status = error?.status || error?.code || error?.response?.status;
    
    // 1. Quota / Rate Limits (429)
    if (isQuotaError(error)) {
        throw new Error(`[사용량 한도 초과] 선택하신 모델(${modelName})의 무료 사용량이 초과되었습니다.\n잠시 기다리시거나, 설정에서 더 가벼운 'Flash' 모델로 변경해 주세요.`);
    }

    // 2. Safety Filters (FinishReason: SAFETY)
    if (msg.includes('SAFETY') || msg.includes('blocked') || msg.includes('Safety')) {
        throw new Error(`[안전 필터 차단] AI가 해당 내용을 폭력적이거나 선정적이라고 판단하여 수정을 거부했습니다.\n다른 모델(Flash)을 시도하거나 문장을 조금 다듬어 보세요.`);
    }

    // 3. Recitation / Copyright
    if (msg.includes('RECITATION')) {
        throw new Error(`[저작권/암기 차단] AI가 해당 내용이 기존 저작물과 너무 유사하다고 판단하여 차단했습니다.`);
    }

    // 4. Cancellation
    if (msg.includes("Operation cancelled") || msg.includes("aborted") || error?.name === 'AbortError') {
        throw error; // Re-throw cancellation to be handled silently
    }

    // 5. Invalid Key
    if (status === 400 && (msg.includes('API key') || msg.includes('INVALID_ARGUMENT'))) {
        throw new Error(`[API 키 오류] 유효하지 않은 API 키입니다. 설정에서 키를 다시 확인해주세요.`);
    }

    // Default
    throw error;
};

// Helper for immediate cancellation race
const raceWithSignal = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error("Operation cancelled"));

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const abortHandler = () => {
        signal.removeEventListener('abort', abortHandler);
        reject(new Error("Operation cancelled"));
      };
      signal.addEventListener('abort', abortHandler);
    })
  ]);
};

// Retry utility (wait logic)
const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
        reject(new Error("Operation cancelled"));
        return;
    }
    const timer = setTimeout(() => {
        resolve();
        signal?.removeEventListener('abort', abortHandler);
    }, ms);
    
    const abortHandler = () => {
        clearTimeout(timer);
        reject(new Error("Operation cancelled"));
    };
    signal?.addEventListener('abort', abortHandler);
});

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000, signal?: AbortSignal): Promise<T> {
  try {
    return await raceWithSignal(fn(), signal);
  } catch (error: any) {
    const msg = error?.message || '';
    const status = error?.status || error?.code;
    
    // Do not retry if aborted, 429 (Quota), or Safety Block
    if (msg.includes('aborted') || msg.includes('cancelled') || msg.includes('Operation cancelled')) {
      throw error;
    }
    // IMPORTANT: Fail immediately on 429
    if (isQuotaError(error) || msg.includes('SAFETY') || msg.includes('blocked')) {
      throw error; 
    }
    
    const shouldRetry = retries > 0 && (
      msg.includes('xhr error') || 
      msg.includes('fetch failed') || 
      msg.includes('NetworkError') ||
      status === 500 || 
      status === 503 ||
      status === 'UNKNOWN'
    );

    if (shouldRetry) {
      console.warn(`API request failed (Status: ${status}). Retrying in ${delay}ms... (${retries} attempts left)`);
      await wait(delay, signal);
      return retryWithBackoff(fn, retries - 1, delay * 2, signal);
    }
    
    throw error;
  }
}

export const generateRevision = async (
  text: string, 
  mode: AIRevisionMode,
  modelName: string = 'gemini-2.5-flash',
  apiKey?: string,
  signal?: AbortSignal
): Promise<string> => {
  const key = (apiKey || process.env.API_KEY || '').trim();
  if (!key) throw new Error("API Key is missing. Please check your settings.");

  const performGeneration = async (targetModel: string) => {
    const ai = new GoogleGenAI({ apiKey: key });
    return await retryWithBackoff<GenerateContentResponse>(async () => {
      const res = await ai.models.generateContent({
        model: targetModel,
        contents: getPromptForMode(mode, text),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7, 
          safetySettings: SAFETY_SETTINGS, // Disable safety filters
        }
      });
      return res;
    }, 3, 1000, signal);
  };

  try {
    const response = await performGeneration(modelName);
    let result = response.text?.trim() || text;
    result = result.replace(/^```(?:html|text)?\s*/i, '').replace(/\s*```$/, '').trim();
    return result; 

  } catch (error: any) {
    // Auto-fallback removed as requested
    handleGeminiError(error, modelName);
    return text;
  }
};

interface ChatResponse {
  text: string;
  sources?: SearchSource[];
}

// General Chat Function for the Assistant Panel
export const chatWithAssistant = async (
  history: ChatMessage[],
  newMessage: string,
  modelName: string = 'gemini-2.5-flash',
  apiKey?: string,
  attachments: ChatMessage['attachments'] = [],
  persona?: AssistantPersona
): Promise<ChatResponse> => {
  const key = (apiKey || process.env.API_KEY || '').trim();
  if (!key) throw new Error("API Key is missing. Please check your settings.");

  // Prepare Contents
  const contents = history
      .filter(msg => !msg.isLoading && (msg.text || (msg.attachments && msg.attachments.length > 0)))
      .map(msg => {
        const parts: Part[] = [];
        if (msg.attachments) {
          msg.attachments.forEach(att => {
            if (att.type === 'image') {
              parts.push({
                inlineData: { mimeType: att.mimeType, data: att.data }
              });
            } else {
              parts.push({
                text: `[File Attachment: ${att.name}]\n${att.data}\n`
              });
            }
          });
        }
        if (msg.text) parts.push({ text: msg.text });
        return { role: msg.role, parts: parts };
      });
    
  const newParts: Part[] = [];
  if (attachments && attachments.length > 0) {
      attachments.forEach(att => {
         if (att.type === 'image') {
           newParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
         } else {
           newParts.push({ text: `[File Attachment: ${att.name}]\n${att.data}\n` });
         }
      });
  }
  newParts.push({ text: newMessage });
  contents.push({ role: 'user', parts: newParts });

  // Build System Instruction
  let baseInstruction = "You are a helpful assistant for a web novel writer (Google Gemini). You can search the web for real-time information if needed. Provide concise, creative, and accurate answers regarding plotting, character names, settings, synonyms, and general knowledge. You communicate in Korean. When files are attached, analyze them to assist the user. IMPORTANT: Use **bold text** (**text**) to emphasize key terms, headers, names, or important conclusions to improve readability.";
  if (persona) {
      let personaInstruction = "";
      if (persona.instruction && persona.instruction.trim()) {
          personaInstruction += `\n\n[ROLE & INSTRUCTION]\n${persona.instruction}`;
      }
      if (persona.knowledge && persona.knowledge.trim()) {
          personaInstruction += `\n\n[KNOWLEDGE BASE / REFERENCE]\n${persona.knowledge}`;
      }
      if (persona.files && persona.files.length > 0) {
         personaInstruction += `\n\n[ATTACHED KNOWLEDGE FILES]`;
         persona.files.forEach(file => {
           personaInstruction += `\n--- START OF FILE: ${file.name} ---\n${file.content}\n--- END OF FILE: ${file.name} ---\n`;
         });
      }
      if (personaInstruction) {
          baseInstruction = `${baseInstruction}${personaInstruction}`;
      }
  }

  const performChat = async (targetModel: string) => {
    const ai = new GoogleGenAI({ apiKey: key });
    return await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: targetModel,
      contents: contents,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: baseInstruction,
        safetySettings: SAFETY_SETTINGS, // Disable safety filters
      }
    }), 3, 1000);
  };

  try {
    const response = await performChat(modelName);
    
    const text = response.text || "죄송합니다. 답변을 생성할 수 없습니다.";
    let sources: SearchSource[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      sources = response.candidates[0].groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web && web.uri && web.title)
        .map((web: any) => ({ title: web.title, uri: web.uri }));
    }
    return { text, sources };

  } catch (error: any) {
    // Auto-fallback removed as requested
    handleGeminiError(error, modelName);
    throw error;
  }
};