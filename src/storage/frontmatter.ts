import yaml from "js-yaml";

export interface Frontmatter {
	title?: string;
	type?: string;
	tags?: string[];
	aliases?: string[];
	created?: string;
	modified?: string;
	[key: string]: unknown;
}

export interface ParsedNote {
	frontmatter: Frontmatter;
	body: string;
	raw: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(raw: string): ParsedNote {
	const match = raw.match(FRONTMATTER_RE);
	if (!match) {
		return { frontmatter: {}, body: raw, raw };
	}

	let frontmatter: Frontmatter;
	try {
		frontmatter = (yaml.load(match[1]) as Frontmatter) || {};
	} catch {
		frontmatter = {};
	}

	// Normalize tags and aliases to arrays
	if (typeof frontmatter.tags === "string") {
		frontmatter.tags = [frontmatter.tags];
	}
	if (typeof frontmatter.aliases === "string") {
		frontmatter.aliases = [frontmatter.aliases];
	}

	return { frontmatter, body: match[2], raw };
}

export function serialiseFrontmatter(frontmatter: Frontmatter, body: string): string {
	const yamlStr = yaml.dump(frontmatter, {
		lineWidth: -1,
		noRefs: true,
		sortKeys: false,
	}).trim();

	return `---\n${yamlStr}\n---\n${body}`;
}
