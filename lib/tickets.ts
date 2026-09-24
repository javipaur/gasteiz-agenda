export const TICKET_SOURCES = new Set([
  "jimmy-jazz-gasteiz",
  "jimmyjazz",
  "musikaze",
  "fever",
  "vam",
]);

export function isTicketSource(source?: string): boolean {
  return !!source && TICKET_SOURCES.has(source);
}