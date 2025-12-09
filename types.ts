

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
// Updated to reflect the actual latest Google Gemini models plus User requested 2.5 versions
export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (사용자 지정)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (사용자 지정)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (고지능/소설용 추천)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (최신/차세대)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (빠른 속도)' },
  { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B (초경량/최속)' },
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