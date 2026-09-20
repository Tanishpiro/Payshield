export type NarrationRequest = {
  event: "preview" | "result" | "complete";
  amount?: number;
  receiver?: string;
  score?: number;
  synthetic?: boolean;
  reasonCodes?: string[];
  requestApproval?: boolean;
};

const explanations: Record<string, string> = {
  AGE_VERY_NEW: "The receiver account is newly created.",
  AGE_NEW: "The receiver account was opened recently.",
  KYC_NONE: "The receiver has not completed identity verification.",
  KYC_PARTIAL: "The receiver has only partially verified their identity.",
  VEL_EXTREME: "The receiver has unusually high incoming payment activity.",
  VEL_HIGH: "The receiver has high incoming payment activity.",
  VEL_SPIKE: "Payment activity has suddenly increased.",
  VEL_SENDERS: "Many different senders have paid this new receiver.",
  BEH_AMOUNT: "The payment is much larger than this receiver's usual payments.",
  BEH_HIGH_NEW: "This is a large payment to a new receiver.",
  SIG_CONFIRMED: "Confirmed fraud signals are associated with the receiver.",
  SIG_REPORTS: "There are unconfirmed complaints about the receiver.",
  DEV_RISK: "Device or network risk signals were detected.",
  DEV_SHARED: "A device is shared by multiple receiver accounts.",
  NET_CLUSTER: "The receiver is connected to a suspected fraud network.",
  NET_LINK: "The receiver has a connection to a flagged account.",
  UNKNOWN: "There is not enough information about this receiver.",
  NO_HISTORY: "No transaction history is available.",
};

/** Fixed templates: narration cannot choose an action or override the risk policy. */
export function buildNarration(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid voice request.");
  const body = value as Record<string, unknown>;
  if (body.event === "preview") return "Hello, I am your PayShield voice guide, powered by ElevenLabs. I explain payment risk. Confirm payments using your face or fingerprint.";
  if (body.event !== "result" && body.event !== "complete") throw new Error("Unsupported voice event.");
  if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount < 1 || body.amount > 200000)
    throw new Error("Invalid payment amount.");
  if (typeof body.score !== "number" || !Number.isInteger(body.score) || body.score < 0 || body.score > 100)
    throw new Error("Invalid risk score.");
  if (typeof body.synthetic !== "boolean") throw new Error("Missing payment mode.");
  if (body.requestApproval !== undefined && typeof body.requestApproval !== "boolean") throw new Error("Invalid approval mode.");
  if (typeof body.receiver !== "string" || body.receiver.length > 80) throw new Error("Invalid receiver name.");
  if (body.reasonCodes !== undefined && (!Array.isArray(body.reasonCodes) || body.reasonCodes.length > 8 || body.reasonCodes.some(x => typeof x !== "string" || x.length > 50)))
    throw new Error("Invalid risk reasons.");
  const receiver = body.receiver.replace(/[^\p{L}\p{N} .'-]/gu, "").trim() || "the receiver";
  const amount = body.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  // Never announce completion or verification for a blocked score, even with a forged event.
  if (body.score > 90) return `Payment blocked. The risk score for ${receiver} is ${body.score} out of 100. PayShield will not continue this payment.`;
  if (body.event === "complete") return body.synthetic
    ? "Demo payment successful. No real money was transferred."
    : `The payment request for ${amount} rupees has been handed to your UPI app. Complete authorization there and check your bank's confirmation. PayShield has not confirmed a transfer.`;
  if (body.requestApproval) return `OK. Their risk score is ${body.score} out of 100. Say approve to approve the payment, or say cancel to cancel it.`;
  const level = body.score <= 30 ? "low" : body.score <= 70 ? "medium" : "high";
  const reason = (body.reasonCodes as string[] | undefined)?.map(code => explanations[code]).find(Boolean) ?? "";
  return [
    body.synthetic ? "This is a prototype payment with a fixed demo score. No real funds will move." : "",
    `You are paying ${amount} rupees to ${receiver}. The risk score is ${body.score} out of 100, which is ${level} risk.`,
    body.synthetic ? "" : reason,
    body.score > 30 ? "Review the warning before continuing." : "",
    body.requestApproval ? "Say approve to continue with fingerprint or strong face verification, or say cancel to stop." : "",
    "If you choose to continue, confirm with your strong face or fingerprint.",
  ].filter(Boolean).join(" ");
}
