import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
} from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import { lead, leadVerification } from "@/db/schema";
import { sendEmail } from "@/emails/send-email";
import { env } from "@/env";
import { getDb } from "@/lib/drizzle";
import {
  createLeadAccessToken,
  leadAccessCookieName,
} from "@/lib/lead/lead-access-token";

const codeLength = 6;
const codeLifetimeMs = 5 * 60 * 1000;
const accessLifetimeSeconds = 30 * 24 * 60 * 60;
const resendCooldownMs = 60 * 1000;
const maxCodeAttempts = 5;

const emailBody = z.object({
  email: z.string().trim().email().max(254),
});

const verifyBody = emailBody.extend({
  otp: z.string().regex(/^\d{6}$/),
});

export function leadEmailOTP() {
  return {
    id: "lead-email-otp",
    endpoints: {
      sendLeadEmailOTP: createAuthEndpoint(
        "/lead-email-otp/send",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
          body: emailBody,
        },
        async (ctx) => {
          const email = normalizeEmail(ctx.body.email);
          const database = getDb();
          const now = new Date();
          await database
            .delete(leadVerification)
            .where(lt(leadVerification.expiresAt, now));
          const [current] = await database
            .select({
              lastSentAt: leadVerification.lastSentAt,
            })
            .from(leadVerification)
            .where(eq(leadVerification.email, email))
            .limit(1);

          if (
            current &&
            Date.now() - current.lastSentAt.getTime() < resendCooldownMs
          ) {
            return ctx.json({ success: true });
          }

          const otp = randomInt(0, 10 ** codeLength)
            .toString()
            .padStart(codeLength, "0");
          const codeHash = hashCode(email, otp);

          await database
            .insert(leadVerification)
            .values({
              email,
              codeHash,
              expiresAt: new Date(now.getTime() + codeLifetimeMs),
              attempts: 0,
              lastSentAt: now,
            })
            .onConflictDoUpdate({
              target: leadVerification.email,
              set: {
                codeHash,
                expiresAt: new Date(now.getTime() + codeLifetimeMs),
                attempts: 0,
                lastSentAt: now,
              },
            });

          try {
            await sendEmail({
              idempotencyKey: `better-auth/lead-otp/${hashCode(email, otp)}`,
              to: email,
              content: {
                subject: "Your guest access code",
                text: `Your guest access code is ${otp}. It expires in 5 minutes.`,
                html: `<p>Your guest access code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
              },
            });
          } catch (error) {
            await database
              .delete(leadVerification)
              .where(
                and(
                  eq(leadVerification.email, email),
                  eq(leadVerification.codeHash, codeHash),
                ),
              );
            throw error;
          }

          return ctx.json({ success: true });
        },
      ),
      verifyLeadEmailOTP: createAuthEndpoint(
        "/lead-email-otp/verify",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
          body: verifyBody,
        },
        async (ctx) => {
          const email = normalizeEmail(ctx.body.email);
          const now = new Date();
          const codeHash = hashCode(email, ctx.body.otp);
          const verifiedLead = await getDb().transaction(async (transaction) => {
            const [challenge] = await transaction
              .select()
              .from(leadVerification)
              .where(eq(leadVerification.email, email))
              .limit(1);

            if (
              !challenge ||
              challenge.attempts >= maxCodeAttempts
            ) {
              return null;
            }

            if (challenge.expiresAt <= now) {
              await transaction
                .delete(leadVerification)
                .where(eq(leadVerification.email, email));
              return null;
            }

            if (!safeHashMatches(challenge.codeHash, codeHash)) {
              await transaction
                .update(leadVerification)
                .set({ attempts: sql`${leadVerification.attempts} + 1` })
                .where(
                  and(
                    eq(leadVerification.email, email),
                    eq(leadVerification.codeHash, challenge.codeHash),
                    lt(leadVerification.attempts, maxCodeAttempts),
                    gt(leadVerification.expiresAt, now),
                  ),
                );
              return null;
            }

            const consumed = await transaction
              .delete(leadVerification)
              .where(
                and(
                  eq(leadVerification.email, email),
                  eq(leadVerification.codeHash, challenge.codeHash),
                  gt(leadVerification.expiresAt, now),
                  lt(leadVerification.attempts, maxCodeAttempts),
                ),
              )
              .returning({ email: leadVerification.email });

            if (consumed.length === 0) {
              return null;
            }

            const [savedLead] = await transaction
              .insert(lead)
              .values({
                id: randomUUID(),
                email,
                verifiedAt: now,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: lead.email,
                set: { verifiedAt: now, updatedAt: now },
              })
              .returning({ id: lead.id });

            return savedLead ?? null;
          });

          if (!verifiedLead) {
            throw APIError.from("BAD_REQUEST", {
              message: "Invalid or expired verification code",
              code: "INVALID_OR_EXPIRED_LEAD_OTP",
            });
          }

          const expiresAt = now.getTime() + accessLifetimeSeconds * 1000;
          const accessToken = createLeadAccessToken({
            leadId: verifiedLead.id,
            expiresAt,
          }, env.BETTER_AUTH_SECRET);
          const cookie = ctx.context.createAuthCookie(leadAccessCookieName, {
            maxAge: accessLifetimeSeconds,
          });
          ctx.setCookie(cookie.name, accessToken, cookie.attributes);

          return ctx.json({ success: true });
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path) => path === "/lead-email-otp/send",
        window: 60,
        max: 3,
      },
      {
        pathMatcher: (path) => path === "/lead-email-otp/verify",
        window: 60,
        max: 10,
      },
    ],
  } satisfies BetterAuthPlugin;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashCode(email: string, otp: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`lead-email-otp-v1\0${email}\0${otp}`)
    .digest("hex");
}

function safeHashMatches(storedHash: string, suppliedHash: string): boolean {
  const stored = Buffer.from(storedHash, "hex");
  const supplied = Buffer.from(suppliedHash, "hex");
  return stored.length === supplied.length && timingSafeEqual(stored, supplied);
}
