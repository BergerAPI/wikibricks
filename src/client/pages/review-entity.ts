import type { ReviewVersionRequest } from "../../shared/contracts";

const page = document.querySelector<HTMLElement>("[data-review-url]");
if (page) setupReview(page);

function setupReview(page: HTMLElement) {
  const { reviewUrl, historyUrl } = page.dataset;
  const message = page.querySelector<HTMLInputElement>("#review_message");
  const approve = page.querySelector<HTMLButtonElement>("#approve");
  const reject = page.querySelector<HTMLButtonElement>("#reject");
  if (!reviewUrl || !historyUrl || !message || !approve || !reject) return;

  const review = async (type: ReviewVersionRequest["type"]) => {
    if (approve.disabled || reject.disabled) return;
    approve.disabled = true;
    reject.disabled = true;
    const request: ReviewVersionRequest = {
      type,
      reviewMessage: message.value || "No Change Message",
    };

    try {
      const response = await fetch(reviewUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (response.status === 409) throw new Error(await response.text());
      if (!response.ok) throw new Error(`Review failed (${response.status})`);
      window.location.href = type === "approved" ? historyUrl : "/changes";
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Review failed");
    } finally {
      approve.disabled = false;
      reject.disabled = false;
    }
  };

  approve.addEventListener("click", () => review("approved"));
  reject.addEventListener("click", () => review("rejected"));
}
