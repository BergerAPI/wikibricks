const type = document.querySelector<HTMLSelectElement>("#entity_type");
type?.addEventListener("change", () => {
  if (!type.form) return;
  // Old type-specific values should not be submitted with a different collection.
  for (const input of type.form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-specific-filters] input, [data-specific-filters] select"))
    input.disabled = true;
  type.form.requestSubmit();
});
