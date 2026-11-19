// web-push 4 ships no types: the parts the app uses (src/push/pushSender.ts),
// as its README describes them
declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  export type SendResult = {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  };
  export class WebPushError extends Error {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    endpoint: string;
  }
  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void;
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string,
    options?: {
      TTL?: number;
      urgency?: string;
      topic?: string;
      timeout?: number;
    },
  ): Promise<SendResult>;
  export function generateVAPIDKeys(): {
    publicKey: string;
    privateKey: string;
  };
}
