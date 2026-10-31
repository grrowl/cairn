import assert from "node:assert/strict";
import { test } from "node:test";
import { legacyRedirect } from "../src/canonical-url.ts";
import { checkMembership } from "../src/workspaces/membership.ts";

test("the old homepage permanently redirects to the new domain", () => {
	const response = legacyRedirect("https://cairn.place/");
	assert.equal(response.status, 308);
	assert.equal(response.headers.get("Location"), "https://cairn.chillidonut.com/");
});

test("MCP paths and query parameters survive the move", () => {
	const response = legacyRedirect("https://cairn.place/private/mcp?session=abc%2Fdef");
	assert.equal(response.headers.get("Location"), "https://cairn.chillidonut.com/private/mcp?session=abc%2Fdef");
});

test("protocol-relative paths cannot turn the redirect into an open redirect", () => {
	const response = legacyRedirect("https://cairn.place//evil.test/path");
	assert.equal(new URL(response.headers.get("Location")).hostname, "cairn.chillidonut.com");
});

test("the new domain and local development do not redirect", () => {
	assert.equal(legacyRedirect("https://cairn.chillidonut.com/"), undefined);
	assert.equal(legacyRedirect("http://localhost:8788/"), undefined);
});

test("the new private workspace allows its owner and excludes other signed-in users", () => {
	const workspace = { members: [{ email: "tom@chillidonut.com", role: "owner" }] };
	assert.deepEqual(checkMembership(workspace, "tom@chillidonut.com"), { authorized: true, role: "owner" });
	for (const email of ["other@chillidonut.com", "other@gmail.com", ""]) {
		assert.deepEqual(checkMembership(workspace, email), { authorized: false, role: null });
	}
});
