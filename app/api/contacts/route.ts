import { Resend } from "resend";
import { z } from "zod";
import { env } from "@/env";

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Enter your first name, last name, and a valid email address." },
      { status: 400 },
    );
  }

  const resend = new Resend(env.RESEND_API_KEY);
  let result: Awaited<ReturnType<typeof resend.contacts.create>>;

  try {
    result = await resend.contacts.create({
      email: parsed.data.email.toLowerCase(),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
  } catch (error) {
    console.error("Resend contact creation request failed", error);
    return Response.json(
      { error: "We couldn't save your contact. Please try again." },
      { status: 502 },
    );
  }

  if (result.error) {
    if (result.error.statusCode === 409) {
      return Response.json(
        { error: "This email address is already a contact." },
        { status: 409 },
      );
    }

    console.error("Resend contact creation failed", {
      name: result.error.name,
      statusCode: result.error.statusCode,
    });
    return Response.json(
      { error: "We couldn't save your contact. Please try again." },
      { status: 502 },
    );
  }

  if (!result.data) {
    console.error("Resend contact creation returned no contact data");
    return Response.json(
      { error: "We couldn't confirm your contact was saved. Please try again." },
      { status: 502 },
    );
  }

  return Response.json({ success: true }, { status: 201 });
}
