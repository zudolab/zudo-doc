/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import render from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import {
  FileArchive,
  FileCode,
  FileGeneric,
  FileImage,
  FilePdf,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
} from "../index.js";

const icons = [
  FileArchive,
  FileCode,
  FileGeneric,
  FileImage,
  FilePdf,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
];

describe("file and folder icons", () => {
  it.each(icons)("$name uses the shared SVG presentation", (Icon) => {
    const html = render(<Icon className="h-icon-sm w-icon-sm" />);

    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="h-icon-sm w-icon-sm"');
  });

  it.each(icons)("$name omits class when className is not supplied", (Icon) => {
    const html = render(<Icon />);

    expect(html).not.toMatch(/\sclass=/);
  });
});
