import type { WorkspaceMetadata } from "./types";

/**
 * Read workspace metadata from R2.
 */
export async function getWorkspaceMetadata(
	bucket: R2Bucket,
	workspaceId: string,
): Promise<WorkspaceMetadata | null> {
	const key = `_system/workspaces/${workspaceId}.json`;
	const obj = await bucket.get(key);
	if (!obj) return null;
	return (await obj.json()) as WorkspaceMetadata;
}

/**
 * Save workspace metadata to R2.
 */
export async function putWorkspaceMetadata(
	bucket: R2Bucket,
	workspace: WorkspaceMetadata,
): Promise<void> {
	const key = `_system/workspaces/${workspace.id}.json`;
	await bucket.put(key, JSON.stringify(workspace, null, 2), {
		httpMetadata: { contentType: "application/json" },
	});
}

/**
 * Delete workspace metadata from R2.
 */
export async function deleteWorkspaceMetadata(
	bucket: R2Bucket,
	workspaceId: string,
): Promise<void> {
	const key = `_system/workspaces/${workspaceId}.json`;
	await bucket.delete(key);
}

/**
 * Check if user is a member of the workspace or is the admin.
 */
export function checkMembership(
	workspace: WorkspaceMetadata,
	email: string,
	adminEmail?: string,
): { authorized: boolean; role: "admin" | "owner" | "member" | null } {
	if (adminEmail && email === adminEmail) {
		return { authorized: true, role: "admin" };
	}

	const member = workspace.members.find((m) => m.email === email);
	if (member) {
		return { authorized: true, role: member.role };
	}

	return { authorized: false, role: null };
}

/**
 * Read user record from R2.
 */
export async function getUserRecord(
	bucket: R2Bucket,
	email: string,
): Promise<{ email: string; name: string; workspaces: string[]; updated_at: string } | null> {
	const key = `_system/users/${email}.json`;
	const obj = await bucket.get(key);
	if (!obj) return null;
	return (await obj.json()) as { email: string; name: string; workspaces: string[]; updated_at: string };
}

/**
 * Save user record to R2.
 */
export async function putUserRecord(
	bucket: R2Bucket,
	user: { email: string; name: string; workspaces: string[]; updated_at: string },
): Promise<void> {
	const key = `_system/users/${user.email}.json`;
	await bucket.put(key, JSON.stringify(user, null, 2), {
		httpMetadata: { contentType: "application/json" },
	});
}

/**
 * Add a workspace to a user's record.
 */
export async function addWorkspaceToUser(
	bucket: R2Bucket,
	email: string,
	name: string,
	workspaceId: string,
): Promise<void> {
	const existing = await getUserRecord(bucket, email);
	const user = existing || { email, name, workspaces: [], updated_at: "" };
	if (!user.workspaces.includes(workspaceId)) {
		user.workspaces.push(workspaceId);
	}
	user.name = name || user.name;
	user.updated_at = new Date().toISOString();
	await putUserRecord(bucket, user);
}

/**
 * Remove a workspace from a user's record.
 */
export async function removeWorkspaceFromUser(
	bucket: R2Bucket,
	email: string,
	workspaceId: string,
): Promise<void> {
	const user = await getUserRecord(bucket, email);
	if (!user) return;
	user.workspaces = user.workspaces.filter((w) => w !== workspaceId);
	user.updated_at = new Date().toISOString();
	await putUserRecord(bucket, user);
}
