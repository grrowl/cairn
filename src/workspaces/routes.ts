import { Hono } from "hono";
import type { WorkspaceMetadata } from "./types";
import { DEFAULT_SETTINGS, RESERVED_SLUGS } from "./types";
import { generateWorkspaceId, validateWorkspaceId } from "./id-generator";
import {
	getWorkspaceMetadata,
	putWorkspaceMetadata,
	deleteWorkspaceMetadata,
	getUserRecord,
	addWorkspaceToUser,
	removeWorkspaceFromUser,
	checkMembership,
} from "./membership";

interface AuthContext {
	email: string;
	name: string;
}

type HonoEnv = { Bindings: Env & { __auth?: AuthContext }; Variables: { auth: AuthContext } };

export const workspaceRoutes = new Hono<HonoEnv>();

// Auth middleware: extract auth context from env.__auth (set by apiHandler)
workspaceRoutes.use("/api/*", async (c, next) => {
	const auth = (c.env as any).__auth as AuthContext | undefined;
	if (!auth || !auth.email) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	c.set("auth", auth);
	await next();
});

// List workspaces for the current user
workspaceRoutes.get("/api/workspaces", async (c) => {
	const { email } = c.get("auth");
	const bucket = c.env.BUCKET;
	const adminEmail = c.env.ADMIN_EMAIL;

	const user = await getUserRecord(bucket, email);
	const workspaceIds = user?.workspaces || [];

	// If admin, also find all workspaces
	if (adminEmail && email === adminEmail) {
		let cursor: string | undefined;
		do {
			const listed = await bucket.list({
				prefix: "_system/workspaces/",
				cursor,
			});
			for (const obj of listed.objects) {
				const id = obj.key.replace("_system/workspaces/", "").replace(".json", "");
				if (!workspaceIds.includes(id)) {
					workspaceIds.push(id);
				}
			}
			cursor = listed.truncated ? listed.cursor : undefined;
		} while (cursor);
	}

	const workspaces: WorkspaceMetadata[] = [];
	for (const id of workspaceIds) {
		const ws = await getWorkspaceMetadata(bucket, id);
		if (ws) workspaces.push(ws);
	}

	return c.json({ workspaces });
});

// Create workspace
workspaceRoutes.post("/api/workspaces", async (c) => {
	const { email, name } = c.get("auth");
	const bucket = c.env.BUCKET;
	const body = await c.req.json<{ id?: string; name?: string }>();

	// Generate or validate ID
	let workspaceId = body.id || generateWorkspaceId();

	// Validate
	const validationError = validateWorkspaceId(workspaceId);
	if (validationError) {
		return c.json({ error: validationError }, 400);
	}
	if (RESERVED_SLUGS.has(workspaceId)) {
		return c.json({ error: "This workspace ID is reserved" }, 400);
	}

	// Check uniqueness
	const existing = await getWorkspaceMetadata(bucket, workspaceId);
	if (existing) {
		// If auto-generated, try again
		if (!body.id) {
			workspaceId = generateWorkspaceId();
			const stillExists = await getWorkspaceMetadata(bucket, workspaceId);
			if (stillExists) {
				return c.json({ error: "Failed to generate unique workspace ID, please provide a custom one" }, 409);
			}
		} else {
			return c.json({ error: "Workspace ID already exists" }, 409);
		}
	}

	const now = new Date().toISOString();
	const workspace: WorkspaceMetadata = {
		id: workspaceId,
		name: body.name || workspaceId,
		created_at: now,
		created_by: email,
		members: [{ email, role: "owner", added_at: now }],
		settings: { ...DEFAULT_SETTINGS },
	};

	await putWorkspaceMetadata(bucket, workspace);
	await addWorkspaceToUser(bucket, email, name, workspaceId);

	return c.json({ workspace }, 201);
});

// Get workspace details
workspaceRoutes.get("/api/workspaces/:id", async (c) => {
	const { email } = c.get("auth");
	const bucket = c.env.BUCKET;
	const workspaceId = c.req.param("id");

	const workspace = await getWorkspaceMetadata(bucket, workspaceId);
	if (!workspace) {
		return c.json({ error: "Workspace not found" }, 404);
	}

	const { authorized } = checkMembership(workspace, email, c.env.ADMIN_EMAIL);
	if (!authorized) {
		return c.json({ error: "Unauthorized" }, 403);
	}

	return c.json({ workspace });
});

// Update workspace settings
workspaceRoutes.put("/api/workspaces/:id", async (c) => {
	const { email } = c.get("auth");
	const bucket = c.env.BUCKET;
	const workspaceId = c.req.param("id");

	const workspace = await getWorkspaceMetadata(bucket, workspaceId);
	if (!workspace) {
		return c.json({ error: "Workspace not found" }, 404);
	}

	const { authorized, role } = checkMembership(workspace, email, c.env.ADMIN_EMAIL);
	if (!authorized || (role !== "owner" && role !== "admin")) {
		return c.json({ error: "Only owners and admins can update workspace settings" }, 403);
	}

	const body = await c.req.json<{ name?: string; settings?: Partial<WorkspaceMetadata["settings"]> }>();
	if (body.name) workspace.name = body.name;
	if (body.settings) {
		workspace.settings = { ...workspace.settings, ...body.settings };
	}

	await putWorkspaceMetadata(bucket, workspace);
	return c.json({ workspace });
});

// Delete workspace (admin only)
workspaceRoutes.delete("/api/workspaces/:id", async (c) => {
	const { email } = c.get("auth");
	const bucket = c.env.BUCKET;
	const workspaceId = c.req.param("id");

	const adminEmail = c.env.ADMIN_EMAIL;
	if (!adminEmail || email !== adminEmail) {
		return c.json({ error: "Only platform admins can delete workspaces" }, 403);
	}

	const workspace = await getWorkspaceMetadata(bucket, workspaceId);
	if (!workspace) {
		return c.json({ error: "Workspace not found" }, 404);
	}

	// Remove workspace from all members' user records
	for (const member of workspace.members) {
		await removeWorkspaceFromUser(bucket, member.email, workspaceId);
	}

	// Delete all notes in the workspace
	let cursor: string | undefined;
	do {
		const listed = await bucket.list({
			prefix: `${workspaceId}/`,
			cursor,
		});
		if (listed.objects.length > 0) {
			await bucket.delete(listed.objects.map((o) => o.key));
		}
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);

	await deleteWorkspaceMetadata(bucket, workspaceId);

	return c.json({ deleted: workspaceId });
});

// List members
workspaceRoutes.get("/api/workspaces/:id/members", async (c) => {
	const { email } = c.get("auth");
	const bucket = c.env.BUCKET;
	const workspaceId = c.req.param("id");

	const workspace = await getWorkspaceMetadata(bucket, workspaceId);
	if (!workspace) {
		return c.json({ error: "Workspace not found" }, 404);
	}

	const { authorized } = checkMembership(workspace, email, c.env.ADMIN_EMAIL);
	if (!authorized) {
		return c.json({ error: "Unauthorized" }, 403);
	}

	return c.json({ members: workspace.members });
});

// Invite member
workspaceRoutes.post("/api/workspaces/:id/members", async (c) => {
	const { email } = c.get("auth");
	const bucket = c.env.BUCKET;
	const workspaceId = c.req.param("id");

	const workspace = await getWorkspaceMetadata(bucket, workspaceId);
	if (!workspace) {
		return c.json({ error: "Workspace not found" }, 404);
	}

	const { authorized, role } = checkMembership(workspace, email, c.env.ADMIN_EMAIL);
	if (!authorized || (role !== "owner" && role !== "admin")) {
		return c.json({ error: "Only owners and admins can invite members" }, 403);
	}

	const body = await c.req.json<{ email: string; role?: "member" | "owner" }>();
	if (!body.email) {
		return c.json({ error: "Email is required" }, 400);
	}

	// Check if already a member
	if (workspace.members.find((m) => m.email === body.email)) {
		return c.json({ error: "User is already a member" }, 409);
	}

	const now = new Date().toISOString();
	workspace.members.push({
		email: body.email,
		role: body.role || "member",
		added_at: now,
	});

	await putWorkspaceMetadata(bucket, workspace);
	await addWorkspaceToUser(bucket, body.email, "", workspaceId);

	return c.json({ member: { email: body.email, role: body.role || "member", added_at: now } }, 201);
});

// Remove member
workspaceRoutes.delete("/api/workspaces/:id/members/:email", async (c) => {
	const { email } = c.get("auth");
	const bucket = c.env.BUCKET;
	const workspaceId = c.req.param("id");
	const targetEmail = decodeURIComponent(c.req.param("email"));

	const workspace = await getWorkspaceMetadata(bucket, workspaceId);
	if (!workspace) {
		return c.json({ error: "Workspace not found" }, 404);
	}

	const { authorized, role } = checkMembership(workspace, email, c.env.ADMIN_EMAIL);
	if (!authorized || (role !== "owner" && role !== "admin")) {
		return c.json({ error: "Only owners and admins can remove members" }, 403);
	}

	const memberIndex = workspace.members.findIndex((m) => m.email === targetEmail);
	if (memberIndex === -1) {
		return c.json({ error: "Member not found" }, 404);
	}

	// Can't remove the last owner
	const target = workspace.members[memberIndex];
	if (target.role === "owner") {
		const ownerCount = workspace.members.filter((m) => m.role === "owner").length;
		if (ownerCount <= 1) {
			return c.json({ error: "Cannot remove the last owner" }, 400);
		}
	}

	workspace.members.splice(memberIndex, 1);
	await putWorkspaceMetadata(bucket, workspace);
	await removeWorkspaceFromUser(bucket, targetEmail, workspaceId);

	return c.json({ removed: targetEmail });
});

// Rebuild index (admin/owner only)
workspaceRoutes.post("/api/workspaces/:id/rebuild-index", async (c) => {
	const { email } = c.get("auth");
	const bucket = c.env.BUCKET;
	const workspaceId = c.req.param("id");

	const workspace = await getWorkspaceMetadata(bucket, workspaceId);
	if (!workspace) {
		return c.json({ error: "Workspace not found" }, 404);
	}

	const { authorized, role } = checkMembership(workspace, email, c.env.ADMIN_EMAIL);
	if (!authorized || (role !== "owner" && role !== "admin")) {
		return c.json({ error: "Only owners and admins can rebuild the index" }, 403);
	}

	const indexId = c.env.WORKSPACE_INDEX.idFromName(workspaceId);
	const index = c.env.WORKSPACE_INDEX.get(indexId);
	const result = await (index as any).rebuildIndex(workspaceId);

	return c.json(result);
});

// Rebuild index status (admin/owner only)
workspaceRoutes.get("/api/workspaces/:id/rebuild-index", async (c) => {
	const { email } = c.get("auth");
	const bucket = c.env.BUCKET;
	const workspaceId = c.req.param("id");

	const workspace = await getWorkspaceMetadata(bucket, workspaceId);
	if (!workspace) {
		return c.json({ error: "Workspace not found" }, 404);
	}

	const { authorized, role } = checkMembership(workspace, email, c.env.ADMIN_EMAIL);
	if (!authorized || (role !== "owner" && role !== "admin")) {
		return c.json({ error: "Only owners and admins can check rebuild status" }, 403);
	}

	const indexId = c.env.WORKSPACE_INDEX.idFromName(workspaceId);
	const index = c.env.WORKSPACE_INDEX.get(indexId);
	const result = await (index as any).rebuildStatus();

	return c.json(result);
});
