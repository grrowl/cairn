export const CAIRN_ORIGIN = "https://cairn.chillidonut.com";

export function legacyRedirect(requestUrl: string): Response | undefined {
	const url = new URL(requestUrl);
	if (url.hostname !== "cairn.place") return;
	const destination = new URL(CAIRN_ORIGIN);
	destination.pathname = url.pathname;
	destination.search = url.search;
	return Response.redirect(destination.href, 308);
}
