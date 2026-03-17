export async function initMocks() {
  if (import.meta.env.PUBLIC_ENABLE_MOCKS === "true") {
    const { worker } = await import("./browser");
    await worker.start({
      onUnhandledRequest: "bypass",
      serviceWorker: {
        url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
      },
    });
    console.log("[MSW] Mock Service Worker started");
  }
}
