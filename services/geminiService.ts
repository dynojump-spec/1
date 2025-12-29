
import { GoogleGenAI, GenerateContentResponse, Part, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AIRevisionMode, ChatMessage, SearchSource, AssistantPersona, KnowledgeFile } from '../types';

// --- SYSTEM INSTRUCTIONS ---

// 1. REVISION INSTRUCTION (For Editor: Fast, Strict, Segment-Only)
const REVISION_SYSTEM_INSTRUCTION = `
You are a precise text processing engine for a Korean web novel editor.
Your ONLY goal is to rewrite the input text according to the user's specific mode.

CRITICAL RULES:
1. **OUTPUT ONLY THE RESULT**: Do not add "Here is the revised text", "I modified it", or markdown code blocks like \`\`\`. Just output the text.
2. **PRESERVE FORMATTING**: 
   - Keep line breaks (Enter) exactly as they are.
   - Do not merge paragraphs. 
   - Do not add extra blank lines.
3. **CONTEXT**: The input is a fragment of a story. If a sentence is cut off, complete it logically before revising.
4. **LANGUAGE**: Natural, high-quality Korean (Web Novel style).
`;

// 2. CHAT INSTRUCTION (For Assistant: Helpful, Conversational, Context-Aware)
const CHAT_SYSTEM_INSTRUCTION_BASE = `
You are an expert Korean web novel editor (웹소설 PD/Editor).
Your task is to assist the writer with plotting, settings, synonyms, and feedback.
You communicate in natural Korean.
IMPORTANT: Use **bold text** (**text**) to emphasize key terms, headers, names, or important conclusions to improve readability.
`;

// Safety Settings: Disable all filters for creative writing context
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const getPromptForMode = (mode: AIRevisionMode, text: string): string => {
  // Simplified prompts for efficiency
  switch (mode) {
    case AIRevisionMode.GRAMMAR:
      return `[MODE: Grammar Fix]\nFix spelling/spacing errors only. Keep tone.\n\nTEXT:\n${text}`;
    case AIRevisionMode.ACTION:
      return `[MODE: Action Upgrade]\nMake combat/action scenes dynamic and impactful.\n\nTEXT:\n${text}`;
    case AIRevisionMode.DIALOGUE:
      return `[MODE: Dialogue Polish]\nMake dialogue sound natural (spoken Korean) and reveal character.\n\nTEXT:\n${text}`;
    case AIRevisionMode.EMOTIONAL:
      return `[MODE: Emotional Deepening]\nEnhance emotional depth and atmosphere.\n\nTEXT:\n${text}`;
    case AIRevisionMode.POLISH:
      return `[MODE: Polish & Compress]\nRemove redundancy. Make sentences concise and elegant. Do not increase length.\n\nTEXT:\n${text}`;
    case AIRevisionMode.HANJA:
      return `[MODE: Hanja Append]\nAppend (Hanja) to key nouns/idioms only (e.g., 화룡(火龍)). Keep native words as is.\n\nTEXT:\n${text}`;
    case AIRevisionMode.COMPACT:
      return `[MODE: De-clutter]\nBreak up "wall of text". Simplify sentences for readability. Keep core meaning.\n\nTEXT:\n${text}`;
    case AIRevisionMode.SCENERY:
      return `[MODE: Scenery Write]\nWrite a background description (150-300 chars) based on this keyword/text.\n\nTEXT:\n${text}`;
    default:
      return `[MODE: General Revision]\nRevise this text naturally.\n\nTEXT:\n${text}`;
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
        const isPro = modelName.includes('pro');
        const limitExplanation = isPro 
          ? `[원인] **'${modelName}'** 모델의 무료 하루 한도는 **약 50회**로 매우 적습니다. 혹은 대화가 너무 길어 **분당 토큰 한도(TPM)**를 초과했을 수 있습니다.` 
          : `[원인] **'${modelName}'** 모델의 사용량이 많거나, **설정에 첨부된 파일 용량**이 너무 커서 일시적인 한도 초과가 발생했습니다.`;

        throw new Error(
            `[사용량 한도 초과 (429)]\n` +
            `AI 모델이 현재 과부하 상태입니다.\n\n` +
            `${limitExplanation}\n\n` +
            `[해결 방법]\n` +
            `1. **자동 재시도 실패**: 시스템이 여러 번 재시도했으나 실패했습니다.\n` +
            `2. **Pro 모델 주의**: Pro 모델은 2MB 이상의 파일을 무료로 처리하기 어렵습니다. 'Flash' 모델을 사용하세요.\n` +
            `3. **잠시 대기**: 1~2분 후 다시 시도해보세요.`
        );
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
        throw error; 
    }

    // 5. Invalid Key
    if (status === 400 && (msg.includes('API key') || msg.includes('INVALID_ARGUMENT'))) {
        throw new Error(`[API 키 오류] 유효하지 않은 API 키입니다. 설정에서 키를 다시 확인해주세요.`);
    }
    
    // 6. Not Found (Model ID invalid)
    if (status === 404 || msg.includes('Not Found') || msg.includes('models/')) {
        throw new Error(
            `[모델 찾을 수 없음 (404)]\n` +
            `선택하신 '${modelName}' 모델을 사용할 수 없습니다.\n` +
            `설정된 모델 ID가 구형이거나 잘못되었습니다.\n\n` +
            `해결 방법: 설정 메뉴에서 **'Gemini 2.5 Flash'** 등 최신 모델로 다시 선택해주세요.`
        );
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

// Enhanced Retry Logic for Large Files
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 5, delay = 2000, signal?: AbortSignal): Promise<T> {
  try {
    return await raceWithSignal(fn(), signal);
  } catch (error: any) {
    const msg = error?.message || '';
    const status = error?.status || error?.code;
    
    if (msg.includes('aborted') || msg.includes('cancelled') || msg.includes('Operation cancelled')) {
      throw error;
    }
    
    // Safety & NotFound are fatal
    if (msg.includes('SAFETY') || msg.includes('blocked') || status === 404) {
      throw error; 
    }
    
    // Check for Quota (429) OR Network Errors
    const isQuota = isQuotaError(error);
    const isNetwork = msg.includes('xhr error') || msg.includes('fetch failed') || msg.includes('NetworkError') || status === 503;

    if ((isQuota || isNetwork) && retries > 0) {
      // If Quota error, increase delay significantly (trade time for token bucket refill)
      const nextDelay = isQuota ? Math.max(delay * 1.5, 5000) : delay * 2;
      
      console.warn(`API request failed (Status: ${status}). Retrying in ${nextDelay/1000}s... (${retries} attempts left)`);
      
      // Wait and retry
      await wait(nextDelay, signal);
      return retryWithBackoff(fn, retries - 1, nextDelay, signal);
    }
    
    throw error;
  }
}

// --- EDITOR REVISION FUNCTION (OPTIMIZED SEGMENT-ONLY) ---
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
          // Use Strict Revision Instruction
          systemInstruction: REVISION_SYSTEM_INSTRUCTION,
          temperature: 0.6, // Slightly lower for precision
          safetySettings: SAFETY_SETTINGS,
          // IMPORTANT: Do NOT include tools like googleSearch for revisions. 
          // This ensures "Smart Extraction"-like efficiency (only processing text).
        }
      });
      return res;
    }, 3, 1000, signal);
  };

  try {
    const response = await performGeneration(modelName);
    let result = response.text?.trim() || text;
    // Clean up any Markdown code blocks if the model hallucinates them
    result = result.replace(/^```(?:html|text)?\s*/i, '').replace(/\s*```$/, '').trim();
    return result; 

  } catch (error: any) {
    handleGeminiError(error, modelName);
    return text;
  }
};

interface ChatResponse {
  text: string;
  sources?: SearchSource[];
}

// --- CHAT ASSISTANT FUNCTION (FULL CONTEXT AWARE) ---
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

  // DYNAMIC CONTEXT PRUNING
  const hasFiles = (persona?.files?.length || 0) > 0;
  const MAX_HISTORY_CHARS = hasFiles ? 5000 : 20000; 
  
  let currentChars = 0;
  const reversedHistory = [...history].reverse();
  const selectedMessages: ChatMessage[] = [];

  for (const msg of reversedHistory) {
      if (msg.isLoading || (!msg.text && (!msg.attachments || msg.attachments.length === 0))) continue;
      if (msg.role === 'model' && msg.id === 'welcome') continue;
      
      const msgLen = (msg.text?.length || 0) + 200; 
      if (currentChars + msgLen > MAX_HISTORY_CHARS) break;
      
      selectedMessages.push(msg);
      currentChars += msgLen;
  }

  const optimizedHistory = selectedMessages.reverse();

  const contents = optimizedHistory.map(msg => {
    const parts: Part[] = [];
    if (msg.attachments) {
      msg.attachments.forEach(att => {
        if (att.type === 'image') {
          parts.push({
            inlineData: { mimeType: att.mimeType, data: att.data }
          });
        } else {
          parts.push({
            text: `[Attached File: ${att.name}]\n${att.data.substring(0, 5000)}...\n`
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

  // Build System Instruction for Chat
  let finalInstruction = CHAT_SYSTEM_INSTRUCTION_BASE;
  
  if (persona) {
      let personaInstruction = "";
      if (persona.instruction && persona.instruction.trim()) {
          personaInstruction += `\n\n[ROLE & INSTRUCTION]\n${persona.instruction}`;
      }
      if (persona.knowledge && persona.knowledge.trim()) {
          personaInstruction += `\n\n[KNOWLEDGE BASE]\n${persona.knowledge}`;
      }
      
      // FULL CONTENT STRATEGY (For Assistant)
      if (persona.files && persona.files.length > 0) {
         personaInstruction += `\n\n[REFERENCE MATERIALS]`;
         
         for (const file of persona.files) {
             personaInstruction += `\n--- Start of File: ${file.name} ---\n${file.content}\n--- End of File: ${file.name} ---\n`;
         }
      }
      
      if (personaInstruction) {
          finalInstruction = `${finalInstruction}${personaInstruction}`;
      }
  }

  const performChat = async (targetModel: string) => {
    const ai = new GoogleGenAI({ apiKey: key });
    // Aggressive Retry: 5 attempts, starting with 5s delay.
    return await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: targetModel,
      contents: contents,
      config: {
        tools: [{ googleSearch: {} }], // Chat keeps Search
        systemInstruction: finalInstruction,
        safetySettings: SAFETY_SETTINGS, 
      }
    }), 5, 5000); 
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
    handleGeminiError(error, modelName);
    throw error;
  }
};
