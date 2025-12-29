
export interface NovelDocument {
  id: string;
  title: string;
  content: string;
  lastModified: number;
  isDeleted?: boolean;
}

export enum FontType {
  SANS = 'sans',
  SERIF = 'serif',
}

export enum SnippetType {
  TEXT = 'text',
  COLOR = 'color',
  AI_COMMAND = 'ai_command',
}

export interface Snippet {
  id: string;
  trigger: string;
  text: string;
  type: SnippetType;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  content: string;
  size: number;
}

export interface AssistantPersona {
  name: string;
  instruction: string;
  knowledge: string;
  files?: KnowledgeFile[];
}

export interface AppSettings {
  fontSize: number;
  assistantFontSize: number;
  fontType: FontType;
  alignment: 'justify' | 'left';
  enableIndentation?: boolean;
  editorBackgroundColor: string;
  snippets: Snippet[];
  aiModel: string;
  leftAssistantModel: string;
  rightAssistantModel: string;
  leftAssistantPersona: AssistantPersona;
  rightAssistantPersona: AssistantPersona;
  apiKey?: string;
  soundVolume: number;
  enableSaveAsDialog?: boolean;
  
  // Google Drive Cloud Sync
  driveFileId?: string;
  lastCloudBackup?: string;
  driveClientId?: string; // Optional: User provided client ID
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (권장/최신)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (빠름)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (고성능)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (최고성능/추론)' },
];

export enum AIRevisionMode {
  GRAMMAR = 'grammar',
  ACTION = 'action',
  DIALOGUE = 'dialogue',
  EMOTIONAL = 'emotional',
  POLISH = 'polish',
  HANJA = 'hanja',
  COMPACT = 'compact',
  SCENERY = 'scenery',
}

export interface DiffToken {
  type: 'equal' | 'insert' | 'delete';
  value: string;
}

export interface SelectionRangeData {
  startOffset: number;
  endOffset: number;
  containerHtml: string;
}

export interface SearchSource {
  title: string;
  uri: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'text' | 'file';
  mimeType: string;
  data: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
  sources?: SearchSource[];
  attachments?: Attachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastModified: number;
}
