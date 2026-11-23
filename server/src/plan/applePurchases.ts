// Collector bought through the App Store. The iPhone app hands over the
// signed transaction Apple gave it; it's checked here against Apple's root
// certificates, our app and our two products before the plan changes.
// Renewals, cancellations that run out, and refunds arrive later from Apple
// itself (App Store Server Notifications, version 2), signed the same way,
// and keep the plan in step. Nothing here trusts what the app says alone.
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";
import config from "../config/config.js";
import { prisma } from "../config/prisma.js";
import { APPLE_ROOTS } from "./appleRoots.js";

// the products sold (App Store Connect, the Collector subscription group)
export const COLLECTOR_PRODUCTS = new Set([
  "collector.monthly",
  "collector.yearly",
]);
// the App Store build's bundle ID
const BUNDLE_ID = "xyz.mangatracker.app";

const verifiers = new Map<Environment, SignedDataVerifier>();
function verifierFor(environment: Environment) {
  let found = verifiers.get(environment);
  if (!found) {
    found = new SignedDataVerifier(
      APPLE_ROOTS,
      true,
      environment,
      BUNDLE_ID,
      environment === Environment.PRODUCTION ? config.APPLE_APP_ID : undefined,
    );
    verifiers.set(environment, found);
  }
  return found;
}

// Apple's live store first; TestFlight and test purchases are signed for the
// sandbox. Null when neither vouches for it
async function appleDecoded<T>(
  check: (verifier: SignedDataVerifier) => Promise<T>,
): Promise<T | null> {
  const environments = config.APPLE_APP_ID
    ? [Environment.PRODUCTION, Environment.SANDBOX]
    : [Environment.SANDBOX];
  for (const environment of environments) {
    try {
      return await check(verifierFor(environment));
    } catch {
      // not this one
    }
  }
  return null;
}

// the signature checks, in one object so the tests can stand in for Apple
export const appleSignatures = {
  transaction: (signed: string) =>
    appleDecoded((v) => v.verifyAndDecodeTransaction(signed)),
  notification: (signed: string) =>
    appleDecoded((v) => v.verifyAndDecodeNotification(signed)),
  renewal: (signed: string) =>
    appleDecoded((v) => v.verifyAndDecodeRenewalInfo(signed)),
};

// what a transaction means for the plan: paid until when, or not ours
export function planFrom(t: JWSTransactionDecodedPayload) {
  if (!t.productId || !COLLECTOR_PRODUCTS.has(t.productId)) return null;
  if (t.bundleId !== BUNDLE_ID || !t.originalTransactionId) return null;
  // refunded: over now
  const until = t.revocationDate
    ? new Date(t.revocationDate)
    : t.expiresDate
      ? new Date(t.expiresDate)
      : null;
  if (!until) return null;
  return {
    subscription: t.originalTransactionId,
    until,
    product: t.productId,
  };
}
type Paid = NonNullable<ReturnType<typeof planFrom>>;

// the plan's new end, written to an account. The subscription follows the
// Apple ID that pays: restored on another of our accounts, it moves there
async function setPlan(userId: number, plan: Paid, renews?: boolean) {
  // whether it renews, when Apple didn't say: as it was for this
  // subscription (a restore keeps a cancelled one cancelled), or a new
  // purchase, which renews
  const known = await prisma.user.findUnique({
    where: { appleSubscription: plan.subscription },
    select: { planRenews: true },
  });
  const willRenew = renews ?? known?.planRenews ?? true;
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { appleSubscription: plan.subscription, id: { not: userId } },
      data: { appleSubscription: null, plan: "free", planUntil: null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        appleSubscription: plan.subscription,
        // an early member stays one: they never lose what they had
        planUntil: plan.until,
        appleProduct: plan.product,
        planRenews: willRenew,
      },
    }),
    // the day they first became a Collector, kept from then on
    prisma.user.updateMany({
      where: { id: userId, collectorSince: null },
      data: { collectorSince: new Date() },
    }),
    prisma.user.updateMany({
      where: { id: userId, plan: { not: "early" } },
      data: { plan: "collector" },
    }),
  ]);
}

// A purchase or a restore from the app. The plan's new end, or null when
// Apple doesn't vouch for it or it isn't Collector
export async function applyPurchase(userId: number, signed: string) {
  const transaction = await appleSignatures.transaction(signed);
  const plan = transaction && planFrom(transaction);
  if (!plan) return null;
  await setPlan(userId, plan);
  return plan.until;
}

// A notification from Apple: a renewal, an expiry, a refund. True when it
// was Apple's and about a Collector subscription we know
export async function applyNotification(signedPayload: string) {
  const notification = await appleSignatures.notification(signedPayload);
  const signedTransaction = notification?.data?.signedTransactionInfo;
  if (!signedTransaction) return false;
  // whether it will renew (turned off when they cancel), when Apple says
  const signedRenewal = notification?.data?.signedRenewalInfo;
  const renewal = signedRenewal
    ? await appleSignatures.renewal(signedRenewal)
    : null;
  const renews =
    renewal?.autoRenewStatus === undefined
      ? undefined
      : renewal.autoRenewStatus === 1;
  const transaction = await appleSignatures.transaction(signedTransaction);
  const plan = transaction && planFrom(transaction);
  if (!plan) return false;
  const user = await prisma.user.findUnique({
    where: { appleSubscription: plan.subscription },
    select: { id: true },
  });
  if (!user) return false;
  await setPlan(user.id, plan, renews);
  return true;
}

export const applePurchases = { applyPurchase, applyNotification };
