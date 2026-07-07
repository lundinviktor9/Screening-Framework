import { METRIC_VALIDATION, type ValidationRule } from '../config/metricValidation';
import type { MetricStatusFlag } from '../types';

export interface ValidationResult {
  valid: boolean;
  /** Human-readable error message if invalid */
  message?: string;
  /** The rule that was checked (for UI display) */
  rule?: ValidationRule;
}

/**
 * Check a metric value against its validation bounds.
 * Returns { valid: true } if no rule exists for the metric (unrestricted).
 * Returns { valid: true } for null/undefined values (missing, not invalid).
 */
export function validateMetricValue(metricId: number, value: number | null | undefined): ValidationResult {
  if (value === null || value === undefined) return { valid: true };
  const rule = METRIC_VALIDATION[metricId];
  if (!rule) return { valid: true };

  if (value < rule.min || value > rule.max) {
    const hintStr = rule.hint ? ` — ${rule.hint}` : '';
    return {
      valid: false,
      rule,
      message: `Value ${value} outside expected range [${rule.min}, ${rule.max}] ${rule.unit}${hintStr}`,
    };
  }
  return { valid: true, rule };
}

/** Returns true if the metric status means the value should contribute to scoring. */
export function isScorableStatus(status?: MetricStatusFlag): boolean {
  return !!status && status !== 'REVIEW_NEEDED';
}

/**
 * Determine the appropriate status for a manual entry given the value and
 * user-selected confidence level. If the value fails validation, returns
 * REVIEW_NEEDED regardless of confidence.
 */
export function deriveStatusForEntry(
  metricId: number,
  value: number | null | undefined,
  confidence: 'primary_source' | 'estimated' | 'regional_proxy',
  overrideValidation = false,
): MetricStatusFlag {
  if (value === null || value === undefined) return 'ESTIMATED';

  // If value fails validation and user hasn't overridden, flag as REVIEW_NEEDED
  if (!overrideValidation) {
    const result = validateMetricValue(metricId, value);
    if (!result.valid) return 'REVIEW_NEEDED';
  }

  if (confidence === 'regional_proxy') return 'REGIONAL_PROXY';
  return 'ESTIMATED';
}
