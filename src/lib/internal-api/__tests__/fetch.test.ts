/** @jest-environment node */

jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), log: jest.fn(), debug: jest.fn() },
}));

import { internalApiFetch } from "../fetch";
import { clearInternalApiTokenCache } from "../oauth";

const oauth = {
  tokenUrl: "https://idp.example.com/token",
  clientId: "test-client-id",
  clientSecret: "test-secret",
};
const API_URL = "https://api.example.com/x";
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  clearInternalApiTokenCache();
});
afterAll(() => {
  global.fetch = originalFetch;
});

function tokenResp(token: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve({ access_token: token, expires_in: 3600, token_type: "Bearer" }),
    text: () => Promise.resolve(""),
  };
}
function apiResp(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("body"),
  };
}

it("attaches a Bearer token and returns the response", async () => {
  const m = jest.fn().mockResolvedValueOnce(tokenResp("tok-1")).mockResolvedValueOnce(apiResp(200));
  global.fetch = m as unknown as typeof fetch;

  const res = await internalApiFetch(API_URL, oauth, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  expect(res.status).toBe(200);
  // call 0 = token request, call 1 = API request with the Bearer token
  expect(m.mock.calls[1][0]).toBe(API_URL);
  expect(m.mock.calls[1][1].headers.Authorization).toBe("Bearer tok-1");
});

it("clears the cache and retries once on 401, using a fresh token", async () => {
  const m = jest
    .fn()
    .mockResolvedValueOnce(tokenResp("stale"))
    .mockResolvedValueOnce(apiResp(401))
    .mockResolvedValueOnce(tokenResp("fresh"))
    .mockResolvedValueOnce(apiResp(200));
  global.fetch = m as unknown as typeof fetch;

  const res = await internalApiFetch(API_URL, oauth);

  expect(res.status).toBe(200);
  expect(m).toHaveBeenCalledTimes(4);
  expect(m.mock.calls[3][1].headers.Authorization).toBe("Bearer fresh");
});

it("does not retry on non-401 errors", async () => {
  const m = jest.fn().mockResolvedValueOnce(tokenResp("tok-1")).mockResolvedValueOnce(apiResp(500));
  global.fetch = m as unknown as typeof fetch;

  const res = await internalApiFetch(API_URL, oauth);

  expect(res.status).toBe(500);
  expect(m).toHaveBeenCalledTimes(2);
});
