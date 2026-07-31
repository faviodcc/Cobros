const STORAGE_KEY = "cobranza_escolar_students_v1";
const SETTINGS_KEY = "cobranza_escolar_settings_v1";

const defaultTemplate = `Hola, Sr(a). {apoderado}. Le escribimos de {colegio} para recordarle que el alumno(a) {alumno} mantiene una deuda pendiente de S/ {monto}, correspondiente a la mensualidad de {mes}.

Fecha de vencimiento: {vencimiento}.

Agradecemos regularizar el pago. Si ya realizó el abono, por favor ignore este mensaje y envíenos la constancia. Muchas gracias.`;

const demoStudents = [
  {
    id: crypto.randomUUID(),
    firstName: "Valentina",
    lastName: "Ramos Pérez",
    dni: "74581236",
    grade: "3ro A",
    guardian: "María Pérez",
    phone: "987654321",
    email: "maria@example.com",
    month: "Julio 2026",
    amount: 450,
    dueDate: "2026-07-15",
    paid: false,
    notes: "Llamar por la tarde"
  },
  {
    id: crypto.randomUUID(),
    firstName: "Diego",
    lastName: "Salazar Torres",
    dni: "75236981",
    grade: "5to B",
    guardian: "José Salazar",
    phone: "965432187",
    email: "",
    month: "Julio 2026",
    amount: 0,
    dueDate: "2026-07-15",
    paid: true,
    notes: ""
  },
  {
    id: crypto.randomUUID(),
    firstName: "Luciana",
    lastName: "Gómez Flores",
    dni: "73698521",
    grade: "1ro C",
    guardian: "Claudia Flores",
    phone: "912345678",
    email: "claudia@example.com",
    month: "Julio 2026",
    amount: 520,
    dueDate: "2026-08-05",
    paid: false,
    notes: ""
  }
];

let students = loadStudents();
let settings = loadSettings();
let toastTimer;

const elements = {
  tableBody: document.getElementById("studentsTableBody"),
  emptyState: document.getElementById("emptyState"),
  searchInput: document.getElementById("searchInput"),
  gradeFilter: document.getElementById("gradeFilter"),
  statusFilter: document.getElementById("statusFilter"),
  studentModal: document.getElementById("studentModal"),
  settingsModal: document.getElementById("settingsModal"),
  studentForm: document.getElementById("studentForm"),
  settingsForm: document.getElementById("settingsForm"),
  toast: document.getElementById("toast"),
  sidebar: document.getElementById("sidebar")
};

function loadStudents() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoStudents));
    return demoStudents;
  }

  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  const defaults = {
    schoolName: "Mi Colegio",
    template: defaultTemplate
  };

  if (!saved) return defaults;

  try {
    return { ...defaults, ...JSON.parse(saved) };
  } catch {
    return defaults;
  }
}

function saveStudents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN"
  }).format(Number(value || 0));
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStatus(student) {
  if (student.paid || Number(student.amount) <= 0) {
    return { key: "pagado", label: "Al día", className: "paid" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${student.dueDate}T00:00:00`);

  if (dueDate < today) {
    return { key: "vencido", label: "Vencido", className: "overdue" };
  }

  return { key: "pendiente", label: "Pendiente", className: "pending" };
}

function render() {
  renderGrades();
  renderStats();
  renderTable();
}

function renderStats() {
  const pending = students.filter((student) => !student.paid && Number(student.amount) > 0);
  const paid = students.filter((student) => student.paid || Number(student.amount) <= 0);
  const debt = pending.reduce((total, student) => total + Number(student.amount || 0), 0);

  document.getElementById("statStudents").textContent = students.length;
  document.getElementById("statPending").textContent = pending.length;
  document.getElementById("statDebt").textContent = formatMoney(debt);
  document.getElementById("statPaid").textContent = paid.length;
}

function renderGrades() {
  const selected = elements.gradeFilter.value;
  const grades = [...new Set(students.map((student) => student.grade.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));

  elements.gradeFilter.innerHTML = '<option value="">Todos los grados</option>';
  grades.forEach((grade) => {
    const option = document.createElement("option");
    option.value = grade;
    option.textContent = grade;
    elements.gradeFilter.appendChild(option);
  });
  elements.gradeFilter.value = grades.includes(selected) ? selected : "";
}

function getFilteredStudents() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const grade = elements.gradeFilter.value;
  const status = elements.statusFilter.value;

  return students.filter((student) => {
    const studentStatus = getStatus(student).key;
    const searchable = [
      student.firstName,
      student.lastName,
      student.dni,
      student.grade,
      student.guardian,
      student.phone,
      student.email,
      student.month
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = !query || searchable.includes(query);
    const matchesGrade = !grade || student.grade === grade;
    const matchesStatus = !status || studentStatus === status;
    return matchesQuery && matchesGrade && matchesStatus;
  });
}

function renderTable() {
  const filtered = getFilteredStudents();
  elements.tableBody.innerHTML = "";

  elements.emptyState.classList.toggle("hidden", filtered.length > 0);
  document.querySelector(".table-wrap").classList.toggle("hidden", filtered.length === 0);

  filtered.forEach((student) => {
    const status = getStatus(student);
    const row = document.createElement("tr");
    const fullName = `${student.firstName} ${student.lastName}`.trim();

    row.innerHTML = `
      <td>
        <span class="student-name">${escapeHtml(fullName)}</span>
        <span class="subtext">DNI: ${escapeHtml(student.dni || "No registrado")}</span>
      </td>
      <td>${escapeHtml(student.grade)}</td>
      <td>
        ${escapeHtml(student.guardian)}
        <span class="subtext">${escapeHtml(student.email || "Sin correo")}</span>
      </td>
      <td>
        ${escapeHtml(student.phone)}
        <span class="subtext">Teléfono del apoderado</span>
      </td>
      <td>
        <span class="amount">${formatMoney(student.amount)}</span>
        <span class="subtext">${escapeHtml(student.month)}</span>
      </td>
      <td>${formatDate(student.dueDate)}</td>
      <td><span class="badge ${status.className}">${status.label}</span></td>
      <td>
        <div class="actions">
          ${status.key !== "pagado" ? `<button class="action-button whatsapp" data-action="whatsapp" data-id="${student.id}">WhatsApp</button>` : ""}
          <button class="action-button" data-action="call" data-id="${student.id}">Llamar</button>
          <button class="action-button" data-action="toggle-paid" data-id="${student.id}">${status.key === "pagado" ? "Marcar deuda" : "Marcar pagado"}</button>
          <button class="action-button" data-action="edit" data-id="${student.id}">Editar</button>
          <button class="action-button danger" data-action="delete" data-id="${student.id}">Eliminar</button>
        </div>
      </td>
    `;

    elements.tableBody.appendChild(row);
  });
}

function openModal(modal) {
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

function resetStudentForm() {
  elements.studentForm.reset();
  document.getElementById("studentId").value = "";
  document.getElementById("studentModalTitle").textContent = "Nuevo alumno";
  document.getElementById("paymentMonth").value = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric"
  }).format(new Date()).replace(/^./, (letter) => letter.toUpperCase());
}

function openNewStudent() {
  resetStudentForm();
  openModal(elements.studentModal);
}

function openEditStudent(id) {
  const student = students.find((item) => item.id === id);
  if (!student) return;

  document.getElementById("studentModalTitle").textContent = "Editar alumno";
  document.getElementById("studentId").value = student.id;
  document.getElementById("studentFirstName").value = student.firstName;
  document.getElementById("studentLastName").value = student.lastName;
  document.getElementById("studentDni").value = student.dni || "";
  document.getElementById("studentGrade").value = student.grade;
  document.getElementById("guardianName").value = student.guardian;
  document.getElementById("guardianPhone").value = student.phone;
  document.getElementById("guardianEmail").value = student.email || "";
  document.getElementById("paymentMonth").value = student.month;
  document.getElementById("debtAmount").value = student.amount;
  document.getElementById("dueDate").value = student.dueDate;
  document.getElementById("notes").value = student.notes || "";
  openModal(elements.studentModal);
}

function validatePhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

function validateDni(value) {
  return !value || /^\d{8}$/.test(value);
}

function normalizeWhatsAppPhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 9) digits = `51${digits}`;
  return digits;
}

function buildMessage(student) {
  const replacements = {
    "{apoderado}": student.guardian,
    "{alumno}": `${student.firstName} ${student.lastName}`.trim(),
    "{monto}": Number(student.amount || 0).toFixed(2),
    "{mes}": student.month,
    "{vencimiento}": formatDate(student.dueDate),
    "{colegio}": settings.schoolName
  };

  let message = settings.template;
  Object.entries(replacements).forEach(([token, value]) => {
    message = message.replaceAll(token, value);
  });
  return message;
}

function openWhatsApp(student) {
  const phone = normalizeWhatsAppPhone(student.phone);
  const message = encodeURIComponent(buildMessage(student));
  window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener,noreferrer");
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  toastTimer = setTimeout(() => elements.toast.classList.add("hidden"), 2800);
}

function exportCsv() {
  const columns = [
    "Nombres",
    "Apellidos",
    "DNI",
    "Grado",
    "Apoderado",
    "Teléfono",
    "Correo",
    "Mensualidad",
    "Monto pendiente",
    "Vencimiento",
    "Estado",
    "Observaciones"
  ];

  const rows = students.map((student) => [
    student.firstName,
    student.lastName,
    student.dni,
    student.grade,
    student.guardian,
    student.phone,
    student.email,
    student.month,
    student.amount,
    student.dueDate,
    getStatus(student).label,
    student.notes
  ]);

  const csv = [columns, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cobranzas-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.getElementById("btnNewStudent").addEventListener("click", openNewStudent);
document.getElementById("btnOpenSettings").addEventListener("click", () => {
  document.getElementById("schoolName").value = settings.schoolName;
  document.getElementById("messageTemplate").value = settings.template;
  openModal(elements.settingsModal);
});

document.getElementById("btnExport").addEventListener("click", exportCsv);
document.getElementById("menuButton").addEventListener("click", () => elements.sidebar.classList.toggle("open"));

elements.searchInput.addEventListener("input", renderTable);
elements.gradeFilter.addEventListener("change", renderTable);
elements.statusFilter.addEventListener("change", renderTable);

elements.studentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = document.getElementById("studentId").value;
  const dni = document.getElementById("studentDni").value.trim();
  const phone = document.getElementById("guardianPhone").value.trim();
  const amount = Number(document.getElementById("debtAmount").value);

  if (!validateDni(dni)) {
    showToast("El DNI debe tener exactamente 8 números.");
    return;
  }

  if (!validatePhone(phone)) {
    showToast("Ingresa un teléfono válido.");
    return;
  }

  if (amount < 0) {
    showToast("El monto pendiente no puede ser negativo.");
    return;
  }

  const existing = students.find((student) => student.id === id);
  const student = {
    id: id || crypto.randomUUID(),
    firstName: document.getElementById("studentFirstName").value.trim(),
    lastName: document.getElementById("studentLastName").value.trim(),
    dni,
    grade: document.getElementById("studentGrade").value.trim(),
    guardian: document.getElementById("guardianName").value.trim(),
    phone,
    email: document.getElementById("guardianEmail").value.trim(),
    month: document.getElementById("paymentMonth").value.trim(),
    amount,
    dueDate: document.getElementById("dueDate").value,
    paid: amount === 0 ? true : (existing?.paid ?? false),
    notes: document.getElementById("notes").value.trim()
  };

  if (id) {
    students = students.map((item) => (item.id === id ? student : item));
    showToast("Datos actualizados correctamente.");
  } else {
    students.unshift(student);
    showToast("Alumno registrado correctamente.");
  }

  saveStudents();
  closeModal(elements.studentModal);
  render();
});

elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  settings = {
    schoolName: document.getElementById("schoolName").value.trim() || "Mi Colegio",
    template: document.getElementById("messageTemplate").value.trim() || defaultTemplate
  };
  saveSettings();
  closeModal(elements.settingsModal);
  showToast("Configuración guardada.");
});

elements.tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const student = students.find((item) => item.id === button.dataset.id);
  if (!student) return;

  switch (button.dataset.action) {
    case "whatsapp":
      openWhatsApp(student);
      break;
    case "call":
      window.location.href = `tel:${student.phone.replace(/\s/g, "")}`;
      break;
    case "toggle-paid":
      student.paid = !student.paid;
      if (student.paid) student.amount = 0;
      saveStudents();
      render();
      showToast(student.paid ? "Pago marcado como cancelado." : "Alumno marcado con deuda.");
      break;
    case "edit":
      openEditStudent(student.id);
      break;
    case "delete":
      if (confirm(`¿Eliminar a ${student.firstName} ${student.lastName}?`)) {
        students = students.filter((item) => item.id !== student.id);
        saveStudents();
        render();
        showToast("Registro eliminado.");
      }
      break;
  }
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => closeModal(document.getElementById(button.dataset.close)));
});

document.querySelectorAll(".modal-backdrop").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(closeModal);
  }
});

render();
