import { parseSiteDetailClipboard } from '@/utils/site-detail-parser';

describe('parseSiteDetailClipboard', () => {
  it('parses tab-separated Node ID + Cable Length rows', () => {
    const { rows, warnings } = parseSiteDetailClipboard('MN113\t5.5\nMN114\t6.2\nMN115\t4');
    expect(rows).toEqual([
      { node_id: 'MN113', cable_length_km: 5.5 },
      { node_id: 'MN114', cable_length_km: 6.2 },
      { node_id: 'MN115', cable_length_km: 4 },
    ]);
    expect(warnings).toEqual([]);
  });

  it('strips units, commas, and whitespace from cable lengths', () => {
    const { rows } = parseSiteDetailClipboard('A\t5.5 KM\nB\t1,500\nC\t 7 ');
    expect(rows).toEqual([
      { node_id: 'A', cable_length_km: 5.5 },
      { node_id: 'B', cable_length_km: 1500 },
      { node_id: 'C', cable_length_km: 7 },
    ]);
  });

  it('treats a missing cable length as 0', () => {
    const { rows } = parseSiteDetailClipboard('A\t\nB\t');
    expect(rows).toEqual([
      { node_id: 'A', cable_length_km: 0 },
      { node_id: 'B', cable_length_km: 0 },
    ]);
  });

  it('skips blank lines and empty rows', () => {
    const { rows, warnings } = parseSiteDetailClipboard('\n\nA\t1\n\nB\t2\n');
    expect(rows).toEqual([
      { node_id: 'A', cable_length_km: 1 },
      { node_id: 'B', cable_length_km: 2 },
    ]);
    expect(warnings).toEqual([]);
  });

  it('warns and skips non-numeric cable lengths', () => {
    const { rows, warnings } = parseSiteDetailClipboard('A\t1\nB\tfoo\nC\t3');
    expect(rows).toEqual([
      { node_id: 'A', cable_length_km: 1 },
      { node_id: 'C', cable_length_km: 3 },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('row 2');
    expect(warnings[0]).toContain('foo');
  });

  it('warns and skips duplicate Node IDs within the paste', () => {
    const { rows, warnings } = parseSiteDetailClipboard('A\t1\nB\t2\nA\t3');
    expect(rows).toEqual([
      { node_id: 'A', cable_length_km: 1 },
      { node_id: 'B', cable_length_km: 2 },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('row 3');
    expect(warnings[0]).toContain('A');
  });
});
