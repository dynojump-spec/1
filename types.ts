

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

export interface AppSettings {
  fontSize: number;
  assistantFontSize: number; // NEW: Assistant font size
  fontType: FontType;
  alignment: 'justify' | 'left'; // Added: Text Alignment preference
  snippets: Snippet[];
  aiModel: string; // Used for Editor Revisions
  assistantModel: string; // NEW: Used for Assistant Chat
  apiKey?: string; // Added: User provided API Key
}

// Define available models for the UI
export const AVAILABLE_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (최고 성능/창의성)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (빠른 속도/효율성)' },
];

export enum AIRevisionMode {
  GRAMMAR = 'grammar',
  READABILITY = 'readability',
  ACTION = 'action',
  DIALOGUE = 'dialogue',
  EMOTIONAL = 'emotional',
  POLISH = 'polish',
  HANJA = 'hanja',
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}