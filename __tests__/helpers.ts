import fs from "fs";
import path from "path";

const FIXTURES_DIR = path.join(__dirname, "fixtures", "sources");

export function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

export type Route = {
  match: RegExp;
  content: string;
  status?: number;
  headers?: Record<string, string>;
};

export function mockFetchWith(routes: Route[]) {
  return jest.spyOn(global, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);

    for (const route of routes) {
      if (route.match.test(url)) {
        return new Response(route.content, {
          status: route.status ?? 200,
          headers: route.headers,
        });
      }
    }

    return new Response("", { status: 200 });
  });
}

export const EMPTY_HTML = "<html><body></body></html>";