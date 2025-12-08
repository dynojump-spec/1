

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef, useMemo, useLayoutEffect } from 'react';
import { Wand2, Check, MessageSquare, RefreshCw, Trash2, Zap, Heart, Scissors, Mountain, Languages } from 'lucide-react';
import { AppSettings, FontType, AIRevisionMode, SnippetType } from '../types';
import { generateInteractiveDiffHtml } from '../utils/diffEngine';
import { generateRevision } from '../services/geminiService';

export interface EditorHandle {
  find: (term: string, direction: 'next' | 'prev') => boolean;
  replace: (term: string) => void;
  focus: () => void;
  cancelOperation: () => void; // New method to cancel AI
}

interface Props {
  content: string;
  onChange: (html: string) => void;
  settings: AppSettings;
  readOnly?: boolean;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onProcessingChange?: (isProcessing: boolean) => void; // Notify parent of AI status
}

interface HistoryState {
  html: string;
  caret: number;
}

const playSuccessSound = (volume: number = 0.5) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Max comfortable volume (0.1) * User setting (0.0 to 1.0)
    const maxGain = 0.1 * volume;
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(maxGain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.5);
  } catch (error) { /* ignore */ }
};

// Helper to extract text preserving line breaks using robust HTML parsing
// Replaces unreliable innerText which fails on hidden/detached nodes
const fragmentToText = (fragment: DocumentFragment): string => {
  const tempDiv = document.createElement('div');
  tempDiv.appendChild(fragment.cloneNode(true));
  
  let html = tempDiv.innerHTML;
  
  // Explicitly replace block element closings with newlines to preserve structure
  html = html.replace(/<\/div>/gi, '\n');
  html = html.replace(/<\/p>/gi, '\n');
  html = html.replace(/<\/li>/gi, '\n');
  html = html.replace(/<\/h[1-6]>/gi, '\n');
  html = html.replace(/<br\s*\/?>/gi, '\n');
  
  // Use a textarea to decode HTML entities (e.g., &lt; -> <) and strip tags
  const decoder = document.createElement('textarea');
  decoder.innerHTML = html.replace(/<[^>]+>/g, '');
  let text = decoder.value;
  
  // Clean up
  text = text.replace(/\u200B/g, ''); // Remove zero-width spaces
  
  return text.trim();
};

const placeCaretAtEnd = (el: HTMLElement) => {
  el.focus();
  if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
};

// Helper to get cursor offset relative to text content
const getCaretGlobalOffset = (element: HTMLElement): number => {
  let caretOffset = 0;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (element.contains(range.startContainer)) {
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretOffset = preCaretRange.toString().length;
    }
  }
  return caretOffset;
};

// Helper to set cursor position based on text offset
const setCaretGlobalPosition = (element: HTMLElement, offset: number) => {
  let charCount = 0;
  let found = false;
  
  const createRange = (node: Node, targetOffset: number, range: Range): void => {
      if (found) return;

      if (node.nodeType === Node.TEXT_NODE) {
          const textLength = node.textContent?.length || 0;
          if (charCount + textLength >= targetOffset) {
              range.setStart(node, targetOffset - charCount);
              range.collapse(true);
              found = true;
              return;
          }
          charCount += textLength;
      } else {
          for (let i = 0; i < node.childNodes.length; i++) {
              createRange(node.childNodes[i], targetOffset, range);
              if (found) return;
          }
      }
  };

  const sel = window.getSelection();
  if (sel) {
      if (offset === 0) {
         const range = document.createRange();
         range.setStart(element, 0);
         range.collapse(true);
         sel.removeAllRanges();
         sel.addRange(range);
         return;
      }
      
      const range = document.createRange();
      createRange(element, offset, range);
      
      if (found) {
          sel.removeAllRanges();
          sel.addRange(range);
      } else {
          // Fallback
          placeCaretAtEnd(element);
      }
  }
};

// Helper to calculate text contrast color
const getContrastColor = (hexColor: string) => {
  // If no color or invalid, default to light text (for dark bg)
  if (!hexColor || !hexColor.startsWith('#')) return '#f4f4f5'; // zinc-100
  
  // Parse hex
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  
  // Calculate brightness (YIQ formula)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  // If bright (>128), return dark text. Else return light text.
  return yiq >= 128 ? '#18181b' : '#f4f4f5'; // zinc-900 vs zinc-100
};

const Editor = forwardRef<EditorHandle, Props>(({ content, onChange, settings, readOnly = false, onRestore, onPermanentDelete, onProcessingChange }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [showAITooltip, setShowAITooltip] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const [savedSelectionRange, setSavedSelectionRange] = useState<Range | null>(null);
  
  // Ref to track last selection state to prevent infinite render loops
  const lastSelectionStateRef = useRef<{text: string, top: number, left: number} | null>(null);

  // History State: HTML + Cursor Position
  const historyRef = useRef<HistoryState[]>([{ html: content, caret: 0 }]);
  const historyIndexRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const lastHtmlRef = useRef<string | null>(null);

  // Sync content from Parent -> Editor
  useEffect(() => {
    if (content !== lastHtmlRef.current) {
      // External change (Undo, AI, Doc Switch, Initial Load)
      if (editorRef.current) {
        if (editorRef.current.innerHTML !== content) {
          editorRef.current.innerHTML = content;
        }
        // Sync our ref so we don't update again
        lastHtmlRef.current = content;
      }
    }
  }, [content]);

  // Update History Ref when doc changes (for Initial Load sync)
  useEffect(() => {
    if (historyRef.current.length === 1 && historyRef.current[0].html !== content && historyIndexRef.current === 0) {
       historyRef.current[0] = { html: content, caret: 0 };
       lastHtmlRef.current = content;
    }
  }, [content]);

  // Enable default paragraph separator as div
  useEffect(() => {
    if (editorRef.current) {
        // This ensures that pressing Enter creates a new <div> paragraph instead of <br> or <p>
        // This is crucial for text-indent to work on every paragraph.
        document.execCommand('defaultParagraphSeparator', false, 'div');
    }
  }, []);

  // Disable editing if readOnly
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.contentEditable = readOnly ? "false" : "true";
    }
  }, [readOnly]);

  // Use LayoutEffect to clamp tooltip position to screen bounds
  useLayoutEffect(() => {
    if (showAITooltip && tooltipRef.current && selectionRect) {
      const el = tooltipRef.current;
      // Ensure we read the dimensions without transform interference
      el.style.transform = 'none';
      
      const rect = el.getBoundingClientRect();
      const tooltipWidth = rect.width;
      const viewportWidth = window.innerWidth;
      const padding = 16; // Safe padding from edges
      
      // Goal: Center of tooltip should align with selectionRect.left
      let newLeft = selectionRect.left - (tooltipWidth / 2);
      
      // Clamp Left
      if (newLeft < padding) {
         newLeft = padding;
      } 
      // Clamp Right
      else if (newLeft + tooltipWidth > viewportWidth - padding) {
         newLeft = viewportWidth - tooltipWidth - padding;
      }
      
      el.style.left = `${newLeft}px`;
    }
  }, [selectionRect, showAITooltip]);

  // --- AUTO SCROLL LOGIC ---
  const scrollCaretIntoView = useCallback(() => {
    if (!containerRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Try to get bounding rect. If empty (collapsed at start of line sometimes), try getClientRects.
    let rect = range.getBoundingClientRect();
    if (rect.height === 0 && range.getClientRects().length > 0) {
      rect = range.getClientRects()[0];
    }

    // Find the scrollable parent (The main content div in App.tsx)
    const scrollContainer = containerRef.current.parentElement;
    if (!scrollContainer) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const padding = 100; // 100px context padding for Find

    if (rect.height === 0) return; // Invisible cursor

    // If cursor is below the visible area
    if (rect.bottom > containerRect.bottom - padding) {
      scrollContainer.scrollTop += (rect.bottom - (containerRect.bottom - padding));
    }
    // If cursor is above the visible area
    else if (rect.top < containerRect.top + padding) {
      scrollContainer.scrollTop -= ((containerRect.top + padding) - rect.top);
    }
  }, []);

  const saveSnapshot = useCallback((html: string, caret: number) => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    const lastSnapshot = currentHistory[currentIndex];
    
    // Only skip if BOTH html and caret are identical
    if (lastSnapshot && lastSnapshot.html === html && lastSnapshot.caret === caret) return;

    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push({ html, caret });
    
    // Limit history size to prevent memory issues
    if (newHistory.length > 100) newHistory.shift();

    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  }, []);

  const handleInput = useCallback(() => {
    if (readOnly) return;
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // Sync ref before sending to parent to prevent loopback update
      lastHtmlRef.current = html;
      onChange(html);
      
      if (debounceRef.current) clearTimeout(debounceRef.current);
      
      // Calculate current caret position for snapshot
      const caret = getCaretGlobalOffset(editorRef.current);
      
      // Save snapshot with a 500ms delay (groups typing events)
      debounceRef.current = setTimeout(() => saveSnapshot(html, caret), 500);
    }
  }, [onChange, readOnly, saveSnapshot]); 

  // Handle Paste: Create DIVs for each line to ensure Indentation works
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (readOnly) return;
    e.preventDefault();
    
    // 1. Get plain text (strips original styles/backgrounds)
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    // 2. Escape HTML characters
    const escapeHtml = (str: string) => {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    // 3. Convert newlines to <div> paragraphs
    // This allows CSS text-indent to apply to the first line of *each* paragraph
    const paragraphs = text.split(/\r\n|\r|\n/);
    const htmlContent = paragraphs.map(line => {
        // If line is empty, use <br> inside div to maintain height
        return `<div>${escapeHtml(line) || '<br>'}</div>`;
    }).join('');

    // 4. Insert as HTML
    document.execCommand('insertHTML', false, htmlContent);
    
    // Trigger input to save state
    handleInput();
  }, [readOnly, handleInput]);

  // Expose methods to parent (App.tsx)
  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current?.focus();
    },
    find: (term: string, direction: 'next' | 'prev') => {
      if (!term || !editorRef.current) return false;
      const backwards = direction === 'prev';
      const found = (window as any).find(term, false, backwards, true, false, false, false);
      
      if (found) {
        scrollCaretIntoView();
        return true;
      } else {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        const retry = (window as any).find(term, false, backwards, true, false, false, false);
        if (retry) scrollCaretIntoView();
        return retry;
      }
    },
    replace: (replacement: string) => {
      if (readOnly) return;
      document.execCommand('insertText', false, replacement);
      handleInput();
    },
    cancelOperation: () => {
       if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          // State cleanup happens in runAIRevision catch/finally block or we force it here
          // but better to let the async flow handle it.
       }
    }
  }));

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      historyIndexRef.current--;
      const prevState = historyRef.current[historyIndexRef.current];
      if (editorRef.current) {
        editorRef.current.innerHTML = prevState.html;
        lastHtmlRef.current = prevState.html; // Sync ref
        onChange(prevState.html);
        // Restore cursor position
        setCaretGlobalPosition(editorRef.current, prevState.caret);
        setTimeout(scrollCaretIntoView, 10);
      }
    }
  }, [onChange, scrollCaretIntoView]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      historyIndexRef.current++;
      const nextState = historyRef.current[historyIndexRef.current];
      if (editorRef.current) {
        editorRef.current.innerHTML = nextState.html;
        lastHtmlRef.current = nextState.html; // Sync ref
        onChange(nextState.html);
        // Restore cursor position
        setCaretGlobalPosition(editorRef.current, nextState.caret);
        setTimeout(scrollCaretIntoView, 10);
      }
    }
  }, [onChange, scrollCaretIntoView]);

  const runAIRevision = async (mode: AIRevisionMode, manualRange?: Range) => {
    // Use manualRange (from shortcut) or savedSelectionRange (from tooltip)
    const targetRange = manualRange || savedSelectionRange;
    
    if (!targetRange || readOnly) return;
    
    // IMPORTANT: If we're using a manual range (shortcut), we need to get a bounding rect 
    // to show the "Processing" indicator near the cursor/selection.
    if (manualRange && !selectionRect) {
        const rect = manualRange.getBoundingClientRect();
        // Use viewport coordinates for fixed positioning
        setSelectionRect({
            top: rect.bottom + 8, 
            left: rect.left + (rect.width / 2),
        });
    }

    const scrollContainer = containerRef.current?.parentElement;
    const savedScrollTop = scrollContainer?.scrollTop || 0;

    if (editorRef.current) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      saveSnapshot(editorRef.current.innerHTML, getCaretGlobalOffset(editorRef.current));
    }
    
    // Start Processing
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setIsAIProcessing(true);
    setShowAITooltip(false);
    if (onProcessingChange) onProcessingChange(true);

    try {
      const fragment = targetRange.cloneContents();
      const textToRevise = fragmentToText(fragment); 
      
      if (!textToRevise.trim()) throw new Error("No text selected");
      
      // Pass the user's API Key from settings and the AbortSignal
      const revisedText = await generateRevision(
        textToRevise, 
        mode, 
        settings.aiModel, 
        settings.apiKey,
        controller.signal
      );

      const diffHtml = generateInteractiveDiffHtml(textToRevise, revisedText);
      
      targetRange.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = diffHtml;
      const frag = document.createDocumentFragment();
      
      let lastInsertedNode: Node | null = null;

      while (tempDiv.firstChild) {
        lastInsertedNode = tempDiv.firstChild;
        frag.appendChild(tempDiv.firstChild);
      }
      targetRange.insertNode(frag);
      
      const selection = window.getSelection();
      if (selection) {
          selection.removeAllRanges();
          if (lastInsertedNode) {
              const newRange = document.createRange();
              newRange.setStartAfter(lastInsertedNode);
              newRange.collapse(true);
              selection.addRange(newRange);
          }
      }
      setSavedSelectionRange(null);
      
      editorRef.current?.focus();

      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop;
        setTimeout(() => {
          scrollContainer.scrollTop = savedScrollTop;
        }, 0);
      }

      if (editorRef.current) {
         const newHtml = editorRef.current.innerHTML;
         lastHtmlRef.current = newHtml; 
         onChange(newHtml);
         saveSnapshot(newHtml, getCaretGlobalOffset(editorRef.current));
      }
      playSuccessSound(settings.soundVolume);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      
      // Ignore Abort errors (user cancelled)
      if (msg.includes("Operation cancelled") || msg.includes("aborted") || (error instanceof Error && error.name === 'AbortError')) {
         console.log("AI Operation Cancelled by user");
      } else {
         console.error(error);
         if (msg.includes("API Key")) {
            alert("API 키가 설정되지 않았습니다. 설정 메뉴에서 Google API Key를 입력해주세요.");
         } else {
            alert("AI 수정 중 오류가 발생했습니다. (잠시 후 다시 시도하거나 키를 확인해주세요)\n" + msg);
         }
      }
    } finally {
      setIsAIProcessing(false);
      abortControllerRef.current = null;
      if (onProcessingChange) onProcessingChange(false);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (readOnly) return;

    // Undo/Redo Logic
    if (e.ctrlKey || e.metaKey) {
      if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          redo(); 
        } else {
          undo(); 
        }
        return;
      }
      if (e.code === 'KeyY' || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        e.stopPropagation();
        redo();
        return;
      }
    }

    // Auto-replacement: 3 dots (...) -> Ellipsis (…)
    if (e.key === '.') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
          if (offset >= 2) {
            const preceding = node.textContent.slice(offset - 2, offset);
            if (preceding === '..') {
              e.preventDefault(); 
              
              if (editorRef.current) {
                saveSnapshot(editorRef.current.innerHTML, getCaretGlobalOffset(editorRef.current));
              }

              const newRange = document.createRange();
              newRange.setStart(node, offset - 2);
              newRange.setEnd(node, offset);
              selection.removeAllRanges();
              selection.addRange(newRange);
              
              document.execCommand('insertText', false, '…');
              handleInput();
              return;
            }
          }
        }
      }
    }

    // Auto-replacement for [...]
    if (e.key === ']') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
          if (offset >= 4) {
             const preceding = node.textContent.slice(offset - 4, offset);
             if (preceding === '[...') {
               e.preventDefault();
               
               if (editorRef.current) {
                   saveSnapshot(editorRef.current.innerHTML, getCaretGlobalOffset(editorRef.current));
               }

               const newRange = document.createRange();
               newRange.setStart(node, offset - 4);
               newRange.setEnd(node, offset);
               selection.removeAllRanges();
               selection.addRange(newRange);
               document.execCommand('insertText', false, '[…]');
               handleInput();
               return; 
             }
          }
        }
      }
    }

    // Detect potential content changes to establish undo anchor points
    const isPrintingKey = !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1;
    const isDeletion = e.key === 'Backspace' || e.key === 'Delete';
    const isEnter = e.key === 'Enter';

    if (isPrintingKey || isDeletion || isEnter) {
        if (editorRef.current) {
            const currentHistory = historyRef.current;
            const topHistory = currentHistory[historyIndexRef.current];
            const currentHtml = editorRef.current.innerHTML;
            const currentCaret = getCaretGlobalOffset(editorRef.current);

            if (topHistory && currentHtml === topHistory.html && currentCaret !== topHistory.caret) {
               saveSnapshot(currentHtml, currentCaret);
            }
        }
    }

    if (!settings.snippets || settings.snippets.length === 0) return;
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    if (e.repeat || e.nativeEvent.isComposing) return;
    
    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Cmd');
    
    let key = e.key.toUpperCase();
    if (e.code.startsWith('Digit')) key = e.code.replace('Digit', '');
    if (['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) return;

    const trigger = [...modifiers, key].join('+');
    const matchedSnippet = settings.snippets.find(s => s.trigger === trigger);
    
    if (matchedSnippet) {
      e.preventDefault();
      e.stopPropagation();

      // Handle AI Command Snippet
      if (matchedSnippet.type === SnippetType.AI_COMMAND) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          // Pass the range directly to runAIRevision as it might not be saved in state if tooltip wasn't active
          runAIRevision(matchedSnippet.text as AIRevisionMode, range);
        } else {
          // Optional: Feedback if no text selected
          console.log("No text selected for AI revision shortcut");
        }
        return;
      }

      if (editorRef.current) saveSnapshot(editorRef.current.innerHTML, getCaretGlobalOffset(editorRef.current));

      if (matchedSnippet.type === SnippetType.COLOR) {
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, matchedSnippet.text);
        const selection = window.getSelection();
        if (selection) selection.collapseToEnd();
        document.execCommand('foreColor', false, '#f4f4f5');
        document.execCommand('styleWithCSS', false, 'false');
        handleInput();
        return;
      }
      
      const markerId = `cursor-marker-${Date.now()}`;
      const markerHtml = `<span id="${markerId}"></span>`;
      
      let escapedText = matchedSnippet.text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      
      const hasCursorMarker = escapedText.includes("{|}");
      
      if (hasCursorMarker) {
        escapedText = escapedText.replace("{|}", markerHtml);
      }
      
      const htmlToInsert = escapedText.replace(/\n/g, '<br>');
      document.execCommand('insertHTML', false, htmlToInsert);
      
      if (hasCursorMarker) {
        const marker = document.getElementById(markerId);
        if (marker) {
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.setStartBefore(marker);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          marker.remove();
        }
      }
      handleInput();
    }
  }, [readOnly, settings.snippets, undo, redo, handleInput, saveSnapshot, settings.aiModel, settings.apiKey]);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !editorRef.current || !containerRef.current) {
      setShowAITooltip(false);
      lastSelectionStateRef.current = null;
      if (selection && selection.isCollapsed && editorRef.current.contains(selection.anchorNode)) {
         setSavedSelectionRange(null);
      }
      return;
    }
    if (!editorRef.current.contains(selection.anchorNode)) {
        setShowAITooltip(false);
        lastSelectionStateRef.current = null;
        return;
    }
    const range = selection.getRangeAt(0);
    const text = selection.toString(); 
    if (text.trim().length > 0) {
      const rect = range.getBoundingClientRect();
      const newTop = rect.bottom + 8;
      const newLeft = rect.left + (rect.width / 2);

      // GUARD: Prevent infinite render loops by ignoring redundant selection events
      // Check if text and position are identical to the last processed event
      if (lastSelectionStateRef.current && 
          lastSelectionStateRef.current.text === text &&
          Math.abs(lastSelectionStateRef.current.top - newTop) < 1 &&
          Math.abs(lastSelectionStateRef.current.left - newLeft) < 1) {
          return; // Skip update
      }

      // Update cache
      lastSelectionStateRef.current = { text, top: newTop, left: newLeft };

      // Use viewport coordinates directly for fixed positioning to avoid container offset issues
      setSelectionRect({ top: newTop, left: newLeft });
      setSavedSelectionRange(range.cloneRange());
      setShowAITooltip(true);
    } else {
      setShowAITooltip(false);
      setSavedSelectionRange(null);
      lastSelectionStateRef.current = null;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('resize', handleSelectionChange);
    const scrollHandler = () => { if (showAITooltip) handleSelectionChange(); };
    document.addEventListener('scroll', scrollHandler, true);
    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        window.removeEventListener('resize', handleSelectionChange);
        document.removeEventListener('scroll', scrollHandler, true);
    };
  }, [handleSelectionChange, showAITooltip]);

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    
    // Improved target detection using .closest() to handle clicks on inner elements (like markers)
    const target = (e.target as HTMLElement).closest('.diff-interactive') as HTMLElement;
    
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      
      if (editorRef.current) saveSnapshot(editorRef.current.innerHTML, getCaretGlobalOffset(editorRef.current));

      const currentState = target.getAttribute('data-state');
      // Fix: Use getAttribute to reliably get value even if casing/DOM property issues exist
      const original = target.getAttribute('data-original') || '';
      const modified = target.getAttribute('data-modified') || '';
      
      // Helper to escape HTML entities for display
      const escapeHtmlForDisplay = (str: string) => {
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      if (currentState === 'modified') {
        // Switch to Original (Red)
        target.setAttribute('data-state', 'original');
        if (!original) {
           // Pure Insertion: Original is empty. Show placeholder.
           // Removed 'align-middle' to prevent line-height jumps
           target.innerHTML = '<span class="text-zinc-500 text-[10px] select-none align-baseline mx-0.5 pointer-events-none">(추가됨)</span>';
        } else {
           // Substitution: Show original text
           // Trim trailing newline to prevent double line-break at end of block
           const textToShow = original.replace(/\n+$/, '');
           target.innerHTML = escapeHtmlForDisplay(textToShow).replace(/\n/g, '<br>');
        }
      } else {
        // Switch back to Modified (Blue)
        target.setAttribute('data-state', 'modified');
        if (!modified) {
           // Pure Deletion: Modified is empty (gone). Show marker.
           // Removed 'align-middle' to prevent line-height jumps
           target.innerHTML = '<span class="text-zinc-500 text-[10px] select-none align-baseline mx-0.5 pointer-events-none">[-]</span>';
        } else {
           // Substitution/Insertion: Show new text
           // Trim trailing newline to prevent double line-break at end of block
           const textToShow = modified.replace(/\n+$/, '');
           target.innerHTML = escapeHtmlForDisplay(textToShow).replace(/\n/g, '<br>');
        }
      }
      handleInput();
    }
  }, [readOnly, handleInput, saveSnapshot]);

  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      editorRef.current?.focus();
    }
  };

  const commonStyles = `w-full max-w-full h-full min-h-[calc(100vh-5rem)] px-4 py-6 md:px-12 md:py-12 outline-none whitespace-pre-wrap break-words`;

  // Memoize styles to prevent re-renders of the div
  const editorStyle = useMemo(() => ({
    fontFamily: settings.fontType === FontType.SERIF ? '"Noto Serif KR", serif' : '"Noto Sans KR", sans-serif',
    fontSize: `${settings.fontSize}px`,
    fontWeight: 'bold', 
    lineHeight: '1.8',
    tabSize: 4, 
    textAlign: settings.alignment, 
    wordBreak: 'break-all' as any, 
    overflowWrap: 'break-word' as any,
    textIndent: settings.enableIndentation ? '1em' : '0', // Added text-indent
    color: getContrastColor(settings.editorBackgroundColor || '#09090b'), // Dynamic Text Color
  }), [settings]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full max-w-full min-h-full cursor-text transition-colors duration-200"
      onClick={handleContainerClick}
      style={{ backgroundColor: settings.editorBackgroundColor || '#09090b' }} // Apply background to container
    >
      
      {/* Trash Warning Banner */}
      {readOnly && (
        <div className="sticky top-0 z-40 mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-200 flex items-center justify-between backdrop-blur-sm max-w-4xl mx-auto">
          <span className="text-sm font-medium flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
             휴지통에 있는 문서입니다.
          </span>
          <div className="flex items-center gap-2">
            {onRestore && (
              <button 
                onClick={onRestore}
                className="px-3 py-1 text-xs font-bold bg-zinc-700 hover:bg-green-600 hover:text-zinc-200 rounded shadow-sm flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={12} /> 복원
              </button>
            )}
            {onPermanentDelete && (
              <button 
                onClick={onPermanentDelete}
                className="px-3 py-1 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded shadow-sm flex items-center gap-1 transition-colors"
              >
                <Trash2 size={12} /> 완전 삭제
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        onClick={handleEditorClick}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`${commonStyles} relative z-10 bg-transparent empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-500 ${readOnly ? 'cursor-text opacity-90' : ''}`}
        style={editorStyle}
        spellCheck={false}
        data-placeholder={readOnly ? "" : "여기에 소설을 작성하세요..."}
        suppressContentEditableWarning={true}
      />

      {/* AI Tooltip - Compact Design */}
      {!readOnly && showAITooltip && selectionRect && !isAIProcessing && (
        <div
          ref={tooltipRef}
          className="fixed z-50 flex items-center gap-1 p-1 rounded-lg shadow-xl bg-zinc-900 border border-zinc-700 animate-in fade-in zoom-in duration-200"
          style={{ top: selectionRect.top, left: selectionRect.left }}
          onMouseDown={handleToolbarMouseDown} 
        >
          {/* Primary: Grammar & Polish & Compact */}
          <button 
            onClick={() => runAIRevision(AIRevisionMode.GRAMMAR)} 
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:text-blue-400 hover:bg-zinc-800 rounded-md transition-colors whitespace-nowrap"
            title="맞춤법/교정"
          >
            <Check size={14} />
            <span>교정</span>
          </button>
          
          <button 
            onClick={() => runAIRevision(AIRevisionMode.POLISH)} 
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:text-purple-400 hover:bg-zinc-800 rounded-md transition-colors whitespace-nowrap"
            title="윤문 (문장 다듬기)"
          >
            <Wand2 size={14} />
            <span>윤문</span>
          </button>

          <button 
            onClick={() => runAIRevision(AIRevisionMode.COMPACT)} 
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:text-teal-400 hover:bg-zinc-800 rounded-md transition-colors whitespace-nowrap"
            title="벽돌체 다듬기 (간결화)"
          >
            <Scissors size={14} />
            <span>압축</span>
          </button>

          <div className="w-px h-4 bg-zinc-700 mx-1"></div>

          {/* Secondary: Icons Only */}
          <button onClick={() => runAIRevision(AIRevisionMode.SCENERY)} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-md transition-colors" title="배경 묘사 생성">
            <Mountain size={16} />
          </button>
          <button onClick={() => runAIRevision(AIRevisionMode.DIALOGUE)} className="p-1.5 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-800 rounded-md transition-colors" title="대사 톤앤매너">
            <MessageSquare size={16} />
          </button>
          <button onClick={() => runAIRevision(AIRevisionMode.ACTION)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-md transition-colors" title="전투/액션 묘사">
            <Zap size={16} />
          </button>
          <button onClick={() => runAIRevision(AIRevisionMode.EMOTIONAL)} className="p-1.5 text-zinc-400 hover:text-pink-400 hover:bg-zinc-800 rounded-md transition-colors" title="감정선 강화">
            <Heart size={16} />
          </button>
          <button onClick={() => runAIRevision(AIRevisionMode.HANJA)} className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 rounded-md transition-colors" title="한자 변환">
            <Languages size={16} />
          </button>
        </div>
      )}

      {/* Note: Floating "AI Processing" UI removed. State is now handled by Parent App.tsx in Header */}
    </div>
  );
});

export default Editor;