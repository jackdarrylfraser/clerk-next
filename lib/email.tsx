import { env } from "@/env";
import { Resend } from "resend";

type SubscriptionCreatedEmail = {
  subscriptionId: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

function SubscriptionCreatedTemplate({
  name,
  accountUrl,
}: {
  name: string;
  accountUrl: string;
}) {
  return (
    <>
      <p>Hi {name},</p>
      <p>Your membership subscription has been created.</p>
      <p>
        <a href={accountUrl}>Manage your membership</a>
      </p>
    </>
  );
}

export async function sendSubscriptionCreatedEmail({
  subscriptionId,
  email,
  firstName,
  lastName,
}: SubscriptionCreatedEmail): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY);
  const from = env.RESEND_FROM_EMAIL;
  const accountUrl = new URL("/account", env.APP_URL);

  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "there";
  const { error } = await resend.emails.send(
    {
      from,
      to: email,
      subject: "Your membership subscription is ready",
      react: (
        <SubscriptionCreatedTemplate
          name={name}
          accountUrl={accountUrl.toString()}
        />
      ),
      text: `Hi ${name},\n\nYour membership subscription has been created.\n\nManage your membership: ${accountUrl.toString()}`,
    },
    { idempotencyKey: `clerk-subscription-created-${subscriptionId}` },
  );

  if (error) {
    throw new Error(`Resend could not send the subscription email: ${error.message}`);
  }
}
