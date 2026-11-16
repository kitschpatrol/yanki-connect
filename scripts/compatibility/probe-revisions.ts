/**
 * Bump an action when its assertions or prerequisites change meaning. Legacy
 * artifacts use revision 1. Unchanged actions remain comparable to old runs.
 */
export const PROBE_REVISIONS: Record<string, number> = {
	guiAnswerCard: 2,
	guiDeckReview: 2,
	guiShowAnswer: 2,
	guiShowQuestion: 2,
	modelNamesAndIds: 2,
}
