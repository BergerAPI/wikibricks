import type { ReviewVersionRequest } from "../../shared/contracts";
import { sendJson } from "../http";

export default function initialize(root: HTMLElement) {
  const page = root.querySelector<HTMLElement>("[data-review-url]");
  if (!page) return;
  const { reviewUrl, rejectReason } = page.dataset;
  const message = page.querySelector<HTMLInputElement>("#review_message");
  const approve = page.querySelector<HTMLButtonElement>("#approve");
  const reject = page.querySelector<HTMLButtonElement>("#reject");
  if (!reviewUrl || !rejectReason || !message || !approve || !reject) return;

  // A stale proposal can only be rejected, so its approve button starts out disabled
  const approvable = !approve.disabled;

  const review = async (type: ReviewVersionRequest["type"]) => {
    message.setCustomValidity(type === "rejected" && !message.value.trim() ? rejectReason : "");
    if (!message.reportValidity()) return;

    approve.disabled = reject.disabled = true;
    try {
      await sendJson(reviewUrl, { type, reviewMessage: message.value } satisfies ReviewVersionRequest, "PATCH");
      // Back to the queue, where the next change waits
      window.location.href = "/changes";
    } catch (error) {
      window.alert((error as Error).message);
      approve.disabled = !approvable;
      reject.disabled = false;
    }
  };

  message.addEventListener("input", () => message.setCustomValidity(""));
  approve.addEventListener("click", () => review("approved"));
  reject.addEventListener("click", () => review("rejected"));
}
