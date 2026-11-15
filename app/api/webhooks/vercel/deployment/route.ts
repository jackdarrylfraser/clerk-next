import { z } from "zod";
import type Stripe from "stripe";
import { env } from "@/env";
import {
  getManagedPriceIdsToDeactivate,
  isProductionDeploymentPromotion,
} from "@/lib/stripe-catalog-policy";
import { readBuiltStripeCatalog } from "@/lib/stripe-catalog";
import { stripe } from "@/lib/stripe";
import { verifyVercelWebhookSignature } from "@/lib/vercel-webhook-signature";

const vercelEventSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  payload: z.object({
    target: z.string().nullable().optional(),
    deployment: z
      .object({ target: z.string().nullable().optional() })
      .optional(),
    project: z.object({ id: z.string().min(1) }),
  }),
});

export async function POST(request: Request): Promise<Response> {
  if (!env.VERCEL_WEBHOOK_SECRET || !env.VERCEL_WEBHOOK_PROJECT_ID) {
    console.error("Vercel deployment webhook is not configured");
    return Response.json(
      { error: "Deployment cleanup is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  if (
    !verifyVercelWebhookSignature(
      rawBody,
      request.headers.get("x-vercel-signature"),
      env.VERCEL_WEBHOOK_SECRET,
    )
  ) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const event = vercelEventSchema.safeParse(body);
  if (!event.success) {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const target =
    event.data.payload.target ??
    event.data.payload.deployment?.target ??
    null;
  if (
    !isProductionDeploymentPromotion(
      {
        type: event.data.type,
        target,
        projectId: event.data.payload.project.id,
      },
      env.VERCEL_WEBHOOK_PROJECT_ID,
    )
  ) {
    return Response.json({ received: true, ignored: true });
  }

  try {
    const catalog = await readBuiltStripeCatalog();
    if (!catalog) {
      throw new Error("The generated Stripe catalog is missing from this deployment");
    }

    const currentPrice = await stripe.prices.retrieve(catalog.priceId);
    if (
      typeof currentPrice.product === "string"
        ? currentPrice.product !== catalog.productId
        : currentPrice.product.id !== catalog.productId
    ) {
      throw new Error("The current Stripe Price does not belong to the catalog Product");
    }
    if (!currentPrice.active) {
      await stripe.prices.update(currentPrice.id, { active: true });
    }

    await stripe.products.update(catalog.productId, {
      default_price: catalog.priceId,
    });

    const activePrices: Stripe.Price[] = [];
    for await (const price of stripe.prices.list({
      product: catalog.productId,
      active: true,
      limit: 100,
    })) {
      activePrices.push(price);
    }

    const oldPriceIds = getManagedPriceIdsToDeactivate(
      activePrices,
      catalog.priceId,
    );
    for (const priceId of oldPriceIds) {
      await stripe.prices.update(priceId, { active: false });
    }

    return Response.json({
      received: true,
      deactivatedPrices: oldPriceIds.length,
    });
  } catch (error) {
    console.error("Could not deactivate superseded Stripe Prices", error);
    return Response.json(
      { error: "Stripe catalog cleanup failed." },
      { status: 502 },
    );
  }
}
