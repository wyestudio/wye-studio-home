import type { ApplicationStatus, PaymentStatus } from "@/types/domain";

export type LifecycleStatus = "applied" | "awaiting_payment" | "paid" | "confirmed_soon" | "attended" | "cancelled";

export const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  applied: "신청 완료",
  awaiting_payment: "입금확인 전",
  paid: "입금완료",
  confirmed_soon: "참가확정",
  attended: "참여완료",
  cancelled: "취소됨",
};

export const LIFECYCLE_TONE: Record<LifecycleStatus, "wait" | "confirm" | "danger" | "neutral"> = {
  applied: "wait",
  awaiting_payment: "wait",
  paid: "confirm",
  confirmed_soon: "confirm",
  attended: "neutral",
  cancelled: "danger",
};

export function deriveLifecycleStatus(params: {
  status: ApplicationStatus;
  paymentStatus: PaymentStatus;
  startAt: string;
  endAt: string | null;
  now?: Date;
}): LifecycleStatus {
  const { status, paymentStatus, startAt, endAt, now = new Date() } = params;

  if (status === "cancelled" || paymentStatus === "cancelled") return "cancelled";
  if (status === "waiting") return "applied";
  if (paymentStatus === "pending") return "awaiting_payment";

  const eventEnd = new Date(endAt ?? startAt);
  if (now >= eventEnd) return "attended";

  const dayBefore = new Date(new Date(startAt).getTime() - 24 * 60 * 60 * 1000);
  if (now >= dayBefore) return "confirmed_soon";

  return "paid";
}
