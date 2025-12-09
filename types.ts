


export interface NovelDocument {
  id: string;
  title: string;
  content: string; // HTML content
  lastModified: number;
  isDeleted?: boolean; // New: Soft delete status
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
  trigger: string; // e.g., "Ctrl+1", "Alt+Shift+A"
  text: string; // Text content OR Color Hex Code OR AI Revision Mode ID
  type: SnippetType;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  content: string; // Text content of the file
  size: number;
}

export interface AssistantPersona {
  name: string;
  instruction: string; // System Instructions (You are a...)
  knowledge: string; // Background knowledge (Text)
  files?: KnowledgeFile[]; // Attached Knowledge Files
}

export interface AppSettings {
  fontSize: number;
  assistantFontSize: number;
  fontType: FontType;
  alignment: 'justify' | 'left';
  enableIndentation?: boolean;
  
  // Visual Settings
  editorBackgroundColor: string; // New: Editor Background Color

  snippets: Snippet[];
  aiModel: string; // Editor Model
  
  // Dual Assistant Settings
  leftAssistantModel: string;
  rightAssistantModel: string;
  leftAssistantPersona: AssistantPersona;
  rightAssistantPersona: AssistantPersona;

  apiKey?: string;
  soundVolume: number;
  
  // Export Settings
  enableSaveAsDialog?: boolean; // New: Toggle for File System Access API
  
  // Deprecated but kept for type safety during migration if needed
  assistantModel?: string; 
}

// Define available models for the UI
// Updated: 3.0 Preview removed due to access stability issues.
// 2.0 Pro Experimental is currently the most capable stable model.
export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (권장/빠름)' },
  { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro (최고성능/추론)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (안정적/균형)' },
];

export enum AIRevisionMode {
  GRAMMAR = 'grammar',
  ACTION = 'action',
  DIALOGUE = 'dialogue',
  EMOTIONAL = 'emotional',
  POLISH = 'polish',
  HANJA = 'hanja',
  COMPACT = 'compact', // New: Brick wall fixer
  SCENERY = 'scenery', // New: Background description
}

export interface DiffToken {
  type: 'equal' | 'insert' | 'delete';
  value: string;
}

export interface SelectionRangeData {
  startOffset: number;
  endOffset: number;
  containerHtml: string; // The full HTML of the paragraph(s) or container
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
  data: string; // Base64 string for images, or raw text for text files
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
  sources?: SearchSource[]; // Added for Search Grounding
  attachments?: Attachment[]; // Added for File Attachments
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastModified: number;
}