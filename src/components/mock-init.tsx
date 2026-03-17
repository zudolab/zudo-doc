import { useEffect } from "react";

export default function MockInit() {
  useEffect(() => {
    if (import.meta.env.DEV && import.meta.env.PUBLIC_ENABLE_MOCKS === "true") {
      import("../mocks/browser").then(({ worker }) => {
        worker.start({
          onUnhandledRequest: "bypass",
          serviceWorker: {
            url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
          },
        });
        console.log("[MSW] Mock Service Worker started");
      });
    }
  }, []);

  return null;
}
