export const requestReasons: Record<string, string> = {
  damaged: "Damaged or leaking jar",
  incorrect: "Incorrect item received",
  missing: "Missing item",
  quality: "Product quality concern",
};
export const requestStatus: Record<string, string> = {
  requested: "Request submitted",
  reviewing: "Under review",
  approved: "Approved",
  return_in_transit: "Return in transit",
  received: "Return received",
  refund_pending: "Refund pending",
  resolved: "Resolved",
  rejected: "Request declined",
};
export function requestTransitions(kind: string, status: string): string[] {
  return (
    (
      {
        requested: ["reviewing", "approved", "rejected"],
        reviewing: ["approved", "rejected"],
        approved:
          kind === "return"
            ? ["return_in_transit", "received", "resolved"]
            : ["refund_pending", "resolved"],
        return_in_transit: ["received"],
        received: ["refund_pending", "resolved"],
        refund_pending: ["resolved"],
      } as Record<string, string[]>
    )[status] || []
  );
}
