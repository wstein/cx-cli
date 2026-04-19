// test-lane: unit
import { describe, expect, it } from "bun:test";
import type { NoteCognitionAssessment } from "../../src/notes/cognition.js";
import {
  extractHeadings,
  extractWikilinkReferences,
  normalizeWikilinkReference,
  resolveWikilinkReference,
} from "../../src/notes/linking.js";
import type { NoteMetadata } from "../../src/notes/validate.js";

const DEFAULT_COGNITION: NoteCognitionAssessment = {
  summaryWordCount: 8,
  noteLinkCount: 1,
  codeLinkCount: 0,
  localLinkCount: 0,
  evidenceLinkCount: 1,
  structureSignals: {
    what: false,
    why: false,
    how: false,
  },
  templateBoilerplateDetected: false,
  score: 70,
  label: "review",
  trustLevel: "conditional",
};

describe("notes linking", () => {
  describe("normalizeWikilinkReference", () => {
    it("normalizes simple wikilink reference", () => {
      const result = normalizeWikilinkReference("My Note");
      expect(result).toBe("My Note");
    });

    it("handles reference with display text", () => {
      const result = normalizeWikilinkReference("My Note|Display Text");
      expect(result).toBe("My Note");
    });

    it("handles reference with anchor", () => {
      const result = normalizeWikilinkReference("My Note#Section");
      expect(result).toBe("My Note");
    });

    it("handles reference with display and anchor", () => {
      const result = normalizeWikilinkReference("My Note#Section|Display");
      expect(result).toBe("My Note");
    });

    it("trims whitespace from reference", () => {
      const result = normalizeWikilinkReference("  My Note  ");
      expect(result).toBe("My Note");
    });

    it("trims whitespace when display text is present", () => {
      const result = normalizeWikilinkReference("My Note  |  Display Text");
      expect(result).toBe("My Note");
    });

    it("returns empty string for empty reference", () => {
      const result = normalizeWikilinkReference("");
      expect(result).toBe("");
    });

    it("returns empty string for whitespace-only reference", () => {
      const result = normalizeWikilinkReference("   ");
      expect(result).toBe("");
    });

    it("handles just anchor without note name", () => {
      const result = normalizeWikilinkReference("#Section");
      expect(result).toBe("");
    });

    it("handles just display pipe without note name", () => {
      const result = normalizeWikilinkReference("|Display");
      expect(result).toBe("");
    });

    it("handles multiple pipes (takes first part)", () => {
      const result = normalizeWikilinkReference("Note|Display|Extra");
      expect(result).toBe("Note");
    });

    it("handles multiple anchors (takes first part)", () => {
      const result = normalizeWikilinkReference("Note#Section#Subsection");
      expect(result).toBe("Note");
    });
  });

  describe("extractWikilinkReferences", () => {
    it("extracts single wikilink reference", () => {
      const content = "This mentions [[My Note]].";
      const result = extractWikilinkReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0]?.target).toBe("My Note");
    });

    it("extracts multiple wikilink references", () => {
      const content = "See [[Note A]] and [[Note B]].";
      const result = extractWikilinkReferences(content);
      expect(result).toHaveLength(2);
      expect(result[0]?.target).toBe("Note A");
      expect(result[1]?.target).toBe("Note B");
    });

    it("preserves raw reference text", () => {
      const content = "See [[My Note|Display Text]].";
      const result = extractWikilinkReferences(content);
      expect(result[0]?.raw).toBe("My Note|Display Text");
    });

    it("normalizes references in target", () => {
      const content = "See [[My Note#Section|Display]].";
      const result = extractWikilinkReferences(content);
      expect(result[0]?.target).toBe("My Note");
    });

    it("skips empty wikilink brackets", () => {
      const content = "This has [[]] in it.";
      const result = extractWikilinkReferences(content);
      expect(result).toHaveLength(0);
    });

    it("skips whitespace-only wikilink brackets", () => {
      const content = "This has [[   ]] in it.";
      const result = extractWikilinkReferences(content);
      expect(result).toHaveLength(0);
    });

    it("returns empty array for content with no wikilinks", () => {
      const content = "No wikilinks here.";
      const result = extractWikilinkReferences(content);
      expect(result).toEqual([]);
    });

    it("handles wikilinks with special characters in names", () => {
      const content = "See [[Note-with-dashes_and_underscores]].";
      const result = extractWikilinkReferences(content);
      expect(result[0]?.target).toBe("Note-with-dashes_and_underscores");
    });

    it("handles wikilinks across multiple lines", () => {
      const content = "Start\n[[First]]\nmiddle\n[[Second]]\nend";
      const result = extractWikilinkReferences(content);
      expect(result).toHaveLength(2);
    });

    it("handles wikilinks in code-like context", () => {
      const content = "Code: [[SomeClass.method()]]";
      const result = extractWikilinkReferences(content);
      expect(result).toHaveLength(1);
      expect(result[0]?.target).toBe("SomeClass.method()");
    });

    it("trims references before normalizing", () => {
      const content = "See [[  Trimmed  ]].";
      const result = extractWikilinkReferences(content);
      expect(result[0]?.target).toBe("Trimmed");
    });

    it("handles consecutive wikilinks without space", () => {
      const content = "[[First]][[Second]][[Third]]";
      const result = extractWikilinkReferences(content);
      expect(result).toHaveLength(3);
    });

    it("extracts anchor from [[Note#Section]] wikilink", () => {
      const result = extractWikilinkReferences(
        "See [[My Note#Implementation]].",
      );
      expect(result[0]?.target).toBe("My Note");
      expect(result[0]?.anchor).toBe("Implementation");
    });

    it("leaves anchor undefined for plain wikilink without #", () => {
      const result = extractWikilinkReferences("See [[My Note]].");
      expect(result[0]?.target).toBe("My Note");
      expect(result[0]?.anchor).toBeUndefined();
    });

    it("strips display text before extracting anchor [[Note#Section|label]]", () => {
      const result = extractWikilinkReferences(
        "See [[My Note#Section|click here]].",
      );
      expect(result[0]?.target).toBe("My Note");
      expect(result[0]?.anchor).toBe("Section");
    });
  });

  describe("extractHeadings", () => {
    it("returns all heading texts normalized to lowercase", () => {
      const content = "## My Section\n\nBody.\n\n### Sub Section\n\nMore.";
      expect(extractHeadings(content)).toEqual(["my section", "sub section"]);
    });

    it("handles all heading levels", () => {
      const content = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
      expect(extractHeadings(content)).toEqual([
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ]);
    });

    it("returns empty array when no headings", () => {
      expect(extractHeadings("Just plain text.")).toEqual([]);
    });

    it("ignores inline # that are not at line start", () => {
      const content = "Some text #tag and more text\n## Real Heading";
      expect(extractHeadings(content)).toEqual(["real heading"]);
    });
  });

  describe("resolveWikilinkReference", () => {
    const createNote = (
      id: string,
      title: string,
      aliases?: string[],
    ): NoteMetadata => ({
      id,
      title,
      aliases: aliases ?? [],
      filePath: "",
      fileName: "",
      summary: "",
      codeLinks: [],
      cognition: DEFAULT_COGNITION,
    });

    it("resolves reference by exact ID match", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["note1", createNote("note1", "My Note")],
      ]);
      const result = resolveWikilinkReference("note1", notesMap);
      expect(result).toBe("note1");
    });

    it("resolves reference by exact title match", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "My Note")],
      ]);
      const result = resolveWikilinkReference("My Note", notesMap);
      expect(result).toBe("id1");
    });

    it("resolves reference case-insensitively by title", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "My Note")],
      ]);
      const result = resolveWikilinkReference("my note", notesMap);
      expect(result).toBe("id1");
    });

    it("resolves reference by alias", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "My Note", ["OldName", "Alternate"])],
      ]);
      const result = resolveWikilinkReference("Alternate", notesMap);
      expect(result).toBe("id1");
    });

    it("resolves reference case-insensitively by alias", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "My Note", ["OldName"])],
      ]);
      const result = resolveWikilinkReference("oldname", notesMap);
      expect(result).toBe("id1");
    });

    it("returns null when reference not found", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "My Note")],
      ]);
      const result = resolveWikilinkReference("Unknown", notesMap);
      expect(result).toBeNull();
    });

    it("returns null for empty reference", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "My Note")],
      ]);
      const result = resolveWikilinkReference("", notesMap);
      expect(result).toBeNull();
    });

    it("returns null for empty notes map", () => {
      const notesMap = new Map<string, NoteMetadata>();
      const result = resolveWikilinkReference("My Note", notesMap);
      expect(result).toBeNull();
    });

    it("prefers exact ID match over title match", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["exact", createNote("exact", "Something Else")],
        ["id2", createNote("id2", "exact")],
      ]);
      const result = resolveWikilinkReference("exact", notesMap);
      // Exact ID match is checked first in the map
      expect(result).toBe("exact");
    });

    it("handles whitespace normalization in reference", () => {
      const reference = "  My Note  ";
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "My Note")],
      ]);
      // normalizeWikilinkReference is called internally
      // This should match after normalization
      const result = resolveWikilinkReference(reference, notesMap);
      expect(result).toBe("id1");
    });

    it("handles multiple aliases and finds first match", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "Primary", ["Alias1", "Alias2", "Alias3"])],
      ]);
      const result = resolveWikilinkReference("Alias2", notesMap);
      expect(result).toBe("id1");
    });

    it("returns null for invalid/unresolvable references", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "Note One")],
        ["id2", createNote("id2", "Note Two")],
      ]);
      const result = resolveWikilinkReference("Note Three", notesMap);
      expect(result).toBeNull();
    });

    it("handles notes without aliases", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "My Note", undefined)],
      ]);
      const result = resolveWikilinkReference("My Note", notesMap);
      expect(result).toBe("id1");
    });

    it("handles empty alias array", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["id1", createNote("id1", "My Note", [])],
      ]);
      const result = resolveWikilinkReference("My Note", notesMap);
      expect(result).toBe("id1");
    });

    it("is case-sensitive for ID matching (first check)", () => {
      const notesMap = new Map<string, NoteMetadata>([
        ["ID1", createNote("ID1", "Title")],
      ]);
      // Case-sensitive check on ID
      const result = resolveWikilinkReference("id1", notesMap);
      expect(result).toBeNull();
    });
  });
});
