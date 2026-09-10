// Fixture copy of the package-shipped `zfb/config` ambient shim (#3237).

declare module "zfb/config" {
  export * from "@takazudo/zfb/config";
}

// The preBuild hook creates this JSON in each temporary fixture project.
// Package type checking also visits this source before a fixture build exists.
declare module "#doc-history-meta" {
  const metadata: Record<string, unknown>;
  export default metadata;
}
