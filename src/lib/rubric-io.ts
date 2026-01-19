import { Rubric } from '@/types/rubric';

/**
 * Encodes a rubric object into a base64 string for export.
 * Ensures all relevant fields for different rubric types are included.
 */
export function exportRubric(rubric: Rubric): string {
  // Create a clean export object
  const exportData: Partial<Rubric> = {
    name: rubric.name,
    description: rubric.description || '',
    type: rubric.type,
    // Include specific fields based on type if needed, but safe to include all structural data
    gradingMethod: rubric.gradingMethod,
    learningGoalRules: rubric.learningGoalRules,
    
    // Core structure
    columns: rubric.columns,
    rows: rubric.rows,
    criteria: rubric.criteria,
    thresholds: rubric.thresholds,
    scoringMode: rubric.scoringMode,
    
    // Metadata useful for import preview
    totalPossiblePoints: rubric.totalPossiblePoints,
  };

  // JSON stringify and base64 encode
  // Using unescape(encodeURIComponent(str)) to handle UTF-8 characters correctly
  const jsonString = JSON.stringify(exportData);
  return btoa(unescape(encodeURIComponent(jsonString)));
}

/**
 * Decodes and parses a base64 rubric import string.
 * Sanitizes the data by removing IDs to ensure it's treated as a new copy.
 * Returns the partial rubric object ready for preview or import.
 */
export function parseImportString(importString: string): Partial<Rubric> {
  if (!importString || !importString.trim()) {
    throw new Error('Empty import string');
  }

  try {
    // Decode base64
    // Using decodeURIComponent(escape(str)) to handle UTF-8 characters correctly
    const jsonString = decodeURIComponent(escape(atob(importString.trim())));
    const data = JSON.parse(jsonString);

    // Basic validation
    if (!data.name || !data.rows || !data.columns) {
      throw new Error('Invalid rubric format: Missing required fields (name, rows, or columns)');
    }

    // Sanitize: remove specific IDs that should be regenerated on save
    // We don't need to recursively remove all row/col IDs here because the store 
    // usually handles ID generation if they are missing, OR keeps them if we want to preserve structure.
    // However, the prompt asked to "generate a NEW UUID", which usually applies to the Rubric ID itself.
    // We definitely strip the Rubric ID.
    const { id, user_id, created_at, updated_at, ...cleanData } = data;

    return cleanData;
  } catch (error) {
    console.error('Import parse error:', error);
    throw new Error('Failed to parse rubric string. Please ensure it is a valid export code.');
  }
}
