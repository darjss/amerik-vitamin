import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { Authenticated, CurrentUser, Unauthorized } from "@amerik/contracts";
import { authTables, promiseDatabase } from "@amerik/db";
import { betterAuth } from "better-auth";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { HttpBody, HttpServerRequest, HttpServerResponse } from "effect/http";

/**
 * Read in the Worker's Init. Alchemy binds each of these Config reads into
 * the deployed Worker as a secret, so a missing one fails the deploy.
 * `DASHBOARD_EMAILS` is the allowlist: comma-separated Google emails, every
 * one an admin (GLOSSARY), no roles.
 */
export const authConfig = Config.all({
  secret: Config.Redacted("BETTER_AUTH_SECRET"),
  googleClientId: Config.String("GOOGLE_CLIENT_ID"),
  googleClientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET"),
  admins: Config.String("DASHBOARD_EMAILS").pipe(
    Config.map(
      (list) =>
        new Set(
          list
            .split(",")
            .map((email) => email.trim().toLowerCase())
            .filter((email) => email.length > 0),
        ),
    ),
  ),
});

export type AuthSettings = Config.Success<typeof authConfig> & { readonly baseURL: string };

const DAY = 60 * 60 * 24;

const isAdmin = (settings: AuthSettings, user: { email: string; emailVerified: boolean }) =>
  user.emailVerified && settings.admins.has(user.email.toLowerCase());

/**
 * One better-auth instance per request, over that request's `Database`:
 * the connection is opened for the request and closes with it (STRUCTURE.md),
 * so nothing request-bound outlives it in an isolate-wide instance.
 */
const makeAuth = Effect.fn("Auth.make")(function* makeAuth(settings: AuthSettings) {
  const database = yield* promiseDatabase;

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
    advanced: { database: { generateId: "uuid" } },
    telemetry: { enabled: false },
    // The allowlist gate. A Google account off the list gets no user row and no
    // session; one taken off the list later gets no new session.
    databaseHooks: {
      user: { create: { before: async (user) => isAdmin(settings, user) } },
      session: {
        create: {
          before: async (session, context) => {
            const user = await context?.context.internalAdapter.findUserById(session.userId);

            return user !== null && user !== undefined && isAdmin(settings, user);
          },
        },
      },
    },
  });
});

/**
 * `/api/auth/*`, forwarded by the web Worker so the cookie lands on the web
 * origin. better-auth answers its own errors as responses and rejects only
 * on a fault, so a rejection is a defect.
 */
export const authRoute = (settings: AuthSettings) =>
  Effect.gen(function* authRoute() {
    const request = yield* HttpServerRequest.toWeb(yield* HttpServerRequest.HttpServerRequest).pipe(
      Effect.orDie,
    );

    const auth = yield* makeAuth(settings);
    const response = yield* Effect.promise(() => auth.handler(request));
    // Buffered: a streamed body's last byte would wait for the request's
    // cleanup, which closes the database connection (executor, auth.ts).
    const body = new Uint8Array(yield* Effect.promise(() => response.arrayBuffer()));

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
          const found = yield* Effect.promise(() =>
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
