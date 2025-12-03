
/**
 * A simple diff algorithm to support "Interactive Diffs"
 * It compares two strings and returns HTML string with interactive spans.
 */

// Advanced tokenizer that treats newlines as distinct tokens
const tokenize = (text: string): string[] => {
  // 1. Split by newlines, keeping them as separators
  const parts = text.split(/(\n)/);
  const tokens: string[] = [];
  
  for (const part of parts) {
    if (part === '\n') {
      tokens.push(part);
    } else if (part.length > 0) {
      // 2. Split text by spaces or word boundaries, filtering out empty strings
      const subparts = part.split(/(\s+|\b)/).filter(s => s !== '');
      tokens.push(...subparts);
    }
  }
  return tokens;
};

// LCS based diff implementation
const computeDiff = (original: string, modified: string) => {
  const tokens1 = tokenize(original);
  const tokens2 = tokenize(modified);

  // Using a simple DP approach for Longest Common Subsequence
  const n = tokens1.length;
  const m = tokens2.length;
  // NOTE: For very large texts, this matrix can be heavy.
  // Optimization: In a real app, use Meyer's O(ND) algorithm.
  // Given the short chunks usually revised, this O(NM) is acceptable.
  const dp = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (tokens1[i - 1] === tokens2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = n, j = m;
  const diffs = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokens1[i - 1] === tokens2[j - 1]) {
      diffs.push({ type: 'equal', value: tokens1[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffs.push({ type: 'insert', value: tokens2[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffs.push({ type: 'delete', value: tokens1[i - 1] });
      i--;
    }
  }

  return diffs.reverse();
};

const escapeHtml = (str: string) => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatForDisplay = (str: string) => {
  // First escape HTML entities, then convert newlines to <br>
  // Note: This is mainly used for text INSIDE a span.
  return escapeHtml(str).replace(/\n/g, "<br>");
};

/**
 * Generates HTML with interactive spans.
 * 
 * Logic Updated for Line Breaks:
 * - We strictly respect newlines as paragraph separators (<div>...</div>).
 * - Interactive spans (green/red) do NOT cross paragraph boundaries to prevent nesting violations.
 * - An inserted newline becomes a real <div> break, not a <br> inside a span.
 */
export const generateInteractiveDiffHtml = (originalText: string, modifiedText: string): string => {
  const diffs = computeDiff(originalText, modifiedText);
  let htmlBuilder = '';
  let lineBuilder = '';
  
  // Track grouping state
  let pendingDelete = '';
  let pendingInsert = '';

  // Helper to commit accumulated changes to the current line
  const flushPending = () => {
    if (!pendingDelete && !pendingInsert) return;

    let spanHtml = '';

    if (pendingInsert && !pendingDelete) {
        // Pure addition
        spanHtml = `<span class="diff-interactive" contenteditable="false" data-state="modified" data-original="" data-modified="${escapeHtml(pendingInsert)}">${formatForDisplay(pendingInsert)}</span>`;
    } else if (!pendingInsert && pendingDelete) {
        // Pure deletion
        const marker = '<span class="text-zinc-500 text-[10px] select-none align-baseline mx-0.5 pointer-events-none">[-]</span>';
        spanHtml = `<span class="diff-interactive" contenteditable="false" data-state="modified" data-original="${escapeHtml(pendingDelete)}" data-modified="">${marker}</span>`; 
    } else {
        // Modification (Substitution)
        spanHtml = `<span class="diff-interactive" contenteditable="false" data-state="modified" data-original="${escapeHtml(pendingDelete)}" data-modified="${escapeHtml(pendingInsert)}">${formatForDisplay(pendingInsert)}</span>`;
    }

    // Wrap in Zero Width Spaces (\u200B) for cursor navigation
    lineBuilder += `\u200B${spanHtml}\u200B`;

    pendingDelete = '';
    pendingInsert = '';
  };

  // Helper to append text to current line
  // If text contains newlines, it closes the current <div> and starts a new one.
  const appendText = (text: string) => {
    const parts = text.split('\n');
    
    // NOTE: We do NOT pop the last empty element. 
    // If text is "\n", parts is ["", ""].
    // i=0: append "". 
    // i=1: newline found. Close div. Start new div. Append "".
    // This preserves explicit newlines passed from the diff engine.

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i > 0) {
            // Newline encountered: Close current div (implicitly) and start new one
            htmlBuilder += `<div>${lineBuilder || '<br>'}</div>`; // Use <br> if empty line
            lineBuilder = ''; 
        }
        
        if (part) {
           lineBuilder += formatForDisplay(part);
        }
    }
  };

  for (const part of diffs) {
    if (part.type === 'equal') {
      flushPending();
      appendText(part.value);
    } else if (part.type === 'delete') {
       // Accumulate deletions.
       // Note: If deletions contain newlines, we keep them in 'data-original'.
       // Visually it will just be a [-] marker.
       pendingDelete += part.value;
    } else if (part.type === 'insert') {
       // IMPORTANT: If we are inserting a newline, we MUST treat it as a structural break.
       // We cannot put a <div> break inside a <span>.
       if (part.value === '\n') {
          flushPending(); // Close any preceding interactive span
          appendText(part.value); // Insert the real structural break (</div><div>)
       } else {
          // Normal text insertion
          pendingInsert += part.value;
       }
    }
  }
  flushPending();

  // Handle remaining line buffer
  if (lineBuilder) {
      if (htmlBuilder) {
          htmlBuilder += `<div>${lineBuilder}</div>`;
      } else {
          // Single line content
          htmlBuilder += lineBuilder;
      }
  } else if (!htmlBuilder && !lineBuilder) {
      // Empty content
      htmlBuilder = ''; 
  }

  return htmlBuilder;
};
