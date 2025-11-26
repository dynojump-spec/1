
/**
 * A simple diff algorithm to support "Interactive Diffs"
 * It compares two strings and returns HTML string with interactive spans.
 */

// Tokenizes text into words and whitespace/punctuation/newlines
const tokenize = (text: string): string[] => {
  // Split by spaces, newlines, but keep delimiters
  return text.split(/([\s\S])/).filter(s => s.length > 0);
};

// Basic diff implementation (simplified Myers or similar approach sufficient for short text chunks)
// Since we need to run this in browser without large deps, we implement a simple LCS based diff.
const computeDiff = (original: string, modified: string) => {
  // Revert to simpler tokenizer that doesn't explicitly isolate newlines,
  // restoring previous behavior for diff calculation.
  const pattern = /(\s+|\b)/; 
  const tokens1 = original.split(pattern).filter(s => s !== '');
  const tokens2 = modified.split(pattern).filter(s => s !== '');

  // Using a simple DP approach for Longest Common Subsequence
  const n = tokens1.length;
  const m = tokens2.length;
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

/**
 * Generates HTML with interactive spans.
 * 
 * Logic:
 * - Equal text is returned as is.
 * - Deleted text is hidden initially (but stored in data-original).
 * - Inserted text is shown wrapped in span (data-modified).
 * 
 * To achieve the toggle effect:
 * The span will hold BOTH the original (deleted) text and the new (inserted) text.
 * Default state: Show Modified.
 * Click state: Show Original.
 * 
 * Complexity: We need to group consecutive inserts/deletes to make a single clickable "change block".
 */
export const generateInteractiveDiffHtml = (originalText: string, modifiedText: string): string => {
  const diffs = computeDiff(originalText, modifiedText);
  let htmlBuilder = '';
  
  let pendingDelete = '';
  let pendingInsert = '';

  const flushPending = () => {
    if (!pendingDelete && !pendingInsert) return;

    // IMPORTANT: We use 'escapeHtml' for attributes to preserve structure safely.
    // We use 'formatForDisplay' for the visible content to ensure newlines render as <br>.
    
    let spanHtml = '';

    if (pendingInsert && !pendingDelete) {
        // Pure addition
        spanHtml = `<span class="diff-interactive" contenteditable="false" data-state="modified" data-original="" data-modified="${escapeHtml(pendingInsert)}">${formatForDisplay(pendingInsert)}</span>`;
    } else if (!pendingInsert && pendingDelete) {
        // Pure deletion
        // We render an empty span with data attributes so it can be toggled back.
        // Visually it disappears, which is correct for deletion.
        spanHtml = `<span class="diff-interactive" contenteditable="false" data-state="modified" data-original="${escapeHtml(pendingDelete)}" data-modified=""></span>`; 
    } else {
        // Modification (Substitution)
        spanHtml = `<span class="diff-interactive" contenteditable="false" data-state="modified" data-original="${escapeHtml(pendingDelete)}" data-modified="${escapeHtml(pendingInsert)}">${formatForDisplay(pendingInsert)}</span>`;
    }

    // Wrap in Zero Width Spaces (\u200B) to provide cursor landing spots and fix vertical navigation jumping bugs
    htmlBuilder += `\u200B${spanHtml}\u200B`;

    pendingDelete = '';
    pendingInsert = '';
  };

  for (const part of diffs) {
    if (part.type === 'equal') {
      flushPending();
      // Equal parts also need newlines converted to <br> for visual consistency
      htmlBuilder += formatForDisplay(part.value);
    } else if (part.type === 'delete') {
      pendingDelete += part.value;
    } else if (part.type === 'insert') {
      pendingInsert += part.value;
    }
  }
  flushPending();

  return htmlBuilder;
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
  return escapeHtml(str).replace(/\n/g, "<br>");
};
