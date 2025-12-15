
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

// --- Local RAG Helper Functions ---

/**
 * Split text into chunks (paragraphs or fixed size)
 */
const splitIntoChunks = (text: string, chunkSize: number = 1000): string[] => {
  // Primarily split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  
  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      // If paragraph is too huge, split by length
      for (let i = 0; i < para.length; i += chunkSize) {
        chunks.push(para.slice(i, i + chunkSize));
      }
    } else if (para.trim().length > 0) {
      chunks.push(para);
    }
  }
  return chunks;
};

/**
 * Simple keyword extraction and scoring to find relevant context
 */
const findRelevantChunks = (query: string, fullText: string, topK: number = 8): string => {
  if (!fullText || fullText.length < 5000) return fullText; // Return all if small enough

  const chunks = splitIntoChunks(fullText);
  
  // Tokenize query: remove special chars, split by space, filter empty
  const queryTerms = query.replace(/[^\w\s\uAC00-\uD7A3]/g, ' ').split(/\s+/).filter(t => t.length > 1);
  
  if (queryTerms.length === 0) {
      // If no valid keywords (e.g. "summarize this"), take beginning, middle, and end samples
      const start = chunks.slice(0, 3).join('\n\n');
      const mid = chunks.slice(Math.floor(chunks.length / 2), Math.floor(chunks.length / 2) + 2).join('\n\n');
      const end = chunks.slice(-3).join('\n\n');
      return `[Note: Query was generic, providing samples from text]\n\n--- Beginning ---\n${start}\n\n--- Middle ---\n${mid}\n\n--- End ---\n${end}`;
  }

  const scores = chunks.map((chunk, index) => {
    let score = 0;
    const chunkText = chunk.toLowerCase();
    
    // Term Frequency Scoring
    queryTerms.forEach(term => {
       if (chunkText.includes(term.toLowerCase())) {
         score += 1;
         // Bonus for exact phrases if possible, but keeping it simple for now
       }
    });

    // Recency Bias (Slightly prefer later chunks for plot progression, if scores are equal)
    const positionBias = index / chunks.length * 0.1; 

    return { index, chunk, score: score + positionBias };
  });

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Take top K chunks
  const topChunks = scores.slice(0, topK);
  
  // Re-sort by original index to maintain narrative flow
  topChunks.sort((a, b) => a.index - b.index);

  return topChunks.map(item => item.chunk).join('\n\n...\n\n');
};

// --- End Local RAG Helpers ---

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
        const isPro = modelName.includes('pro');
        const limitExplanation = isPro 
          ? `[원인] **'${modelName}'** 모델의 무료 하루 한도는 **약 50회**로 매우 적습니다. 혹은 대화가 너무 길어 **분당 토큰 한도(TPM)**를 초과했을 수 있습니다.` 
          : `[원인] **'${modelName}'** 모델의 사용량이 많거나, **설정에 첨부된 파일 용량**이 너무 커서 일시적인 한도 초과가 발생했습니다.`;

        throw new Error(
            `[사용량 한도 초과 (429)]\n` +
            `선택하신 '${modelName}' 모델의 사용량이 소진되었습니다.\n\n` +
            `${limitExplanation}\n\n` +
            `[해결 방법]\n` +
            `1. **참조 파일 확인**: 참조 파일이 너무 크면(예: 소설 전체), AI가 검색하여 일부만 읽도록 시스템이 자동 처리하지만, 여전히 부하가 클 수 있습니다.\n` +
            `2. **새로운 대화 시작**: 대화 내용이 길어지면 토큰 소모량이 급증합니다.\n` +
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

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000, signal?: AbortSignal): Promise<T> {
  try {
    return await raceWithSignal(fn(), signal);
  } catch (error: any) {
    const msg = error?.message || '';
    const status = error?.status || error?.code;
    
    if (msg.includes('aborted') || msg.includes('cancelled') || msg.includes('Operation cancelled')) {
      throw error;
    }
    if (isQuotaError(error) || msg.includes('SAFETY') || msg.includes('blocked') || status === 404) {
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
          safetySettings: SAFETY_SETTINGS, 
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

  // Character Budget to avoid TPM errors.
  const MAX_HISTORY_CHARS = 15000; 
  
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

  // Construct Content Parts
  const contents = optimizedHistory.map(msg => {
    const parts: Part[] = [];
    if (msg.attachments) {
      msg.attachments.forEach(att => {
        if (att.type === 'image') {
          parts.push({
            inlineData: { mimeType: att.mimeType, data: att.data }
          });
        } else {
          // Note: Previous logic handled text files as simple text attachments in history.
          // For LARGE files in history, we should probably summarize or skip, but for now we assume simple attachments.
          parts.push({
            text: `[Attached File: ${att.name}]\n${att.data.substring(0, 5000)} ${att.data.length > 5000 ? '...(truncated in history)' : ''}\n`
          });
        }
      });
    }
    if (msg.text) parts.push({ text: msg.text });
    return { role: msg.role, parts: parts };
  });
    
  // Current Turn Attachments
  const newParts: Part[] = [];
  if (attachments && attachments.length > 0) {
      attachments.forEach(att => {
         if (att.type === 'image') {
           newParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
         } else {
           // For current turn attachments, if they are small, send as is.
           // If they are large (e.g. user just uploaded the novel now), we will treat them via System Instruction RAG
           // to ensure we don't blow the context immediately.
           // BUT, the 'contents' part of generateContent is strict.
           // Let's attach them here if small, or rely on Persona files if they are configured there.
           // Assuming 'attachments' in chat are usually small/temporary context.
           newParts.push({ text: `[File Attachment: ${att.name}]\n${att.data.substring(0, 10000)}\n` });
         }
      });
  }
  newParts.push({ text: newMessage });
  contents.push({ role: 'user', parts: newParts });

  // --- Dynamic System Instruction (RAG Implementation) ---
  let baseInstruction = "You are a helpful assistant for a web novel writer (Google Gemini). You can search the web for real-time information if needed. Provide concise, creative, and accurate answers regarding plotting, character names, settings, synonyms, and general knowledge. You communicate in Korean. When files are attached, analyze them to assist the user. IMPORTANT: Use **bold text** (**text**) to emphasize key terms, headers, names, or important conclusions to improve readability.";
  
  if (persona) {
      let personaInstruction = "";
      if (persona.instruction && persona.instruction.trim()) {
          personaInstruction += `\n\n[ROLE & INSTRUCTION]\n${persona.instruction}`;
      }
      if (persona.knowledge && persona.knowledge.trim()) {
          personaInstruction += `\n\n[KNOWLEDGE BASE]\n${persona.knowledge}`;
      }
      
      // RAG Logic for Attached Knowledge Files
      if (persona.files && persona.files.length > 0) {
         personaInstruction += `\n\n[ATTACHED REFERENCE MATERIALS]`;
         
         persona.files.forEach(file => {
           const FILE_RAG_THRESHOLD = 20000; // 20k chars limit for direct inclusion
           
           if (file.content.length <= FILE_RAG_THRESHOLD) {
               // Small file: Include directly
               personaInstruction += `\n--- FILE: ${file.name} ---\n${file.content}\n--- END OF FILE ---\n`;
           } else {
               // Large file: Perform Keyword Search (Client-side RAG)
               // This allows users to "upload the whole novel" (2-3MB) and query it.
               const relevantContext = findRelevantChunks(newMessage, file.content, 10); // Get top 10 chunks (~5k-10k chars)
               personaInstruction += `\n--- LARGE FILE: ${file.name} (Dynamically Retrieved Excerpts) ---\n`;
               personaInstruction += `The user is asking about: "${newMessage}".\n`;
               personaInstruction += `Here are the most relevant sections extracted from the full document:\n\n${relevantContext}\n`;
               personaInstruction += `\n(Note: This is a partial view of the file based on the user's query.)\n--- END OF EXCERPTS ---\n`;
           }
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
        safetySettings: SAFETY_SETTINGS, 
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
    handleGeminiError(error, modelName);
    throw error;
  }
};
