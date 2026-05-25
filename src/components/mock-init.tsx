"use client";

import { useEffect } from "preact/hooks";

export default function MockInit() {
  useEffect(() => {
    import("../mocks/init").then(({ initMocks }) => initMocks());
  }, []);

  return null;
}
