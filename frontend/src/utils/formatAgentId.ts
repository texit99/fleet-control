/**
 * Format agent ID for display with proper capitalization
 * - cv2-it → CV2-IT
 * - cv2-ui → CV2-UI
 * - cv2-pa → CV2-PA
 * - cv2-main → CV2-Main
 * - cv2-ops → CV2-Ops
 */
export function formatAgentId(id: string): string {
  // Known abbreviations that should be all uppercase
  const abbreviations = ['it', 'ui', 'pa', 'ai', 'dba'];

  const parts = id.split('-');

  return parts.map((part, index) => {
    // First part (cv2, cv3, mac) - uppercase
    if (index === 0) {
      return part.toUpperCase();
    }
    // Check if it's a known abbreviation
    if (abbreviations.includes(part.toLowerCase())) {
      return part.toUpperCase();
    }
    // Otherwise, title case
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join('-');
}
