import type { HtmlVEditorSettings } from "../settings/settings";

export type CharacterMapGroupId = "common" | "arrows" | "boxDrawing" | "shapes" | "math" | "oneNoteTags";

export interface CustomCharacterMapEntry {
  char: string;
  name: string;
}

export interface CharacterMapGroupDefinition {
  id: CharacterMapGroupId;
  name: string;
  characters: CustomCharacterMapEntry[];
}

export const CHARACTER_MAP_GROUPS: CharacterMapGroupDefinition[] = [
  {
    id: "common",
    name: "Common symbols",
    characters: [
      { char: "✓", name: "Check mark" },
      { char: "✗", name: "Ballot X" },
      { char: "※", name: "Reference mark" },
      { char: "§", name: "Section sign" },
      { char: "¶", name: "Paragraph sign" },
      { char: "★", name: "Black star" },
      { char: "☆", name: "White star" },
      { char: "•", name: "Bullet" },
      { char: "…", name: "Ellipsis" }
    ]
  },
  {
    id: "arrows",
    name: "Arrows",
    characters: [
      { char: "←", name: "Left arrow" },
      { char: "→", name: "Right arrow" },
      { char: "↑", name: "Up arrow" },
      { char: "↓", name: "Down arrow" },
      { char: "↔", name: "Left right arrow" },
      { char: "↕", name: "Up down arrow" },
      { char: "⇒", name: "Right double arrow" },
      { char: "⇐", name: "Left double arrow" },
      { char: "⇔", name: "Left right double arrow" }
    ]
  },
  {
    id: "boxDrawing",
    name: "Box drawing",
    characters: [
      { char: "─", name: "Box drawings light horizontal" },
      { char: "│", name: "Box drawings light vertical" },
      { char: "┌", name: "Box drawings light down and right" },
      { char: "┐", name: "Box drawings light down and left" },
      { char: "└", name: "Box drawings light up and right" },
      { char: "┘", name: "Box drawings light up and left" },
      { char: "├", name: "Box drawings vertical and right" },
      { char: "┤", name: "Box drawings vertical and left" },
      { char: "┬", name: "Box drawings down and horizontal" },
      { char: "┴", name: "Box drawings up and horizontal" },
      { char: "┼", name: "Box drawings vertical and horizontal" }
    ]
  },
  {
    id: "shapes",
    name: "Shapes",
    characters: [
      { char: "■", name: "Black square" },
      { char: "□", name: "White square" },
      { char: "◆", name: "Black diamond" },
      { char: "◇", name: "White diamond" },
      { char: "●", name: "Black circle" },
      { char: "○", name: "White circle" },
      { char: "▲", name: "Black up triangle" },
      { char: "▼", name: "Black down triangle" }
    ]
  },
  {
    id: "math",
    name: "Math",
    characters: [
      { char: "±", name: "Plus-minus sign" },
      { char: "×", name: "Multiplication sign" },
      { char: "÷", name: "Division sign" },
      { char: "≈", name: "Almost equal to" },
      { char: "≠", name: "Not equal to" },
      { char: "≤", name: "Less-than or equal to" },
      { char: "≥", name: "Greater-than or equal to" },
      { char: "∞", name: "Infinity" },
      { char: "√", name: "Square root" }
    ]
  },
  {
    id: "oneNoteTags",
    name: "OneNote tags",
    characters: [
      { char: "○", name: "Open task circle" },
      { char: "✅", name: "Done check" },
      { char: "❗", name: "Important mark" },
      { char: "❓", name: "Question mark" },
      { char: "💡", name: "Idea bulb" },
      { char: "📌", name: "Pin" },
      { char: "🔖", name: "Bookmark" },
      { char: "⚑", name: "Flag" }
    ]
  }
];

export function getCharacterMapGroupIds(): CharacterMapGroupId[] {
  return CHARACTER_MAP_GROUPS.map((group) => group.id);
}

export function buildHugeRteCharacterMap(settings: HtmlVEditorSettings): [number, string][] | undefined {
  if (!settings.enableCharacterMap) {
    return undefined;
  }

  const enabledGroups = new Set(settings.characterMapGroups ?? []);
  const entries = CHARACTER_MAP_GROUPS
    .filter((group) => enabledGroups.has(group.id))
    .flatMap((group) => group.characters.map((entry) => ({
      ...entry,
      name: `${group.name}: ${entry.name}`
    })))
    .concat(normalizeCustomCharacters(settings.customCharacterMap));

  return entries
    .map((entry): [number, string] | null => {
      const codePoint = entry.char.codePointAt(0);
      if (!codePoint || !entry.name.trim()) {
        return null;
      }
      return [codePoint, entry.name.trim()];
    })
    .filter((entry): entry is [number, string] => Boolean(entry));
}

export function normalizeCharacterMapGroups(groups: CharacterMapGroupId[] | undefined): CharacterMapGroupId[] {
  const validIds = new Set(getCharacterMapGroupIds());
  const normalized = (groups ?? [])
    .filter((group): group is CharacterMapGroupId => validIds.has(group as CharacterMapGroupId));
  return normalized.length > 0 ? normalized : ["common"];
}

export function normalizeCustomCharacters(entries: CustomCharacterMapEntry[] | undefined): CustomCharacterMapEntry[] {
  return (entries ?? [])
    .filter((entry) => typeof entry?.char === "string" && typeof entry?.name === "string")
    .map((entry) => ({
      char: Array.from(entry.char.trim())[0] ?? "",
      name: entry.name.trim()
    }))
    .filter((entry) => entry.char && entry.name);
}
