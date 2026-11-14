import { env } from "@/env";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

interface SendEmailOptions {
  idempotencyKey: string;
  to: string;
  content: {
    subject: string;
    text: string;
    html: string;
  };
}

export async function sendEmail({
  idempotencyKey,
  to,
  content,
}: SendEmailOptions): Promise<void> {
  const from = env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is required to send emails");
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: to.trim(),
      ...content,
    },
    {
      idempotencyKey,
    },
  );

  if (error) {
    throw new Error(`Resend could not send email: ${error.message}`);
  }

  if (!data) {
    throw new Error("Resend did not confirm the email");
  }
}
