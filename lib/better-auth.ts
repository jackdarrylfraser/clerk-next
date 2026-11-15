import "server-only";
import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import {
  account,
  session,
  user,
  verification,
} from "../db/schema";
import { sendEmail } from "../emails/send-email";
import { env } from "../env";
import { getDb } from "./drizzle";
import { leadEmailOTP } from "./lead/lead-email-otp-plugin";

export const auth = betterAuth({
  appName: "Outbound Endurance",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "sqlite",
    schema: { user, session, account, verification },
  }),
  plugins: [
    leadEmailOTP(),
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        const verificationCode = escapeHtml(otp);
        const codeLabel = type === "sign-in" ? "sign-in" : "verification";
        const idempotencyHash = createHash("sha256")
          .update(`${email.trim().toLowerCase()}\0${type}\0${otp}`)
          .digest("hex");

        await sendEmail({
          idempotencyKey: `better-auth/otp/${idempotencyHash}`,
          to: email,
          content: {
            subject: `Your ${codeLabel} code`,
            text: `Your ${codeLabel} code is ${otp}. It expires in 5 minutes.`,
            html: `<p>Your ${codeLabel} code is <strong>${verificationCode}</strong>.</p><p>It expires in 5 minutes.</p>`,
          },
        });
      },
    }),
  ],
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
