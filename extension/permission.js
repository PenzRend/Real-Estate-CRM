// Asks for the photo-server permission when the import was started from the
// CRM (no popup click to ask in). The background waits for the answer.

const origins = new URLSearchParams(location.search)
  .getAll("origin")
  .filter((o) => /^https:\/\/[^/]+\/\*$/.test(o))
  .slice(0, 5);
document.getElementById("hosts").textContent = origins.map((o) => o.slice(8, -2)).join(", ") || "–";

document.getElementById("allow").addEventListener("click", async () => {
  await chrome.permissions.request({ origins }).catch(() => false);
  window.close();
});
document.getElementById("deny").addEventListener("click", () => window.close());
