/** Shared helpers for interpreting code-review stage verdicts. */

export function isNonCleanReviewVerdict(verdict: unknown): boolean {
  if (!verdict || typeof verdict !== 'object') return false;
  const review = verdict as { clean?: unknown; recommendation?: unknown; architectural_status?: unknown };
  if (review.clean === false) return true;
  if (review.recommendation && review.recommendation !== 'APPROVE') return true;
  if (review.architectural_status && review.architectural_status !== 'CLEAR') return true;
  return false;
}
