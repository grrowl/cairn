/**
 * Create an MCP-native error response.
 */
export function mcpError(errorType: string, message: string) {
	return {
		content: [{ type: "text" as const, text: `${errorType}: ${message}` }],
		isError: true as const,
	};
}

/**
 * Wrap a tool handler to catch unexpected errors and return MCP-native errors.
 */
export function withErrorHandling<T>(
	handler: (args: T) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>,
): (args: T) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
	return async (args: T) => {
		try {
			return await handler(args);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			console.error("Tool error:", { error: message, args });
			return mcpError("internal_error", message);
		}
	};
}
