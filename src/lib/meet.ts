/**
 * Generate a fresh Google Meet room link. meet.new always redirects a logged-in
 * Google user to a new meeting. Anyone clicking this link joins the same room.
 */
export const NEW_MEET_URL = "https://meet.new";

/** Marker used inside chat messages so we can render a "Join call" card. */
export const MEET_PREFIX = "::meet::";
export const makeMeetMessage = () => MEET_PREFIX + NEW_MEET_URL;
export const isMeetMessage = (t: string | null | undefined) => !!t && t.startsWith(MEET_PREFIX);
export const decodeMeetUrl = (t: string) => t.slice(MEET_PREFIX.length);
