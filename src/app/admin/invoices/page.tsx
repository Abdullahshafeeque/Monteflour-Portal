// src/app/admin/invoices/page.tsx
//
// Plain HTML form — submitting it navigates the browser straight to the
// CSV download, no client-side JS required.

export default function InvoicesExportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  return (
    <div className="admin-page">
      <h1>Export Invoices</h1>
      <p>Download Monteflour's GST invoices for a date range, for Tally import.</p>

      <form action="/api/admin/export-invoices" method="GET" target="_blank">
        <div className="form-row">
          <label htmlFor="from">From</label>
          <input type="date" id="from" name="from" defaultValue={firstOfMonth} required />
        </div>
        <div className="form-row">
          <label htmlFor="to">To</label>
          <input type="date" id="to" name="to" defaultValue={today} required />
        </div>
        <button type="submit" className="btn-submit">Download CSV</button>
      </form>
    </div>
  );
}