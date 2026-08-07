export type ParsedSiteRow = {
  node_id: string;
  cable_length_km: number;
};

export type SiteClipboardParse = {
  rows: ParsedSiteRow[];
  warnings: string[];
};

function parseCableLength(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "").replace(/km$/i, "");
  if (cleaned === "") return 0;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

export function parseSiteDetailClipboard(text: string): SiteClipboardParse {
  const rows: ParsedSiteRow[] = [];
  const warnings: string[] = [];
  const seenNodeIds = new Set<string>();

  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const rowNum = i + 1;
    const cells = line.split("\t");
    const nodeId = (cells[0] || "").trim();
    if (!nodeId) {
      warnings.push(`row ${rowNum}: missing Node ID, skipped`);
      return;
    }
    if (seenNodeIds.has(nodeId)) {
      warnings.push(`row ${rowNum}: duplicate Node ID (${nodeId}), skipped`);
      return;
    }
    const cable = parseCableLength(cells[1] || "");
    if (cable === null) {
      warnings.push(`row ${rowNum}: cable length is not a number ("${cells[1].trim()}"), skipped`);
      return;
    }
    seenNodeIds.add(nodeId);
    rows.push({ node_id: nodeId, cable_length_km: cable });
  });

  return { rows, warnings };
}
