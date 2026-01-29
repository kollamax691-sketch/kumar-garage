// ===== GLOBAL VARIABLES =====
const { jsPDF } = window.jspdf;
let records = JSON.parse(localStorage.getItem("records") || "[]");
let editId = null;
let filteredRecords = [];
let activeFilter = 'all';

// DOM Elements
const dateInput = document.getElementById("date");
const vehicleNoInput = document.getElementById("vehicleNo");
const paymentTypeSelect = document.getElementById("paymentType");
const chequeBoxDiv = document.getElementById("chequeBox");
const customerInput = document.getElementById("customer");
const addressInput = document.getElementById("address");
const phoneInput = document.getElementById("phone");
const vehicleTypeInput = document.getElementById("vehicleType");
const engineTypeInput = document.getElementById("engineType");
const engineNoInput = document.getElementById("engineNo");
const mileageInput = document.getElementById("mileage");
const labourInput = document.getElementById("labour");
const paidInput = document.getElementById("paid");
const chequeNoInput = document.getElementById("chequeNo");
const bankNameInput = document.getElementById("bankName");
const chequeDateInput = document.getElementById("chequeDate");
const chequeStatusSelect = document.getElementById("chequeStatus");

const jobsListDiv = document.getElementById("jobsList");
const partsListDiv = document.getElementById("partsList");
const historyListDiv = document.getElementById("historyList");
const invoiceDiv = document.getElementById("invoice");
const invoiceContentDiv = document.getElementById("invoiceContent");

// Initialize date to today
dateInput.valueAsDate = new Date();

// ===== UTILITY FUNCTIONS =====
function formatCurrency(amount) {
    return 'Rs ' + amount.toLocaleString('si-LK');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('si-LK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getStatusLabel(status) {
    switch(status) {
        case 'paid': return { text: '✅ ගෙවා ඇත', color: '#28a745' };
        case 'partial': return { text: '🟡 අර්ධ', color: '#ffc107' };
        case 'pending': return { text: '❌ පැහැරී ඇත', color: '#dc3545' };
        case 'cheque_pending': return { text: '🟠 චෙක්පත්', color: '#fd7e14' };
        default: return { text: status, color: '#6c757d' };
    }
}

// ===== THEME TOGGLE =====
function toggleMode() {
    document.body.classList.toggle("dark");
    const icon = document.querySelector('.mode-toggle i');
    if (document.body.classList.contains("dark")) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
    localStorage.setItem('theme', document.body.classList.contains("dark") ? 'dark' : 'light');
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark');
}

// ===== TAB NAVIGATION =====
function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
    invoiceDiv.classList.add("hidden");
    
    // Remove active class from all nav items
    document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
    
    // Show selected tab
    document.getElementById(tabId).classList.remove("hidden");
    
    // Add active class to clicked nav item
    const navItem = document.querySelector(`.nav-item[onclick="showTab('${tabId}')"]`);
    if (navItem) navItem.classList.add("active");
    
    // Load tab-specific content
    switch(tabId) {
        case 'home':
            loadHomeDashboard();
            break;
        case 'history':
            loadHistory(records);
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'customers':
            loadCustomers();
            break;
    }
}

// ===== FORM FUNCTIONS =====
function toggleCheque() {
    const isCheque = paymentTypeSelect.value === "Cheque";
    chequeBoxDiv.classList.toggle("hidden", !isCheque);
}

function addJob(name = "", price = "") {
    const jobId = Date.now();
    jobsListDiv.innerHTML += `
        <div class="jobRow" id="job-${jobId}">
            <input placeholder="වැඩෙහි නම" value="${name}" class="form-input">
            <input type="number" placeholder="මිල (රුපියල්)" value="${price}" class="form-input">
            <button onclick="removeElement('job-${jobId}')" class="remove-btn">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
}

function addPart(partNo = "", name = "", quantity = "", price = "") {
    const partId = Date.now();
    partsListDiv.innerHTML += `
        <div class="partRow" id="part-${partId}">
            <input placeholder="කොටස් අංකය" value="${partNo}" class="form-input">
            <input placeholder="නම" value="${name}" class="form-input">
            <input type="number" placeholder="ප්‍රමාණය" value="${quantity}" class="form-input">
            <input type="number" placeholder="ඒකක මිල" value="${price}" class="form-input">
            <button onclick="removeElement('part-${partId}')" class="remove-btn">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
}

function removeElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.remove();
    }
}

function clearForm() {
    // Clear all form inputs
    document.querySelectorAll("#add .form-input").forEach(input => input.value = "");
    document.querySelectorAll("#add .form-select").forEach(select => select.value = select.options[0].value);
    
    // Clear dynamic lists
    jobsListDiv.innerHTML = "";
    partsListDiv.innerHTML = "";
    
    // Reset date
    dateInput.valueAsDate = new Date();
    
    // Reset cheque box
    toggleCheque();
    
    // Reset edit ID
    editId = null;
    
    // Show success message
    showNotification("පෝරමය සාර්ථකව ඉවත් කරන ලදී", "success");
}

function saveRecord() {
    // Validation
    if (!vehicleNoInput.value.trim()) {
        showNotification("කරුණාකර වාහන අංකය ඇතුළත් කරන්න", "error");
        vehicleNoInput.focus();
        return;
    }
    
    if (!customerInput.value.trim()) {
        showNotification("කරුණාකර ගැනුම්කරුගේ නම ඇතුළත් කරන්න", "error");
        customerInput.focus();
        return;
    }
    
    if (!phoneInput.value.trim()) {
        showNotification("කරුණාකර දුරකථන අංකය ඇතුළත් කරන්න", "error");
        phoneInput.focus();
        return;
    }
    
    // Collect jobs
    let jobs = [];
    let jobsTotal = 0;
    document.querySelectorAll(".jobRow").forEach(row => {
        const name = row.children[0].value.trim();
        const price = parseFloat(row.children[1].value) || 0;
        if (name && price > 0) {
            jobs.push({ name, price });
            jobsTotal += price;
        }
    });
    
    // Collect parts
    let parts = [];
    let partsTotal = 0;
    document.querySelectorAll(".partRow").forEach(row => {
        const partNo = row.children[0].value.trim();
        const name = row.children[1].value.trim();
        const quantity = parseFloat(row.children[2].value) || 0;
        const price = parseFloat(row.children[3].value) || 0;
        if (name && quantity > 0 && price > 0) {
            const total = quantity * price;
            parts.push({ partNo, name, quantity, price, total });
            partsTotal += total;
        }
    });
    
    // Calculate totals
    const labourAmount = parseFloat(labourInput.value) || 0;
    const paidAmount = parseFloat(paidInput.value) || 0;
    const totalAmount = jobsTotal + partsTotal + labourAmount;
    const balanceAmount = totalAmount - paidAmount;
    
    // Determine status
    let status = "pending";
    if (paymentTypeSelect.value === "Cheque") {
        status = chequeStatusSelect.value === "Cleared" ? "paid" : "cheque_pending";
    } else {
        if (paidAmount >= totalAmount) {
            status = "paid";
        } else if (paidAmount > 0) {
            status = "partial";
        }
    }
    
    // Create record object
    const record = {
        id: editId || Date.now(),
        invoiceNo: editId ? records.find(r => r.id === editId).invoiceNo : 
                    `KG-${new Date().getFullYear()}-${records.length + 1001}`,
        date: dateInput.value,
        customer: customerInput.value.trim(),
        address: addressInput.value.trim(),
        phone: phoneInput.value.trim(),
        vehicle: vehicleNoInput.value.trim(),
        vehicleType: vehicleTypeInput.value.trim(),
        engineType: engineTypeInput.value.trim(),
        engineNo: engineNoInput.value.trim(),
        mileage: mileageInput.value.trim(),
        jobs,
        parts,
        labour: labourAmount,
        total: totalAmount,
        paid: paidAmount,
        balance: balanceAmount,
        status,
        paymentType: paymentTypeSelect.value,
        cheque: paymentTypeSelect.value === "Cheque" ? {
            no: chequeNoInput.value.trim(),
            bank: bankNameInput.value.trim(),
            date: chequeDateInput.value,
            status: chequeStatusSelect.value
        } : null
    };
    
    // Save to records
    if (editId) {
        records = records.map(r => r.id === editId ? record : r);
        showNotification("ගනුදෙනුව සාර්ථකව යාවත්කාලීන කරන ලදී", "success");
    } else {
        records.push(record);
        showNotification("ගනුදෙනුව සාර්ථකව සුරකින ලදී", "success");
    }
    
    // Save to localStorage
    localStorage.setItem("records", JSON.stringify(records));
    
    // Generate PDF
    generatePDF(record);
    
    // Clear form and show history
    clearForm();
    showTab("history");
}

// ===== HOME DASHBOARD =====
function loadHomeDashboard() {
    // Update quick stats
    document.getElementById("totalTrans").textContent = records.length;
    
    const uniqueCustomers = [...new Set(records.map(r => r.phone))].length;
    document.getElementById("totalCust").textContent = uniqueCustomers;
    
    const totalRevenue = records.reduce((sum, r) => sum + r.total, 0);
    document.getElementById("totalRev").textContent = formatCurrency(totalRevenue);
    
    // Load recent transactions
    const recentRecords = records.slice(-5).reverse();
    const recentListDiv = document.getElementById("recentList");
    
    if (recentRecords.length === 0) {
        recentListDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>තවම ගනුදෙනු නොමැත</p>
            </div>`;
        return;
    }
    
    recentListDiv.innerHTML = recentRecords.map(record => `
        <div class="recent-item">
            <div class="recent-info">
                <strong>${record.vehicle}</strong>
                <span>${record.customer}</span>
                <small>${formatDate(record.date)}</small>
            </div>
            <div class="recent-amount">
                <strong>${formatCurrency(record.total)}</strong>
                <span class="status-badge ${record.status}">
                    ${getStatusLabel(record.status).text}
                </span>
            </div>
        </div>
    `).join('');
}

// ===== HISTORY MANAGEMENT =====
function loadHistory(recordsToShow = records) {
    filteredRecords = recordsToShow;
    
    // Update summary
    const totalAmount = recordsToShow.reduce((sum, r) => sum + r.total, 0);
    const totalBalance = recordsToShow.reduce((sum, r) => sum + r.balance, 0);
    
    document.getElementById("historyCount").textContent = recordsToShow.length;
    document.getElementById("historyTotal").textContent = formatCurrency(totalAmount);
    document.getElementById("historyBalance").textContent = formatCurrency(totalBalance);
    
    // Clear current list
    historyListDiv.innerHTML = '';
    
    if (recordsToShow.length === 0) {
        historyListDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>ගනුදෙනු හමු නොවීය</p>
                <button onclick="showTab('add')" class="action-btn">
                    <i class="fas fa-plus"></i> පළමු ගනුදෙනුව එක් කරන්න
                </button>
            </div>`;
        return;
    }
    
    // Display records
    recordsToShow.forEach(record => {
        const status = getStatusLabel(record.status);
        
        historyListDiv.innerHTML += `
            <div class="card ${record.status}">
                <div class="card-header">
                    <h3>${record.vehicle}</h3>
                    <span class="invoice-no">${record.invoiceNo}</span>
                </div>
                <div class="card-body">
                    <p><i class="fas fa-user"></i> ${record.customer}</p>
                    <p><i class="fas fa-phone"></i> ${record.phone}</p>
                    <p><i class="fas fa-calendar"></i> ${formatDate(record.date)}</p>
                    <div class="amounts">
                        <div class="amount-item">
                            <span>මුළු:</span>
                            <strong>${formatCurrency(record.total)}</strong>
                        </div>
                        <div class="amount-item">
                            <span>ගෙවා ඇත:</span>
                            <strong>${formatCurrency(record.paid)}</strong>
                        </div>
                        <div class="amount-item">
                            <span>ශේෂය:</span>
                            <strong class="balance">${formatCurrency(record.balance)}</strong>
                        </div>
                    </div>
                    <div class="status-badge" style="background: ${status.color}">
                        ${status.text}
                    </div>
                </div>
                <div class="card-actions">
                    <button onclick="editRecord(${record.id})" class="btn-edit">
                        <i class="fas fa-edit"></i> සංස්කරණය
                    </button>
                    <button onclick="showInvoice(${record.id})" class="btn-view">
                        <i class="fas fa-eye"></i> බලන්න
                    </button>
                    <button onclick="deleteRecord(${record.id})" class="btn-delete">
                        <i class="fas fa-trash"></i> මකන්න
                    </button>
                </div>
            </div>`;
    });
}

function filterHistory(filter) {
    activeFilter = filter;
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    let filtered = records;
    if (filter !== 'all') {
        filtered = records.filter(r => r.status === filter);
    }
    
    loadHistory(filtered);
}

function search(query) {
    query = query.toLowerCase().trim();
    
    if (!query) {
        loadHistory(records);
        return;
    }
    
    const filtered = records.filter(record =>
        record.vehicle.toLowerCase().includes(query) ||
        record.phone.includes(query) ||
        record.invoiceNo.toLowerCase().includes(query) ||
        record.customer.toLowerCase().includes(query) ||
        (record.address && record.address.toLowerCase().includes(query))
    );
    
    loadHistory(filtered);
}

function editRecord(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;
    
    editId = id;
    showTab('add');
    
    // Fill form fields
    dateInput.value = record.date;
    customerInput.value = record.customer;
    addressInput.value = record.address || '';
    phoneInput.value = record.phone;
    vehicleNoInput.value = record.vehicle;
    vehicleTypeInput.value = record.vehicleType || '';
    engineTypeInput.value = record.engineType || '';
    engineNoInput.value = record.engineNo || '';
    mileageInput.value = record.mileage || '';
    labourInput.value = record.labour;
    paidInput.value = record.paid;
    paymentTypeSelect.value = record.paymentType;
    
    // Fill jobs
    jobsListDiv.innerHTML = '';
    record.jobs.forEach(job => addJob(job.name, job.price));
    
    // Fill parts
    partsListDiv.innerHTML = '';
    record.parts.forEach(part => addPart(part.partNo, part.name, part.quantity, part.price));
    
    // Handle cheque details
    if (record.paymentType === 'Cheque' && record.cheque) {
        chequeNoInput.value = record.cheque.no || '';
        bankNameInput.value = record.cheque.bank || '';
        chequeDateInput.value = record.cheque.date || '';
        chequeStatusSelect.value = record.cheque.status || 'Pending';
    }
    
    toggleCheque();
    showNotification("ගනුදෙනුව සංස්කරණය සඳහා පූරණය කරන ලදී", "info");
}

function deleteRecord(id) {
    if (!confirm("ඔබට මෙම ගනුදෙනුව මැකීමට අවශ්‍යද?")) return;
    
    records = records.filter(r => r.id !== id);
    localStorage.setItem("records", JSON.stringify(records));
    
    // Reload current view
    if (activeFilter === 'all') {
        loadHistory(records);
    } else {
        filterHistory(activeFilter);
    }
    
    showNotification("ගනුදෙනුව සාර්ථකව මකා දමන ලදී", "success");
}

// ===== INVOICE FUNCTIONS =====
function showInvoice(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;
    
    const status = getStatusLabel(record.status);
    
    invoiceContentDiv.innerHTML = `
        <div class="invoice-preview">
            <div class="invoice-header">
                <div class="invoice-title">
                    <h2><i class="fas fa-receipt"></i> ඉන්වොයිස්</h2>
                    <div class="invoice-meta">
                        <span><strong>ඉන්වොයිස් අංකය:</strong> ${record.invoiceNo}</span>
                        <span><strong>දිනය:</strong> ${formatDate(record.date)}</span>
                    </div>
                </div>
                <div class="company-info">
                    <h3>Kumar Garage</h3>
                    <p>Asirigama, Sirambiadiya, Puttalam</p>
                    <p>📞 0723388590</p>
                </div>
            </div>
            
            <div class="invoice-body">
                <div class="customer-info">
                    <h4><i class="fas fa-user"></i> ගැනුම්කරු විස්තර</h4>
                    <p><strong>නම:</strong> ${record.customer}</p>
                    <p><strong>ලිපිනය:</strong> ${record.address || 'නොමැත'}</p>
                    <p><strong>දුරකථන:</strong> ${record.phone}</p>
                </div>
                
                <div class="vehicle-info">
                    <h4><i class="fas fa-car"></i> වාහන විස්තර</h4>
                    <p><strong>වාහන අංකය:</strong> ${record.vehicle}</p>
                    <p><strong>වාහන වර්ගය:</strong> ${record.vehicleType || 'නොමැත'}</p>
                    <p><strong>එන්ජිම වර්ගය:</strong> ${record.engineType || 'නොමැත'}</p>
                    <p><strong>එන්ජිම අංකය:</strong> ${record.engineNo || 'නොමැත'}</p>
                    <p><strong>කි.මී.:</strong> ${record.mileage || 'නොමැත'}</p>
                </div>
                
                ${record.jobs.length > 0 ? `
                <div class="jobs-section">
                    <h4><i class="fas fa-tools"></i> කරන ලද වැඩ</h4>
                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th>වැඩෙහි නම</th>
                                <th>මිල (රුපියල්)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${record.jobs.map(job => `
                                <tr>
                                    <td>${job.name}</td>
                                    <td>${formatCurrency(job.price)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td><strong>වැඩ සඳහා මුළු:</strong></td>
                                <td><strong>${formatCurrency(record.jobs.reduce((sum, j) => sum + j.price, 0))}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>` : ''}
                
                ${record.parts.length > 0 ? `
                <div class="parts-section">
                    <h4><i class="fas fa-cogs"></i> භාවිතා කළ කොටස්</h4>
                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th>කොටස් අංකය</th>
                                <th>නම</th>
                                <th>ප්‍රමාණය</th>
                                <th>ඒකක මිල</th>
                                <th>මුළු</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${record.parts.map(part => `
                                <tr>
                                    <td>${part.partNo || '-'}</td>
                                    <td>${part.name}</td>
                                    <td>${part.quantity}</td>
                                    <td>${formatCurrency(part.price)}</td>
                                    <td>${formatCurrency(part.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4"><strong>කොටස් සඳහා මුළු:</strong></td>
                                <td><strong>${formatCurrency(record.parts.reduce((sum, p) => sum + p.total, 0))}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>` : ''}
                
                <div class="summary-section">
                    <h4><i class="fas fa-calculator"></i> සාරාංශය</h4>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <span>වැඩ සඳහා මුළු:</span>
                            <span>${formatCurrency(record.jobs.reduce((sum, j) => sum + j.price, 0))}</span>
                        </div>
                        <div class="summary-item">
                            <span>කොටස් සඳහා මුළු:</span>
                            <span>${formatCurrency(record.parts.reduce((sum, p) => sum + p.total, 0))}</span>
                        </div>
                        <div class="summary-item">
                            <span>කම්කරු ගාස්තු:</span>
                            <span>${formatCurrency(record.labour)}</span>
                        </div>
                        <div class="summary-item total">
                            <span><strong>මුළු ගාස්තු:</strong></span>
                            <span><strong>${formatCurrency(record.total)}</strong></span>
                        </div>
                        <div class="summary-item">
                            <span>ගෙවූ මුදල:</span>
                            <span>${formatCurrency(record.paid)}</span>
                        </div>
                        <div class="summary-item balance">
                            <span><strong>ශේෂය:</strong></span>
                            <span><strong>${formatCurrency(record.balance)}</strong></span>
                        </div>
                    </div>
                </div>
                
                <div class="payment-info">
                    <h4><i class="fas fa-money-bill-wave"></i> ගෙවීම් විස්තර</h4>
                    <p><strong>ගෙවීම් විලාසය:</strong> ${record.paymentType}</p>
                    ${record.paymentType === 'Cheque' && record.cheque ? `
                        <p><strong>චෙක්පත් අංකය:</strong> ${record.cheque.no}</p>
                        <p><strong>බැංකුව:</strong> ${record.cheque.bank}</p>
                        <p><strong>චෙක්පත් දිනය:</strong> ${formatDate(record.cheque.date)}</p>
                        <p><strong>තත්ත්වය:</strong> ${record.cheque.status === 'Cleared' ? 'පිරිසිදු කරන ලදී' : 'පැහැරී ඇත'}</p>
                    ` : ''}
                    <div class="status-display" style="background: ${status.color}">
                        ${status.text}
                    </div>
                </div>
            </div>
            
            <div class="invoice-footer">
                <div class="footer-actions">
                    <button onclick="generatePDF(${record.id})" class="btn-download">
                        <i class="fas fa-download"></i> PDF බාගන්න
                    </button>
                    <button onclick="printInvoice()" class="btn-print">
                        <i class="fas fa-print"></i> මුද්‍රණය
                    </button>
                    <button onclick="closeInvoice()" class="btn-close">
                        <i class="fas fa-times"></i> වසන්න
                    </button>
                </div>
                <div class="footer-note">
                    <p><i class="fas fa-info-circle"></i> සටහන: කරුණාකර මෙම ඉන්වොයිස් අංකය යොමු කර ගැනීමට සැලකිලිමත් වන්න.</p>
                </div>
            </div>
        </div>
    `;
    
    invoiceDiv.classList.remove("hidden");
}

function closeInvoice() {
    invoiceDiv.classList.add("hidden");
}

function printInvoice() {
    const printContent = invoiceContentDiv.innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    showTab('history');
}

function generatePDF(id) {
    const record = typeof id === 'number' ? records.find(r => r.id === id) : id;
    if (!record) return;
    
    const pdf = new jsPDF();
    let y = 20;
    
    // Header
    pdf.setFontSize(20);
    pdf.setTextColor(0, 123, 255);
    pdf.text("Kumar Garage", 105, y, { align: 'center' });
    y += 8;
    
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text("Asirigama, Sirambiadiya, Puttalam", 105, y, { align: 'center' });
    y += 5;
    pdf.text("📞 0723388590", 105, y, { align: 'center' });
    y += 15;
    
    // Invoice Info
    pdf.setDrawColor(200, 200, 200);
    pdf.line(10, y, 200, y);
    y += 10;
    
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text("INVOICE", 10, y);
    y += 8;
    
    pdf.setFontSize(10);
    pdf.text(`Invoice No: ${record.invoiceNo}`, 10, y);
    pdf.text(`Date: ${record.date}`, 150, y);
    y += 10;
    
    // Customer Info
    pdf.setFontSize(12);
    pdf.text("Customer Details:", 10, y);
    y += 7;
    
    pdf.setFontSize(10);
    pdf.text(`Name: ${record.customer}`, 15, y);
    y += 5;
    pdf.text(`Address: ${record.address || 'N/A'}`, 15, y);
    y += 5;
    pdf.text(`Phone: ${record.phone}`, 15, y);
    y += 10;
    
    // Vehicle Info
    pdf.setFontSize(12);
    pdf.text("Vehicle Details:", 10, y);
    y += 7;
    
    pdf.setFontSize(10);
    pdf.text(`Vehicle No: ${record.vehicle}`, 15, y);
    y += 5;
    pdf.text(`Vehicle Type: ${record.vehicleType || 'N/A'}`, 15, y);
    y += 5;
    pdf.text(`Engine: ${record.engineType || 'N/A'} | ${record.engineNo || 'N/A'}`, 15, y);
    y += 10;
    
    // Jobs
    if (record.jobs.length > 0) {
        pdf.setFontSize(12);
        pdf.text("Jobs Performed:", 10, y);
        y += 7;
        
        pdf.setFontSize(10);
        record.jobs.forEach(job => {
            pdf.text(`• ${job.name} - ${formatCurrency(job.price)}`, 15, y);
            y += 5;
        });
        y += 5;
    }
    
    // Parts
    if (record.parts.length > 0) {
        pdf.setFontSize(12);
        pdf.text("Parts Used:", 10, y);
        y += 7;
        
        pdf.setFontSize(10);
        record.parts.forEach(part => {
            pdf.text(`• ${part.name} x${part.quantity} = ${formatCurrency(part.total)}`, 15, y);
            y += 5;
        });
        y += 5;
    }
    
    // Summary
    pdf.setDrawColor(200, 200, 200);
    pdf.line(10, y, 200, y);
    y += 10;
    
    const jobsTotal = record.jobs.reduce((sum, j) => sum + j.price, 0);
    const partsTotal = record.parts.reduce((sum, p) => sum + p.total, 0);
    
    pdf.text(`Jobs Total: ${formatCurrency(jobsTotal)}`, 150, y);
    y += 5;
    pdf.text(`Parts Total: ${formatCurrency(partsTotal)}`, 150, y);
    y += 5;
    pdf.text(`Labour: ${formatCurrency(record.labour)}`, 150, y);
    y += 5;
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text(`Total: ${formatCurrency(record.total)}`, 150, y);
    y += 7;
    pdf.text(`Paid: ${formatCurrency(record.paid)}`, 150, y);
    y += 7;
    pdf.text(`Balance: ${formatCurrency(record.balance)}`, 150, y);
    
    // Status
    y += 15;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Status: ${getStatusLabel(record.status).text.replace(/[✅🟡❌🟠]/g, '')}`, 10, y);
    
    // Payment Type
    y += 5;
    pdf.text(`Payment Type: ${record.paymentType}`, 10, y);
    
    if (record.paymentType === 'Cheque' && record.cheque) {
        y += 5;
        pdf.text(`Cheque No: ${record.cheque.no}`, 10, y);
        y += 5;
        pdf.text(`Bank: ${record.cheque.bank}`, 10, y);
        y += 5;
        pdf.text(`Cheque Date: ${record.cheque.date}`, 10, y);
        y += 5;
        pdf.text(`Cheque Status: ${record.cheque.status}`, 10, y);
    }
    
    // Footer
    y = 280;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(10, y, 200, y);
    y += 10;
    
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text("Thank you for your business!", 105, y, { align: 'center' });
    y += 5;
    pdf.text("For any queries, contact: 0723388590", 105, y, { align: 'center' });
    
    // Save PDF
    pdf.save(`${record.invoiceNo}.pdf`);
    showNotification("PDF සාර්ථකව බාගත කරන ලදී", "success");
}

// ===== ANALYTICS FUNCTIONS =====
function loadAnalytics() {
    if (records.length === 0) {
        document.getElementById('analytics').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <h3>දත්ත නොමැත</h3>
                <p>විශ්ලේෂණය කිරීමට දත්ත නොමැත</p>
                <button onclick="showTab('add')" class="action-btn">
                    <i class="fas fa-plus"></i> පළමු ගනුදෙනුව එක් කරන්න
                </button>
            </div>`;
        return;
    }
    
    // Update stats
    const totalRevenue = records.reduce((sum, r) => sum + r.total, 0);
    const totalBalance = records.reduce((sum, r) => sum + r.balance, 0);
    const uniqueCustomers = [...new Set(records.map(r => r.phone))].length;
    
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
    document.getElementById('customerCount').textContent = uniqueCustomers;
    document.getElementById('transactionCount').textContent = records.length;
    
    // Render charts
    renderMonthlyChart();
    renderPaymentChart();
    loadTopCustomers();
    loadRecentSummary();
}

function renderMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;
    
    // Calculate monthly revenue
    const monthlyData = {};
    records.forEach(record => {
        const month = record.date.substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + record.total;
    });
    
    // Sort months
    const months = Object.keys(monthlyData).sort();
    const revenue = months.map(m => monthlyData[m]);
    
    // Format month labels
    const monthNames = ['ජන', 'පෙබ', 'මාර්', 'අප්‍රේ', 'මැයි', 'ජුනි', 
                       'ජූලි', 'අගෝ', 'සැප්', 'ඔක්', 'නොවැ', 'දෙසැ'];
    
    const labels = months.map(m => {
        const [year, month] = m.split('-');
        return `${monthNames[parseInt(month)-1]} ${year}`;
    });
    
    // Create chart
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'මාසික ආදායම (රුපියල්)',
                data: revenue,
                backgroundColor: 'rgba(0, 123, 255, 0.7)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `රු. ${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'රු. ' + value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderPaymentChart() {
    const ctx = document.getElementById('paymentChart');
    if (!ctx) return;
    
    // Count by status
    const statusCounts = {
        'ගෙවා ඇත': records.filter(r => r.status === 'paid').length,
        'අර්ධ': records.filter(r => r.status === 'partial').length,
        'පැහැරී ඇත': records.filter(r => r.status === 'pending').length,
        'චෙක්පත්': records.filter(r => r.status === 'cheque_pending').length
    };
    
    // Create chart
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    'rgba(40, 167, 69, 0.8)',
                    'rgba(255, 193, 7, 0.8)',
                    'rgba(220, 53, 69, 0.8)',
                    'rgba(253, 126, 20, 0.8)'
                ],
                borderColor: [
                    'rgba(40, 167, 69, 1)',
                    'rgba(255, 193, 7, 1)',
                    'rgba(220, 53, 69, 1)',
                    'rgba(253, 126, 20, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function loadTopCustomers() {
    const container = document.getElementById('topCustomers');
    if (!container) return;
    
    // Group by customer
    const customerMap = {};
    records.forEach(record => {
        if (!record.phone) return;
        
        const key = record.phone;
        if (!customerMap[key]) {
            customerMap[key] = {
                name: record.customer,
                phone: record.phone,
                totalSpent: 0,
                transactionCount: 0,
                lastVisit: record.date
            };
        }
        
        customerMap[key].totalSpent += record.total;
        customerMap[key].transactionCount++;
        
        if (record.date > customerMap[key].lastVisit) {
            customerMap[key].lastVisit = record.date;
        }
    });
    
    // Sort by total spent
    const topCustomers = Object.values(customerMap)
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);
    
    if (topCustomers.length === 0) {
        container.innerHTML = '<p>දත්ත නොමැත</p>';
        return;
    }
    
    container.innerHTML = topCustomers.map((customer, index) => `
        <div class="customer-item-small">
            <div class="customer-rank">
                <span class="rank-badge">${index + 1}</span>
                <div class="customer-info">
                    <strong>${customer.name}</strong>
                    <small>${customer.phone}</small>
                </div>
            </div>
            <div class="customer-stats">
                <span class="amount">${formatCurrency(customer.totalSpent)}</span>
                <small>ගනුදෙනු: ${customer.transactionCount}</small>
            </div>
        </div>
    `).join('');
}

function loadRecentSummary() {
    const container = document.getElementById('recentSummary');
    if (!container) return;
    
    // Get last 30 days records
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRecords = records.filter(r => new Date(r.date) >= thirtyDaysAgo);
    
    if (recentRecords.length === 0) {
        container.innerHTML = '<p>මෑත දින 30 තුළ ගනුදෙනු නොමැත</p>';
        return;
    }
    
    const recentRevenue = recentRecords.reduce((sum, r) => sum + r.total, 0);
    const recentCount = recentRecords.length;
    
    container.innerHTML = `
        <div class="summary-cards">
            <div class="summary-card">
                <h4>මෑත දින 30</h4>
                <p class="summary-value">${formatCurrency(recentRevenue)}</p>
                <p class="summary-label">මුළු ආදායම</p>
            </div>
            <div class="summary-card">
                <h4>මෑත දින 30</h4>
                <p class="summary-value">${recentCount}</p>
                <p class="summary-label">ගනුදෙනු</p>
            </div>
            <div class="summary-card">
                <h4>දිනපතා සාමාන්‍ය</h4>
                <p class="summary-value">${formatCurrency(recentRevenue / 30)}</p>
                <p class="summary-label">ආදායම</p>
            </div>
        </div>
    `;
}

// ===== CUSTOMERS FUNCTIONS =====
function loadCustomers() {
    const container = document.getElementById('customersList');
    if (!container) return;
    
    // Group by customer
    const customerMap = {};
    records.forEach(record => {
        if (!record.phone) return;
        
        const key = record.phone;
        if (!customerMap[key]) {
            customerMap[key] = {
                name: record.customer,
                phone: record.phone,
                address: record.address || '',
                vehicles: new Set(),
                totalSpent: 0,
                totalBalance: 0,
                transactionCount: 0,
                lastVisit: record.date,
                firstVisit: record.date
            };
        }
        
        customerMap[key].vehicles.add(record.vehicle);
        customerMap[key].totalSpent += record.total;
        customerMap[key].totalBalance += record.balance;
        customerMap[key].transactionCount++;
        
        if (record.date > customerMap[key].lastVisit) {
            customerMap[key].lastVisit = record.date;
        }
        if (record.date < customerMap[key].firstVisit) {
            customerMap[key].firstVisit = record.date;
        }
    });
    
    const customers = Object.values(customerMap)
        .sort((a, b) => b.totalSpent - a.totalSpent);
    
    // Update stats
    document.getElementById('activeCustomers').textContent = customers.length;
    
    // Calculate monthly revenue
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthlyRevenue = records
        .filter(r => r.date.startsWith(currentMonth))
        .reduce((sum, r) => sum + r.total, 0);
    document.getElementById('monthlyRevenue').textContent = formatCurrency(monthlyRevenue);
    
    if (customers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>ගැනුම්කරුවන් නොමැත</h3>
                <p>තවම ගැනුම්කරුවන් ලියාපදිංචි කර නැත</p>
            </div>`;
        return;
    }
    
    container.innerHTML = customers.map(customer => `
        <div class="customer-card">
            <div class="customer-header">
                <h4>${customer.name}</h4>
                <span class="customer-phone">${customer.phone}</span>
            </div>
            
            <div class="customer-details">
                <p><i class="fas fa-map-marker-alt"></i> ${customer.address || 'ලිපිනය නොමැත'}</p>
                <p><i class="fas fa-car"></i> වාහන: ${Array.from(customer.vehicles).join(', ') || 'නොමැත'}</p>
                
                <div class="customer-stats-grid">
                    <div class="stat-item">
                        <span>මුළු වියදම:</span>
                        <strong>${formatCurrency(customer.totalSpent)}</strong>
                    </div>
                    <div class="stat-item">
                        <span>ශේෂය:</span>
                        <strong>${formatCurrency(customer.totalBalance)}</strong>
                    </div>
                    <div class="stat-item">
                        <span>ගනුදෙනු:</span>
                        <strong>${customer.transactionCount}</strong>
                    </div>
                    <div class="stat-item">
                        <span>අවසන් නැවතුම:</span>
                        <strong>${formatDate(customer.lastVisit)}</strong>
                    </div>
                </div>
            </div>
            
            <div class="customer-actions">
                <button onclick="viewCustomerHistory('${customer.phone}')">
                    <i class="fas fa-history"></i> ඉතිහාසය
                </button>
                <button onclick="contactCustomer('${customer.phone}')">
                    <i class="fas fa-phone"></i> අමතන්න
                </button>
            </div>
        </div>
    `).join('');
}

function searchCustomers(query) {
    const container = document.getElementById('customersList');
    if (!container) return;
    
    query = query.toLowerCase().trim();
    
    // Get all customers
    const customerMap = {};
    records.forEach(record => {
        if (!record.phone) return;
        
        const key = record.phone;
        if (!customerMap[key]) {
            customerMap[key] = {
                name: record.customer,
                phone: record.phone,
                address: record.address || '',
                vehicles: new Set(),
                totalSpent: 0,
                totalBalance: 0,
                transactionCount: 0,
                lastVisit: record.date
            };
        }
        
        customerMap[key].vehicles.add(record.vehicle);
        customerMap[key].totalSpent += record.total;
        customerMap[key].totalBalance += record.balance;
        customerMap[key].transactionCount++;
        
        if (record.date > customerMap[key].lastVisit) {
            customerMap[key].lastVisit = record.date;
        }
    });
    
    // Filter customers
    let customers = Object.values(customerMap);
    
    if (query) {
        customers = customers.filter(customer =>
            customer.name.toLowerCase().includes(query) ||
            customer.phone.includes(query) ||
            customer.address.toLowerCase().includes(query) ||
            Array.from(customer.vehicles).some(v => v.toLowerCase().includes(query))
        );
    }
    
    customers = customers.sort((a, b) => b.totalSpent - a.totalSpent);
    
    // Update display
    if (customers.length === 0) {
        container.innerHTML = '<p>ගැනුම්කරුවන් හමු නොවීය</p>';
        return;
    }
    
    container.innerHTML = customers.map(customer => `
        <div class="customer-card">
            <h4>${customer.name}</h4>
            <p><i class="fas fa-phone"></i> ${customer.phone}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${customer.address || 'ලිපිනය නොමැත'}</p>
            <p><i class="fas fa-money-bill-wave"></i> මුළු වියදම: ${formatCurrency(customer.totalSpent)}</p>
            <p><i class="fas fa-scale-balanced"></i> ශේෂය: ${formatCurrency(customer.totalBalance)}</p>
            <p><i class="fas fa-car"></i> වාහන: ${Array.from(customer.vehicles).join(', ') || 'නොමැත'}</p>
            <div class="customer-actions">
                <button onclick="viewCustomerHistory('${customer.phone}')">
                    <i class="fas fa-history"></i> ඉතිහාසය
                </button>
            </div>
        </div>
    `).join('');
}

function viewCustomerHistory(phone) {
    const customerRecords = records.filter(r => r.phone === phone);
    loadHistory(customerRecords);
    showTab('history');
}

function contactCustomer(phone) {
    window.open(`tel:${phone}`, '_blank');
}

// ===== EXPORT/IMPORT FUNCTIONS =====
function exportExcel() {
    if (records.length === 0) {
        showNotification("අපනයනය කිරීමට දත්ත නොමැත", "warning");
        return;
    }
    
    const data = (filteredRecords.length > 0 ? filteredRecords : records).map(record => ({
        'ඉන්වොයිස් අංකය': record.invoiceNo,
        'දිනය': record.date,
        'ගැනුම්කරු': record.customer,
        'දුරකථන': record.phone,
        'වාහන අංකය': record.vehicle,
        'වාහන වර්ගය': record.vehicleType,
        'මුළු ගාස්තු': record.total,
        'ගෙවූ මුදල': record.paid,
        'ශේෂය': record.balance,
        'තත්ත්වය': record.status,
        'ගෙවීම් විලාසය': record.paymentType
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ගරේජ්_ගනුදෙනු");
    XLSX.writeFile(wb, `Kumar_Garage_${new Date().toISOString().slice(0,10)}.xlsx`);
    
    showNotification("Excel ගොනුව සාර්ථකව බාගත කරන ලදී", "success");
}

function exportBackup() {
    if (records.length === 0) {
        showNotification("උපස්ථ ගැනීමට දත්ත නොමැත", "warning");
        return;
    }
    
    const backupData = {
        records: records,
        exportDate: new Date().toISOString(),
        totalRecords: records.length,
        totalRevenue: records.reduce((sum, r) => sum + r.total, 0)
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `garage_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification("උපස්ථය සාර්ථකව බාගත කරන ලදී", "success");
}

function importBackup(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            if (!backupData.records || !Array.isArray(backupData.records)) {
                throw new Error("වලංගු උපස්ථ ගොනුවක් නොවේ");
            }
            
            if (confirm(`උපස්ථයෙන් ${backupData.records.length} ගනුදෙනු ආයාත කිරීමට අවශ්‍යද?`)) {
                records = backupData.records;
                localStorage.setItem("records", JSON.stringify(records));
                loadHistory(records);
                showNotification("උපස්ථය සාර්ථකව ආයාත කරන ලදී", "success");
            }
        } catch (error) {
            showNotification("උපස්ථ ගොනුව පූරණය කිරීමේ දෝෂයකි: " + error.message, "error");
        }
        
        // Reset file input
        input.value = '';
    };
    reader.readAsText(file);
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type = "info") {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Show with animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        color: #333;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 350px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left: 4px solid #28a745;
        background: #d4edda;
        color: #155724;
    }
    
    .notification.error {
        border-left: 4px solid #dc3545;
        background: #f8d7da;
        color: #721c24;
    }
    
    .notification.info {
        border-left: 4px solid #17a2b8;
        background: #d1ecf1;
        color: #0c5460;
    }
    
    .notification.warning {
        border-left: 4px solid #ffc107;
        background: #fff3cd;
        color: #856404;
    }
    
    .notification button {
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
    }
    
    body.dark .notification {
        background: #2d2d2d;
        color: #e0e0e0;
    }
    
    body.dark .notification.success {
        background: rgba(40, 167, 69, 0.2);
    }
    
    body.dark .notification.error {
        background: rgba(220, 53, 69, 0.2);
    }
    
    body.dark .notification.info {
        background: rgba(23, 162, 184, 0.2);
    }
    
    body.dark .notification.warning {
        background: rgba(255, 193, 7, 0.2);
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #6c757d;
    }
    
    .empty-state i {
        font-size: 48px;
        margin-bottom: 15px;
        opacity: 0.5;
    }
    
    .empty-state h3 {
        margin: 10px 0;
        color: #495057;
    }
    
    body.dark .empty-state {
        color: #aaa;
    }
    
    body.dark .empty-state h3 {
        color: #e0e0e0;
    }
    
    body.dark .empty-state p {
        color: #aaa;
    }
    
    .action-btn {
        display: inline-block;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: var(--transition);
        text-decoration: none;
        text-align: center;
    }
    
    .action-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 123, 255, 0.3);
    }
`;
document.head.appendChild(style);

// ===== INITIALIZATION =====
// Initialize the app
showTab("home");

// Check for pending payments reminder
function checkPendingPayments() {
    if (records.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    const pendingCheques = records.filter(r => 
        r.paymentType === "Cheque" && 
        r.cheque && 
        r.cheque.status === "Pending" &&
        r.cheque.date &&
        r.cheque.date <= today
    );
    
    if (pendingCheques.length > 0) {
        showNotification(`🔄 චෙක්පත් ${pendingCheques.length}ක් ගෙවීමට ඉතිරිව ඇත!`, "warning");
    }
}

// Check after 3 seconds
setTimeout(checkPendingPayments, 3000);