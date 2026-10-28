import {
  buildCompleteLookCsv,
  COMPLETE_LOOK_CSV_COLUMNS,
  type CompleteLookRelationshipSource,
} from "../complete-look-csv";

function relationship(overrides: Partial<CompleteLookRelationshipSource> = {}): CompleteLookRelationshipSource {
  return {
    productId: "PRE-W-000169",
    styleId: "PRE-W-000169-NAVY",
    productStatus: "READY",
    archived: false,
    styleStatus: "READY",
    completeLook: {
      status: "READY",
      imageAsset: { status: "READY", publicId: "asset-id", storageKey: "catalog/look.webp" },
      companions: [
        { productId: "PRE-W-000136", styleId: "PRE-W-000136-BURG", productStatus: "READY", styleStatus: "READY", archived: false },
        { productId: "PRE-W-000135", styleId: "PRE-W-000135-OAT", productStatus: "READY", styleStatus: "READY", archived: false },
        { productId: "PRE-W-000117", styleId: "PRE-W-000117-OAT", productStatus: "READY", styleStatus: "READY", archived: false },
      ],
    },
    ...overrides,
  };
}

describe("Complete the Look relationship CSV", () => {
  it("uses the exact fixed header and persisted product/style identifiers", () => {
    const result = buildCompleteLookCsv([relationship()]);
    expect(COMPLETE_LOOK_CSV_COLUMNS).toEqual([
      "main_style_id", "related_style_id_1", "related_style_id_2", "related_style_id_3",
    ]);
    expect(result.csv).toBe([
      "main_style_id,related_style_id_1,related_style_id_2,related_style_id_3",
      "PRE-W-000169__PRE-W-000169-NAVY,PRE-W-000136__PRE-W-000136-BURG,PRE-W-000135__PRE-W-000135-OAT,PRE-W-000117__PRE-W-000117-OAT",
      "",
    ].join("\r\n"));
    expect(result.rowCount).toBe(1);
  });

  it("preserves companion order, limits output to three columns, and leaves missing cells blank", () => {
    const oneCompanion = relationship({ completeLook: {
      ...relationship().completeLook!,
      companions: [relationship().completeLook!.companions[1]!],
    } });
    const output = buildCompleteLookCsv([oneCompanion]).csv.split("\r\n")[1];
    expect(output).toBe("PRE-W-000169__PRE-W-000169-NAVY,PRE-W-000135__PRE-W-000135-OAT,,");
    const four = relationship({ completeLook: {
      ...relationship().completeLook!,
      companions: [...relationship().completeLook!.companions, { productId: "P4", styleId: "S4", productStatus: "READY", styleStatus: "READY", archived: false }],
    } });
    expect(buildCompleteLookCsv([four]).csv.split("\r\n")[1]?.split(",")).toHaveLength(4);
  });

  it("sorts deterministically by product and style, and emits one row per main style", () => {
    const second = relationship({ productId: "P-2", styleId: "S-2" });
    const first = relationship({ productId: "P-1", styleId: "S-1" });
    const duplicate = relationship({ productId: "P-1", styleId: "S-1", completeLook: { ...first.completeLook!, companions: [] } });
    const csv = buildCompleteLookCsv([second, first, duplicate]).csv;
    expect(csv.split("\r\n")).toHaveLength(4);
    expect(csv.split("\r\n")[1]).toContain("P-1__S-1");
    expect(csv.split("\r\n")[2]).toContain("P-2__S-2");
  });

  it.each([
    ["archived main product", { archived: true }],
    ["inactive main product", { productStatus: "DRAFT" }],
    ["inactive main style", { styleStatus: "DRAFT" }],
    ["failed look", { completeLook: { ...relationship().completeLook!, status: "FAILED" } }],
    ["skipped look", { completeLook: { ...relationship().completeLook!, status: "SKIPPED" } }],
    ["stale look", { completeLook: { ...relationship().completeLook!, status: "STALE" } }],
    ["missing look image", { completeLook: { ...relationship().completeLook!, imageAsset: null } }],
    ["invalid look image", { completeLook: { ...relationship().completeLook!, imageAsset: { status: "READY", publicId: "asset", storageKey: null } } }],
    ["failed look image", { completeLook: { ...relationship().completeLook!, imageAsset: { status: "FAILED", publicId: "asset", storageKey: "catalog/look.webp" } } }],
    ["archived companion", { completeLook: { ...relationship().completeLook!, companions: [{ ...relationship().completeLook!.companions[0]!, archived: true }] } }],
    ["duplicate companion product", { completeLook: { ...relationship().completeLook!, companions: [relationship().completeLook!.companions[0]!, { ...relationship().completeLook!.companions[1]!, productId: relationship().completeLook!.companions[0]!.productId }] } }],
    ["inactive companion style", { completeLook: { ...relationship().completeLook!, companions: [{ ...relationship().completeLook!.companions[0]!, styleStatus: "DRAFT" }] } }],
  ] as Array<[string, Partial<CompleteLookRelationshipSource>]>)("excludes %s", (_label, overrides) => {
    expect(buildCompleteLookCsv([relationship(overrides)]).rowCount).toBe(0);
  });

  it("escapes persisted identifiers and returns a header-only CSV when nothing qualifies", () => {
    const escaped = relationship({ productId: 'P,"1', styleId: "S,1" });
    expect(buildCompleteLookCsv([escaped]).csv).toContain('"P,""1__S,1"');
    const empty = buildCompleteLookCsv([relationship({ completeLook: null })]);
    expect(empty.csv).toBe(`${COMPLETE_LOOK_CSV_COLUMNS.join(",")}\r\n`);
    expect(empty.rowCount).toBe(0);
  });
});
