const payslips = [
    {
        filename: "31 May 2025 Payslip.pdf",
        url: "#",
        currency: "INR",
        startDate: "2025-05-01",
        endDate: "2025-05-31",
        createdDate: "2025-05-01"
    },
    {
        filename: "30 Apr 2025 Payslip.pdf",
        url: "#",
        currency: "INR",
        startDate: "2025-04-01",
        endDate: "2025-04-30",
        createdDate: "2025-04-01"
    }
];

function renderPayslips(data) {
    const container = document.getElementById("payslipList");
    container.innerHTML = "";

    data.forEach(p => {
        const item = document.createElement("div");
        item.className = "payslip-item";

        item.innerHTML = `
      <div class="payslip-date">${p.createdDate}</div>
      <a href="${p.url}" class="payslip-link">${p.filename}</a>
      <div class="payslip-range">${p.startDate} to ${p.endDate}</div>
      <div class="payslip-currency">${p.currency}</div>
    `;

        container.appendChild(item);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderPayslips(payslips);

    document.getElementById("monthFilter").addEventListener("change", function () {
        // This is where you can filter based on the dropdown
        // For now it just re-renders all payslips
        renderPayslips(payslips);
    });
});
