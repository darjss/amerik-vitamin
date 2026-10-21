import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { Authenticated, CurrentUser, Unauthorized } from "@amerik/contracts";
import { authTables, promiseDatabase } from "@amerik/db";
import { betterAuth } from "better-auth";
import * as Config from "effect/Config";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { HttpBody, HttpServerRequest, HttpServerResponse } from "effect/http";

import { webOrigin } from "../infra/stage";

/**
 * Read in the Worker's Init. Alchemy binds each of these Config reads into
 * the deployed Worker as a secret, so a missing one fails the deploy.
 * `DASHBOARD_EMAILS` is the allowlist: comma-separated Google emails, every
 * one an admin (GLOSSARY), no roles.
 */
const authConfig = Config.all({
  secret: Config.Redacted("BETTER_AUTH_SECRET"),
  googleClientId: Config.String("GOOGLE_CLIENT_ID"),
  googleClientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET"),
  admins: Config.Array(Schema.Trim, "DASHBOARD_EMAILS").pipe(
    Config.map((emails) => new Set(emails.map((email) => email.toLowerCase()))),
  ),
});

export const authSettings = Effect.gen(function* authSettings() {
  return { ...(yield* authConfig), baseURL: yield* webOrigin };
});

type AuthSettings = Effect.Success<typeof authSettings>;

const DAY = 60 * 60 * 24;

const isAdmin = (settings: AuthSettings, user: { email: string; emailVerified: boolean }) =>
  user.emailVerified && settings.admins.has(user.email.toLowerCase());

/**
 * better-auth rejected with something other than an API error: a database
 * fault or a bug. Only the error's name is kept, because a drizzle error
 * carries every bound value (session tokens, PKCE verifiers) in its message.
 */
class AuthFault extends Data.TaggedError("AuthFault")<{ readonly error: string }> {}

/** The Promise edge into better-auth: a rejection dies as an `AuthFault`. */
const nativeCall = <A>(call: () => Promise<A>) =>
  Effect.tryPromise({
    try: call,
    catch: (error) => new AuthFault({ error: error instanceof Error ? error.name : "unknown" }),
  }).pipe(Effect.orDie);

const logAt = {
  debug: Effect.logDebug,
  info: Effect.logInfo,
  warn: Effect.logWarning,
  error: Effect.logError,
};

/**
 * One better-auth instance per request, over that request's `Database`:
 * the connection is opened for the request and closes with it (STRUCTURE.md),
 * so nothing request-bound outlives it in an isolate-wide instance.
 */
const makeAuth = Effect.fn("Auth.make")(function* makeAuth(settings: AuthSettings) {
  const database = yield* promiseDatabase;
  const runSync = Effect.runSyncWith(yield* Effect.context<never>());

  return betterAuth({
    appName: "Amerik Vitamin",
    baseURL: settings.baseURL,
    basePath: "/api/auth",
    secret: Redacted.value(settings.secret),
    trustedOrigins: [settings.baseURL],
    database: drizzleAdapter(database, { provider: "pg", schema: authTables, usePlural: true }),
    socialProviders: {
      google: {
        clientId: settings.googleClientId,
        clientSecret: Redacted.value(settings.googleClientSecret),
        prompt: "select_account",
      },
    },
    // Mom signs in once on her phone. A visit after a day pushes expiry out again.
    session: { expiresIn: 90 * DAY, updateAge: DAY },
    account: { encryptOAuthTokens: true },
    // Made here, not by a column default. "uuid" would leave it to Postgres.
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    telemetry: { enabled: false },
    // Faults reject instead of being logged with their bound values; see AuthFault.
    onAPIError: { throw: true },
    // The message and error names only: better-auth passes errors and
    // where-clauses, values included, as args.
    logger: {
      log: (level, message, ...args) =>
        runSync(
          logAt[level](`better-auth: ${message}`, {
            errors: args.filter((arg) => arg instanceof Error).map((error) => error.name),
          }),
        ),
    },
    // The allowlist gate. A Google account off the list gets no user row. One
    // taken off the list later still signs in, but every rpc answers
    // Unauthorized (AuthenticatedLive).
    databaseHooks: {
      user: { create: { before: async (user) => isAdmin(settings, user) } },
    },
  });
});

/**
 * `/api/auth/*`, forwarded by the web Worker so the cookie lands on the web
 * origin. better-auth answers API errors and redirects as responses and
 * rejects only on a fault.
 */
export const authRoute = Effect.fn("Auth.route")(function* authRoute(settings: AuthSettings) {
  const request = yield* HttpServerRequest.toWeb(yield* HttpServerRequest.HttpServerRequest).pipe(
    Effect.orDie,
  );

  const auth = yield* makeAuth(settings);
  const response = yield* nativeCall(() => auth.handler(request));
  // Buffered: a streamed body's last byte would wait for the request's
  // cleanup, which closes the database connection (executor, auth.ts).
  const body = new Uint8Array(yield* nativeCall(() => response.arrayBuffer()));

  return HttpServerResponse.fromWeb(response).pipe(
    HttpServerResponse.setBody(
      HttpBody.uint8Array(body, response.headers.get("content-type") ?? undefined),
    ),
    HttpServerResponse.setHeader("cache-control", "no-store"),
  );
});

/**
 * The session cookie as a `CurrentUser`, checked against the allowlist on
 * every call so removing an email locks it out at once. The lookup never
 * refreshes the session: an rpc response can't carry the new cookie, so
 * the browser's own `/api/auth/get-session` call does that.
 */
export const AuthenticatedLive = (settings: AuthSettings) =>
  Layer.effect(
    Authenticated,
    Effect.gen(function* authenticated() {
      const auth = yield* makeAuth(settings);

      return Authenticated.of(
        Effect.fn("Authenticated")(function* authenticate(effect, { headers }) {
          const found = yield* nativeCall(() =>
            auth.api.getSession({
              headers: new Headers(headers),
              query: { disableRefresh: true, disableCookieCache: true },
            }),
          );

          if (found === null || !isAdmin(settings, found.user)) return yield* new Unauthorized();

          return yield* Effect.provideService(effect, CurrentUser, {
            email: found.user.email.toLowerCase(),
          });
        }),
      );
    }),
  );
