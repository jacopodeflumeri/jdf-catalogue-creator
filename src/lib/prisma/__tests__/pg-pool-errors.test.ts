/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the wiring test loads
 * client.ts inside jest.isolateModules() with the adapter mocked; ESM imports are
 * hoisted and cached and cannot express that. */

/**
 * The Prisma pg adapter's pool/connection errors are logged at error level
 * (prod runs LOG_LEVEL=error), with the code and message only — never the
 * connection string or credentials.
 */

import { EventEmitter } from "events";

const error = jest.fn();
jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: {
    error: (...args: unknown[]) => error(...args),
    warn: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  },
}));

import { PrismaPg } from "@prisma/adapter-pg";
import {
  formatPgPoolError,
  onConnectionError,
  onPoolError,
  pgAdapterErrorHooks,
} from "../pg-pool-errors";

const SECRET = "s3cr3t-password-do-not-log";
const URL_WITH_SECRET = `postgresql://app_user:${SECRET}@10.1.2.3:5432/app_prod`;

function pgError(message: string, code?: string): Error {
  return Object.assign(new Error(message), code ? { code } : {});
}

beforeEach(() => {
  error.mockClear();
  delete process.env.DB_PASSWORD;
});

describe("pg adapter error hooks", () => {
  it("logs an idle-client drop at error level with code and message", () => {
    onPoolError(pgError("terminating connection due to administrator command", "57P01"));
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]).toEqual([
      "[db] idle pool client dropped (57P01): terminating connection due to administrator command",
    ]);
  });

  it("logs a transaction connection error with its own context", () => {
    onConnectionError(pgError("Connection terminated unexpectedly"));
    expect(error.mock.calls[0]).toEqual([
      "[db] transaction connection error: Connection terminated unexpectedly",
    ]);
  });

  it("logs a single string, never the error object", () => {
    const err = Object.assign(pgError("boom", "08006"), {
      connectionString: URL_WITH_SECRET,
      client: { password: SECRET },
    });
    onPoolError(err);
    expect(error.mock.calls[0]).toHaveLength(1);
    expect(typeof error.mock.calls[0][0]).toBe("string");
    expect(JSON.stringify(error.mock.calls)).not.toContain(SECRET);
  });

  it("redacts credentials in a message, including the configured DB_PASSWORD", () => {
    process.env.DB_PASSWORD = SECRET;
    onPoolError(pgError(`could not connect to ${URL_WITH_SECRET}`));
    onPoolError(pgError(`password ${SECRET} rejected`, "28P01"));
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("app_user:");
    expect(logged).toContain("postgresql://***@10.1.2.3");
  });

  it("never throws, whatever it is given or if logging fails", () => {
    expect(() => onPoolError(undefined as never)).not.toThrow();
    expect(() => onPoolError({} as never)).not.toThrow();
    error.mockImplementationOnce(() => {
      throw new Error("logger broke");
    });
    expect(() => onPoolError(pgError("x"))).not.toThrow();
    expect(formatPgPoolError("ctx", "plain string")).toBe("[db] ctx: plain string");
  });
});

describe("wiring into the adapter", () => {
  it("client.ts passes both hooks as PrismaPg's second argument", () => {
    const savedUrl = process.env.DATABASE_URL;
    // client.ts needs a URL to build the adapter; nothing connects.
    process.env.DATABASE_URL ||= "postgresql://u:p@127.0.0.1:1/never_connected";
    jest.isolateModules(() => {
      const ctor = jest.fn();
      jest.doMock("@prisma/adapter-pg", () => ({ PrismaPg: ctor }));
      jest.doMock("@/generated/prisma/client", () => ({
        PrismaClient: class {
          $on() {}
        },
      }));
      require("../client");
      // The isolated registry's own copy of the hooks module.
      const hooks = require("../pg-pool-errors");
      expect(ctor).toHaveBeenCalledTimes(1);
      expect(ctor.mock.calls[0][1]).toBe(hooks.pgAdapterErrorHooks);
      expect(ctor.mock.calls[0][1]).toEqual({
        onPoolError: hooks.onPoolError,
        onConnectionError: hooks.onConnectionError,
      });
    });
    if (savedUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedUrl;
  });

  it("the real adapter's pool calls onPoolError when an idle client's error is re-emitted", async () => {
    const factory = new PrismaPg(
      { connectionString: "postgresql://u:p@127.0.0.1:1/never_connected" },
      pgAdapterErrorHooks,
    );
    const adapter = (await factory.connect()) as unknown as {
      client: EventEmitter;
      dispose(): Promise<void>;
    };
    // What pg-pool does when an idle client's connection dies.
    const drop = () =>
      adapter.client.emit("error", pgError("Connection terminated unexpectedly", "ECONNRESET"), new EventEmitter());
    expect(drop).not.toThrow();
    expect(error).toHaveBeenCalledWith(
      "[db] idle pool client dropped (ECONNRESET): Connection terminated unexpectedly",
    );
    await adapter.dispose();
  });
});
