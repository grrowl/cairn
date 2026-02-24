/**
 * Markdown section operations.
 * All section params use heading text without # prefix.
 * Matches first heading with that text, case-insensitive.
 */

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

interface SectionRange {
	/** Index of the heading line */
	headingIndex: number;
	/** Heading level (1-6) */
	level: number;
	/** Start of section content (line after heading) */
	contentStart: number;
	/** End of section content (exclusive, before next same/higher heading or EOF) */
	contentEnd: number;
}

function findSection(lines: string[], headingText: string): SectionRange | null {
	const target = headingText.toLowerCase().trim();

	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(HEADING_RE);
		if (!match) continue;

		const level = match[1].length;
		const text = match[2].toLowerCase().trim();

		if (text !== target) continue;

		// Found the heading. Find the end of its section.
		const contentStart = i + 1;
		let contentEnd = lines.length;

		for (let j = contentStart; j < lines.length; j++) {
			const nextMatch = lines[j].match(HEADING_RE);
			if (nextMatch && nextMatch[1].length <= level) {
				contentEnd = j;
				break;
			}
		}

		return { headingIndex: i, level, contentStart, contentEnd };
	}

	return null;
}

export function extractSection(body: string, headingText: string): string | null {
	const lines = body.split("\n");
	const section = findSection(lines, headingText);
	if (!section) return null;

	return lines.slice(section.contentStart, section.contentEnd).join("\n");
}

export function appendToSection(body: string, headingText: string, content: string): string | null {
	const lines = body.split("\n");
	const section = findSection(lines, headingText);
	if (!section) return null;

	// Insert content at the end of the section
	const before = lines.slice(0, section.contentEnd);
	const after = lines.slice(section.contentEnd);

	// Ensure there's a blank line before appended content if section has content
	const sectionContent = lines.slice(section.contentStart, section.contentEnd);
	const lastLine = sectionContent[sectionContent.length - 1];
	const needsBlankLine = sectionContent.length > 0 && lastLine !== undefined && lastLine.trim() !== "";

	const parts = [...before];
	if (needsBlankLine) parts.push("");
	parts.push(content);
	if (after.length > 0) parts.push("");
	parts.push(...after);

	return parts.join("\n");
}

export function prependToSection(body: string, headingText: string, content: string): string | null {
	const lines = body.split("\n");
	const section = findSection(lines, headingText);
	if (!section) return null;

	// Insert content right after the heading line
	const before = lines.slice(0, section.contentStart);
	const after = lines.slice(section.contentStart);

	return [...before, content, ...after].join("\n");
}
