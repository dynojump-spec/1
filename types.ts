


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
  soundVolume: number; // NEW: Notification sound volume (0.0 to 1.0)
}

// Define available models for the UI
export const AVAILABLE_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (최고 성능/Preview)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (고성능/밸런스)' },
  { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Exp (고지능/추론)' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp (고성능/안정적)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (빠른 속도)' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini 2.5 Flash Lite (초고속/경량)' },
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