/**
 * WikiLink parser.
 * Extracts [[wikilink]] references from markdown body.
 */

export interface ExtractedLink {
	/** Raw wikilink text e.g. "[[Jamie Wilson|Jamie]]" */
	raw: string;
	/** Normalised target path/slug */
	target: string;
	/** Display text (after | if present, otherwise same as target input) */
	display: string;
	/** Context snippet (~100 chars around the link) */
	context: string;
}

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Normalise a link target to a slug.
 * - If it contains '/', treat as a path (preserve structure, slugify segments)
 * - Otherwise, convert spaces to hyphens, lowercase, strip special chars
 */
export function normaliseTarget(target: string): string {
	if (target.includes("/")) {
		// Path reference — slugify each segment
		return target
			.split("/")
			.map((seg) =>
				seg
					.toLowerCase()
					.trim()
					.replace(/[^a-z0-9-]/g, "-")
					.replace(/-+/g, "-")
					.replace(/^-|-$/g, ""),
			)
			.join("/");
	}

	return target
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export function extractLinks(body: string): ExtractedLink[] {
	const links: ExtractedLink[] = [];
	let match: RegExpExecArray | null;

	while ((match = WIKILINK_RE.exec(body)) !== null) {
		const raw = match[0];
		const inner = match[1];
		const offset = match.index;

		// Handle aliased links: [[target|display]]
		const pipeIndex = inner.indexOf("|");
		let targetText: string;
		let display: string;

		if (pipeIndex !== -1) {
			targetText = inner.slice(0, pipeIndex).trim();
			display = inner.slice(pipeIndex + 1).trim();
		} else {
			targetText = inner.trim();
			display = targetText;
		}

		const target = normaliseTarget(targetText);

		// Extract context (~50 chars on each side)
		const contextStart = Math.max(0, offset - 50);
		const contextEnd = Math.min(body.length, offset + raw.length + 50);
		const context = body.slice(contextStart, contextEnd).replace(/\n/g, " ").trim();

		links.push({ raw, target, display, context });
	}

	return links;
}
