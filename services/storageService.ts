
import { NovelDocument, AppSettings, FontType, SnippetType, AVAILABLE_MODELS, Snippet } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'novelcraft_docs';
const SETTINGS_KEY = 'novelcraft_settings';

// Default Snippets Preset
const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: "19639840-2fc2-4e09-8c3c-6038d02f9e94",
    trigger: "Alt+1",
    text: "“{|}”",
    type: SnippetType.TEXT
  },
  {
    id: "dd4c5fea-eaff-4fae-afb5-b344377c366c",
    trigger: "Alt+2",
    text: "‘{|}’",
    type: SnippetType.TEXT
  },
  {
    id: "12abc19a-3af6-4385-b942-ec48d7b6db71",
    trigger: "Alt+3",
    text: "[{|}]",
    type: SnippetType.TEXT
  },
  {
    id: "f3ac8020-8a1e-4d4c-9e5c-b4f1ba26962c",
    trigger: "Alt+4",
    text: "『{|}』",
    type: SnippetType.TEXT
  },
  {
    id: "c7e411dd-d84c-46d8-afff-a3e2f82fc154",
    trigger: "Alt+5",
    text: "「{|}」",
    type: SnippetType.TEXT
  },
  {
    id: "dc6ead1d-ceb0-41ed-9918-f4f5d437415e",
    trigger: "Alt+6",
    text: "【{|}】",
    type: SnippetType.TEXT
  },
  {
    id: "f46ca8fd-f664-4d0b-82f9-4f414b3d76f4",
    trigger: "Alt+7",
    text: "〔{|}〕",
    type: SnippetType.TEXT
  },
  {
    id: "56b4f4d6-cdef-40c8-8d54-3f1ad4d43c2c",
    trigger: "Alt+8",
    text: "―",
    type: SnippetType.TEXT
  },
  {
    id: "6ab25ae0-581d-4dca-894e-5f8f2a644e0b",
    trigger: "Alt+Shift+1",
    text: "#facc15",
    type: SnippetType.COLOR
  },
  {
    id: "e128432b-2597-49e8-8a92-7a3201e53d0d",
    trigger: "Alt+Shift+2",
    text: "#b7012e",
    type: SnippetType.COLOR
  },
  {
    id: "bee6d834-111c-49f5-8ba2-f47bdc07d697",
    trigger: "Alt+Shift+3",
    text: "#ffffff",
    type: SnippetType.COLOR
  }
];

// Expose Default Settings for Reset functionality
export const getDefaultSettings = (): AppSettings => ({
  fontSize: 18,
  assistantFontSize: 14,
  fontType: FontType.SERIF,
  alignment: 'justify',
  enableIndentation: true,
  snippets: DEFAULT_SNIPPETS,
  aiModel: AVAILABLE_MODELS[0].id,
  
  // Default Assistant Models
  leftAssistantModel: AVAILABLE_MODELS[1].id,
  rightAssistantModel: AVAILABLE_MODELS[1].id,

  // Default Personas
  leftAssistantPersona: {
    name: '아이디어 뱅크',
    instruction: '당신은 창의적인 웹소설 플롯 및 아이디어 컨설턴트입니다. 사용자의 질문에 대해 독창적이고 흥미로운 전개를 제안하세요.',
    knowledge: '',
    files: []
  },
  rightAssistantPersona: {
    name: '설정 및 고증 담당',
    instruction: '당신은 웹소설의 세계관 설정과 개연성, 고증을 담당하는 꼼꼼한 편집자입니다. 모순을 지적하고 사실 관계를 확인해 주세요.',
    knowledge: '',
    files: []
  },

  apiKey: '',
  soundVolume: 0.5,
});

// Helper to get raw list
export const getDocuments = (): NovelDocument[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  const docs = data ? JSON.parse(data) : [];
  return docs.map((d: any) => ({ ...d, isDeleted: !!d.isDeleted }));
};

// Save a single document (Update Only)
export const saveDocument = (doc: NovelDocument): NovelDocument[] => {
  const docs = getDocuments();
  const index = docs.findIndex((d) => d.id === doc.id);

  if (index >= 0) {
    if (docs[index].isDeleted) {
      console.warn(`Blocked save attempt on deleted document: ${doc.id}`);
      return docs; 
    }

    docs[index] = { ...doc, lastModified: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  }
  
  return docs;
};

// Soft Delete: Mark as deleted
export const softDeleteDocument = (id: string): NovelDocument[] => {
  const docs = getDocuments();
  const index = docs.findIndex((d) => d.id === id);
  if (index >= 0) {
    docs[index].isDeleted = true;
    docs[index].lastModified = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  }
  return docs;
};

// Restore: Mark as active
export const restoreDocument = (id: string): NovelDocument[] => {
  const docs = getDocuments();
  const index = docs.findIndex((d) => d.id === id);
  if (index >= 0) {
    docs[index].isDeleted = false;
    docs[index].lastModified = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  }
  return docs;
};

// Permanent Delete: Remove from array
export const permanentlyDeleteDocument = (id: string): NovelDocument[] => {
  const docs = getDocuments();
  const newDocs = docs.filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
  return newDocs;
};

// Empty Trash: Remove all soft-deleted
export const emptyTrash = (): NovelDocument[] => {
  const docs = getDocuments();
  const newDocs = docs.filter((d) => !d.isDeleted);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
  return newDocs;
};

// Create new
export const createDocument = (): NovelDocument[] => {
  const newDoc: NovelDocument = {
    id: uuidv4(),
    title: '무제 (Untitled)',
    content: '',
    lastModified: Date.now(),
    isDeleted: false,
  };
  const docs = getDocuments();
  docs.push(newDoc);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  return docs;
};

// Settings Helpers
export const saveLocalSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getLocalSettings = (): AppSettings | null => {
  const data = localStorage.getItem(SETTINGS_KEY);
  
  if (!data) {
    return getDefaultSettings();
  }
  
  const parsed = JSON.parse(data);
  const defaults = getDefaultSettings();
  
  if (!parsed.snippets) {
    parsed.snippets = [];
  } else {
    parsed.snippets = parsed.snippets.map((s: any) => ({
      ...s,
      type: s.type || SnippetType.TEXT
    }));
  }

  if (!parsed.aiModel) parsed.aiModel = defaults.aiModel;

  // Migration: If new fields missing, fill with defaults
  if (!parsed.leftAssistantModel) parsed.leftAssistantModel = defaults.leftAssistantModel;
  if (!parsed.rightAssistantModel) parsed.rightAssistantModel = parsed.assistantModel || defaults.rightAssistantModel; // Use old assistantModel if available
  
  if (!parsed.leftAssistantPersona) parsed.leftAssistantPersona = defaults.leftAssistantPersona;
  if (!parsed.rightAssistantPersona) parsed.rightAssistantPersona = defaults.rightAssistantPersona;

  if (parsed.leftAssistantPersona && !parsed.leftAssistantPersona.files) parsed.leftAssistantPersona.files = [];
  if (parsed.rightAssistantPersona && !parsed.rightAssistantPersona.files) parsed.rightAssistantPersona.files = [];

  if (!parsed.assistantFontSize) parsed.assistantFontSize = defaults.assistantFontSize;
  if (typeof parsed.soundVolume === 'undefined') parsed.soundVolume = defaults.soundVolume;
  if (!parsed.alignment) parsed.alignment = defaults.alignment;
  if (typeof parsed.enableIndentation === 'undefined') parsed.enableIndentation = defaults.enableIndentation;
  if (typeof parsed.apiKey === 'undefined') parsed.apiKey = '';
  
  delete parsed.showFormattingMarks;
  
  return parsed;
};
