/**
 * Validates and fixes malformed ISO date strings.
 * Handles cases like "2025-11-17T18:41:12.910ZT22:00:00" where two date strings are concatenated.
 * 
 * @param dateString - Potentially malformed date string
 * @returns Valid ISO date string or throws error if cannot be fixed
 */
function validateAndFixDateString(dateString: string): string {
  // Check if the string contains two "T" characters (indicating concatenation)
  const tCount = (dateString.match(/T/g) || []).length;
  
  if (tCount > 1) {
    // Try to extract the time part (after the second T)
    // Pattern: YYYY-MM-DDTHH:mm:ss.sssZTHH:mm:ss
    // Example: "2025-11-17T18:41:12.910ZT22:00:00" -> extract "2025-11-17" and "22:00:00"
    const match = dateString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)Z?T(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)$/);
    
    if (match) {
      const [, datePart, , timePart] = match; // datePart = group 1, timePart = group 3 (skip group 2)
      // Combine date part with the extracted time part (the one after the second T)
      const fixedDate = `${datePart}T${timePart}`;
      
      // Validate the fixed date
      const testDate = new Date(fixedDate);
      if (!isNaN(testDate.getTime())) {
        return testDate.toISOString();
      }
    }
    
    // If pattern matching fails, try to extract just the date and time parts more flexibly
    // Look for pattern like: ...T...ZT... where we want the last T... part
    const lastTIndex = dateString.lastIndexOf('T');
    if (lastTIndex > 0) {
      const beforeLastT = dateString.substring(0, lastTIndex);
      const afterLastT = dateString.substring(lastTIndex + 1);
      
      // Extract date part (YYYY-MM-DD) from before the last T
      const dateMatch = beforeLastT.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch && afterLastT) {
        const datePart = dateMatch[1];
        const fixedDate = `${datePart}T${afterLastT}`;
        const testDate = new Date(fixedDate);
        if (!isNaN(testDate.getTime())) {
          return testDate.toISOString();
        }
      }
    }
  }
  
  // Try to parse as-is
  const testDate = new Date(dateString);
  if (isNaN(testDate.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  
  return testDate.toISOString();
}

/**
 * Replaces currentDate+<milliseconds> format strings with actual ISO date strings.
 * Format: "currentDate+123456" where 123456 is milliseconds to add to current time.
 * If the number is 0, it uses the current time.
 * Also validates and fixes malformed date strings.
 * 
 * @param dateString - String that may contain currentDate+<milliseconds> format or be malformed
 * @returns ISO date string with the actual calculated date, validated and fixed
 */
export function replaceRelativeDate(dateString: string | undefined): string | undefined {
  if (!dateString) {
    return dateString;
  }

  // Match pattern: currentDate+<number> (e.g., currentDate+0, currentDate+86400000)
  const pattern = /currentDate\+(\d+)/;
  const match = dateString.match(pattern);

  if (match) {
    const millisecondsToAdd = parseInt(match[1], 10);
    const now = new Date();
    const calculatedDate = new Date(now.getTime() + millisecondsToAdd);
    const isoString = calculatedDate.toISOString();
    
    // If the entire string is just the pattern, return the ISO string directly
    // Otherwise, replace the pattern within the string
    if (dateString.trim() === match[0]) {
      return isoString;
    }
    
    // Replace the matched pattern with the ISO string
    const replaced = dateString.replace(pattern, isoString);
    // Validate and fix the result in case it's still malformed
    return validateAndFixDateString(replaced);
  }

  // Validate and fix the date string
  return validateAndFixDateString(dateString);
}

