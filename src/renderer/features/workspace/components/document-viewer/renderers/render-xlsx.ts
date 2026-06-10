// XLSX renderer — wraps SheetJS (`xlsx`). Lazy-imported. Builds one container
// per worksheet and renders the active sheet's HTML table on demand (so a large
// workbook doesn't materialise every sheet up front). Returns a controller the
// host uses to drive the sheet-tab bar.

export interface XlsxController {
  sheetNames: string[];
  showSheet: (name: string) => void;
}

export async function renderXlsx(
  buf: ArrayBuffer,
  container: HTMLElement,
): Promise<XlsxController> {
  const mod = await import("xlsx");
  // The package is CJS; depending on interop the namespace may sit on `default`.
  const XLSX: typeof import("xlsx") = (mod as any).default ?? mod;

  const wb = XLSX.read(buf, { type: "array" });
  const sheetNames = wb.SheetNames;

  const sheetEls = new Map<string, HTMLDivElement>();
  for (const name of sheetNames) {
    const el = document.createElement("div");
    el.style.display = "none";
    el.dataset.sheet = name;
    container.appendChild(el);
    sheetEls.set(name, el);
  }

  const showSheet = (name: string) => {
    for (const [n, el] of sheetEls) {
      el.style.display = n === name ? "block" : "none";
    }
    const el = sheetEls.get(name);
    if (el && el.dataset.rendered !== "1") {
      const ws = wb.Sheets[name];
      el.innerHTML = ws ? XLSX.utils.sheet_to_html(ws, { editable: false }) : "";
      el.dataset.rendered = "1";
    }
  };

  if (sheetNames[0]) showSheet(sheetNames[0]);

  return { sheetNames, showSheet };
}
