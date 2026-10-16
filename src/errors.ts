/**
 * Thrown when a request can't reach AnkiConnect, usually because the Anki
 * desktop app isn't running or the AnkiConnect add-on isn't installed.
 *
 * It replaces the error thrown by the fetch adapter, keeping that error's
 * `message` and `cause`. In Node, for example, `message` is `'fetch failed'`
 * and `cause.code` is `'ECONNREFUSED'`. It extends `TypeError` because that's
 * what `fetch` throws for network failures.
 */
export class AnkiConnectUnreachableError extends TypeError {
	override name = 'AnkiConnectUnreachableError'

	/**
	 * Wraps the error from a failed fetch adapter call.
	 *
	 * @param fetchError - The error the fetch adapter threw or rejected with.
	 */
	constructor(fetchError: unknown) {
		const isError = fetchError instanceof Error
		super(isError ? fetchError.message : String(fetchError), {
			cause: isError ? fetchError.cause : fetchError,
		})
	}
}
