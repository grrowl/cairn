export interface WorkspaceMember {
	email: string;
	role: "owner" | "member";
	added_at: string;
}

export interface WorkspaceSettings {
	entity_types: string[];
	timezone: string;
}

export interface WorkspaceMetadata {
	id: string;
	name: string;
	created_at: string;
	created_by: string;
	members: WorkspaceMember[];
	settings: WorkspaceSettings;
}

export interface UserRecord {
	email: string;
	name: string;
	workspaces: string[];
	updated_at: string;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
	entity_types: ["person", "company", "project", "topic"],
	timezone: "Australia/Melbourne",
};

export const RESERVED_SLUGS = new Set([
	"authorize",
	"callback",
	"token",
	"register",
	"api",
	"mcp",
	"auth",
	".well-known",
	"_system",
]);
