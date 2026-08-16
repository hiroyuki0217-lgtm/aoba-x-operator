import { acknowledgeSheetHandoff, batchRequestsForHandoff, pendingSheetHandoffs } from "./x-api.mjs";

const [, , command = "list", argument] = process.argv;

if (command === "list") {
  const pending = await pendingSheetHandoffs();
  console.log(JSON.stringify({ pending_count: pending.length, pending: pending.map((item) => ({ ...item, batch_requests: batchRequestsForHandoff(item) })) }, null, 2));
} else if (command === "ack") {
  if (!argument) throw new Error("ackにはhandoff_idが必要です。");
  const record = await acknowledgeSheetHandoff(argument, { verified_by: "google_sheets_readback" });
  console.log(JSON.stringify({ acknowledged: record.handoff_id }, null, 2));
} else {
  throw new Error("使える操作は list または ack です。");
}
