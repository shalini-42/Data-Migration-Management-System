import { toast } from "./store.js";

const save = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Downloaded " + name);
};

const getRows = (rows) =>
  rows && rows.length ? rows : [{ note: "No data" }];

export async function exportData(fmt, name, rows) {
  try {
    rows = getRows(rows);
    const cols = Object.keys(rows[0]);

    if (fmt === "json") {
      const data = {
        report: name,
        generated: new Date().toISOString(),
        data: rows,
      };
      save(
        new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        }),
        name + ".json"
      );
      return;
    }

    if (fmt === "csv") {
      const { default: Papa } = await import("papaparse");
      const csv = Papa.unparse(rows);
      save(
        new Blob([csv], { type: "text/csv;charset=utf-8;" }),
        name + ".csv"
      );
      return;
    }

    if (fmt === "xlsx") {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30));
      XLSX.writeFile(wb, name + ".xlsx");
      toast("Downloaded " + name + ".xlsx");
      return;
    }

    if (fmt === "pdf") {
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const autoTable = autoTableModule.default || autoTableModule;
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("MigrateHub - " + name, 14, 16);
      doc.setFontSize(9);
      doc.text(
        "Generated " + new Date().toLocaleString() +
        " | " + rows.length + " records",
        14,
        23
      );

      autoTable(doc, {
        startY: 28,
        head: [cols],
        body: rows.map((r) =>
          cols.map((c) => String(r[c] ?? ""))
        ),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [37, 99, 235] },
      });

      doc.save(name + ".pdf");
      toast("Downloaded " + name + ".pdf");
      return;
    }

    throw new Error("Unsupported export format: " + fmt);
  } catch (error) {
    console.error("Export error:", error);
    toast(error.message || "Export failed", "err");
  }
}

export async function exportWorkbook(name, sheets) {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    Object.entries(sheets).forEach(([sheetName, rows]) => {
      const ws = XLSX.utils.json_to_sheet(getRows(rows));
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        sheetName.slice(0, 31)
      );
    });

    XLSX.writeFile(wb, name + ".xlsx");
    toast("Downloaded " + name + ".xlsx");
  } catch (error) {
    console.error("Workbook export error:", error);
    toast(error.message || "Excel export failed", "err");
  }
}

export async function readFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (!["csv", "json", "xlsx", "xls"].includes(ext)) {
    throw new Error("Unsupported file type");
  }

  if (file.size > 10 * 1048576) {
    throw new Error("File exceeds 10 MB");
  }

  if (ext === "json") {
    const json = JSON.parse(await file.text());
    return Array.isArray(json) ? json : [json];
  }

  if (ext === "csv") {
    const { default: Papa } = await import("papaparse");
    const result = Papa.parse(await file.text(), {
      header: true,
      skipEmptyLines: true,
    });

    if (result.errors.length) {
      console.warn("CSV parsing warnings:", result.errors);
    }

    return result.data;
  }

  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const firstSheet = wb.SheetNames[0];

  if (!firstSheet) return [];

  return XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], {
    defval: "",
  });
}

export function validate(rows, required) {
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const missing = required.filter((c) => !cols.includes(c));
  const seen = new Set();

  const out = rows.map((r, i) => {
    const issues = [];

    Object.entries(r).forEach(([k, v]) => {
      if (v === "" || v == null) issues.push("Empty " + k);
      if (/phone/i.test(k) && v && !/^[+\d][\d\s\-()]{6,}$/.test(v)) {
        issues.push("Invalid phone");
      }
      if (/date/i.test(k) && v && isNaN(Date.parse(v))) {
        issues.push("Invalid date");
      }
      if (/(amount|price|qty|age|count)/i.test(k) && v !== "" && isNaN(+v)) {
        issues.push("Invalid number");
      }
      if (/email/i.test(k) && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
        issues.push("Invalid email");
      }
    });

    const key = JSON.stringify(r);
    if (seen.has(key)) issues.push("Duplicate");
    seen.add(key);

    return {
      row: i + 1,
      ...r,
      status: issues.some(
        (x) => x !== "Empty" && !x.startsWith("Empty")
      )
        ? "Invalid"
        : issues.length
          ? "Warning"
          : "Valid",
      issues: issues.join("; "),
    };
  });

  return { missing, out };
}
