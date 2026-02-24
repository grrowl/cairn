const ADJECTIVES = [
	"bright", "calm", "clear", "cool", "crisp", "dawn", "deep", "fair",
	"fast", "fine", "firm", "glad", "gold", "good", "gray", "green",
	"keen", "kind", "late", "lean", "live", "long", "lost", "main",
	"mild", "neat", "new", "next", "nice", "old", "open", "pale",
	"pine", "pure", "rare", "real", "red", "rich", "safe", "sage",
	"slim", "soft", "star", "sure", "tall", "teal", "thin", "true",
	"vast", "warm", "west", "wide", "wild", "wise", "bold", "free",
	"iron", "jade", "lake", "moon", "peak", "rain", "rose", "snow",
];

const NOUNS = [
	"arch", "bark", "bay", "bell", "bird", "bloom", "bolt", "brook",
	"cape", "cave", "cliff", "cloud", "coast", "coral", "crane", "creek",
	"crest", "dale", "dawn", "deer", "delta", "dune", "elm", "ember",
	"fern", "field", "finch", "flame", "flint", "ford", "forge", "fox",
	"frost", "gale", "gate", "glen", "grove", "hawk", "haven", "heath",
	"heron", "hill", "isle", "ivy", "jade", "lake", "lark", "leaf",
	"light", "lily", "marsh", "mesa", "mist", "moss", "oak", "orbit",
	"owl", "path", "peak", "pine", "pond", "quill", "rain", "reed",
	"ridge", "river", "rock", "sage", "shore", "sky", "slate", "spark",
	"spring", "star", "stone", "storm", "swift", "thorn", "tide", "trail",
	"vale", "vine", "wave", "wind", "wood", "wren", "cove", "falcon",
];

function secureRandom(max: number): number {
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	return array[0] % max;
}

export function generateWorkspaceId(): string {
	const adj = ADJECTIVES[secureRandom(ADJECTIVES.length)];
	const noun = NOUNS[secureRandom(NOUNS.length)];
	return `${adj}_${noun}`;
}

export function validateWorkspaceId(id: string): string | null {
	if (id.length < 3 || id.length > 40) {
		return "Workspace ID must be 3-40 characters";
	}
	if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
		return "Workspace ID must be lowercase alphanumeric, hyphens, and underscores (cannot start with _ or -)";
	}
	if (id.startsWith("_")) {
		return "Workspace ID cannot start with underscore (reserved)";
	}
	return null;
}
