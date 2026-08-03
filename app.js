(() => {
  "use strict";

  const config = window.APP_CONFIG || {};
  const configReady =
    typeof config.SUPABASE_URL === "string" &&
    config.SUPABASE_URL.startsWith("https://") &&
    !config.SUPABASE_URL.includes("PEGA_AQUI") &&
    typeof config.SUPABASE_PUBLISHABLE_KEY === "string" &&
    config.SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !config.SUPABASE_PUBLISHABLE_KEY.includes("PEGA_AQUI");

  const el = {
    loginScreen: document.getElementById("loginScreen"),
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginButton: document.getElementById("loginButton"),
    loginMessage: document.getElementById("loginMessage"),
    setupAlert: document.getElementById("setupAlert"),
    appShell: document.getElementById("appShell"),
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    sidebarClose: document.getElementById("sidebarClose"),
    menuButton: document.getElementById("menuButton"),
    userEmail: document.getElementById("userEmail"),
    logoutButton: document.getElementById("logoutButton"),
    settingsButton: document.getElementById("settingsButton"),
    newStudentButton: document.getElementById("newStudentButton"),
    exportButton: document.getElementById("exportButton"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    contactFilter: document.getElementById("contactFilter"),
    selectAllCheckbox: document.getElementById("selectAllCheckbox"),
    selectVisibleButton: document.getElementById("selectVisibleButton"),
    clearSelectionButton: document.getElementById("clearSelectionButton"),
    sendSelectedButton: document.getElementById("sendSelectedButton"),
    selectedCount: document.getElementById("selectedCount"),
    studentsBody: document.getElementById("studentsBody"),
    tableWrap: document.getElementById("tableWrap"),
    emptyState: document.getElementById("emptyState"),
    studentModal: document.getElementById("studentModal"),
    studentModalTitle: document.getElementById("studentModalTitle"),
    studentForm: document.getElementById("studentForm"),
    studentId: document.getElementById("studentId"),
    studentName: document.getElementById("studentName"),
    motherPhone: document.getElementById("motherPhone"),
    fatherPhone: document.getElementById("fatherPhone"),
    pendingMonths: document.getElementById("pendingMonths"),
    studentNotes: document.getElementById("studentNotes"),
    settingsModal: document.getElementById("settingsModal"),
    settingsForm: document.getElementById("settingsForm"),
    schoolName: document.getElementById("schoolName"),
    messageTemplate: document.getElementById("messageTemplate"),
    messagePreview: document.getElementById("messagePreview"),
    queueModal: document.getElementById("queueModal"),
    queueProgress: document.getElementById("queueProgress"),
    queueStudentName: document.getElementById("queueStudentName"),
    queueRecipient: document.getElementById("queueRecipient"),
    queueMessagePreview: document.getElementById("queueMessagePreview"),
    queuePreviousButton: document.getElementById("queuePreviousButton"),
    queueOpenWhatsAppButton: document.getElementById("queueOpenWhatsAppButton"),
    queueNextButton: document.getElementById("queueNextButton"),
    toast: document.getElementById("toast")
  };

  let db = null;
  let session = null;
  let students = [];
  let appSettings = {
    school_name: "KAROL WOJTYLA COLLEGE",
    message_template:
      "¡Hola! 👋\n\nLe saludamos de {colegio}.\n\nLe informamos que el/la estudiante {alumno} presenta cuotas pendientes correspondientes {periodo}.\n\nAgradeceremos regularizar los pagos pendientes.\n\nSi ya realizó el pago, por favor omita este mensaje.\n\nMuchas gracias."
  };
  let selectedIds = new Set();
  let toastTimer = null;
  let queueItems = [];
  let queueIndex = 0;

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanPhone(value = "") {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizeWhatsAppPhone(value = "") {
    let digits = cleanPhone(value);
    if (digits.length === 9) digits = `51${digits}`;
    return digits;
  }

  function isValidPhone(value = "") {
    const digits = cleanPhone(value);
    return !digits || (digits.length >= 9 && digits.length <= 15);
  }

  function parseMonths(value = "") {
    return String(value)
      .replace(/\s+y\s+/gi, ",")
      .split(",")
      .map((month) => month.trim())
      .filter(Boolean)
      .map((month) => month.charAt(0).toUpperCase() + month.slice(1).toLowerCase());
  }

  function joinNatural(items = []) {
    const clean = items.map((item) => String(item).trim()).filter(Boolean);
    if (clean.length === 0) return "";
    if (clean.length === 1) return clean[0];
    if (clean.length === 2) return `${clean[0]} y ${clean[1]}`;
    return `${clean.slice(0, -1).join(", ")} y ${clean.at(-1)}`;
  }

  function getPeriodText(months = []) {
    if (months.length === 1) return `al mes de ${months[0]}`;
    return `a los meses de ${joinNatural(months)}`;
  }

  function formatDateTime(value) {
    if (!value) return "No registrado";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No registrado";
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.remove("hidden");
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 3000);
  }

  function setLoading(button, loading, text) {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = text || "Procesando...";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function openModal(modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function openSidebar() {
    el.sidebar.classList.add("open");
    el.sidebarOverlay.classList.add("visible");
  }

  function closeSidebar() {
    el.sidebar.classList.remove("open");
    el.sidebarOverlay.classList.remove("visible");
  }

  function showLogin(message = "") {
    el.loginScreen.classList.remove("hidden");
    el.appShell.classList.add("hidden");
    el.loginMessage.textContent = message;
  }

  function showApp() {
    el.loginScreen.classList.add("hidden");
    el.appShell.classList.remove("hidden");
    el.userEmail.textContent = session?.user?.email || "Usuario autorizado";
  }

  function buildMessage(student) {
    const replacements = {
      "{colegio}": appSettings.school_name,
      "{alumno}": student.full_name,
      "{periodo}": getPeriodText(student.pending_months || [])
    };

    let message = appSettings.message_template;
    for (const [token, value] of Object.entries(replacements)) {
      message = message.replaceAll(token, value);
    }
    return message;
  }

  function updateMessagePreview() {
    const draft = {
      school_name: el.schoolName.value.trim() || "KAROL WOJTYLA COLLEGE",
      message_template: el.messageTemplate.value || appSettings.message_template
    };
    const sample = {
      full_name: "NOMBRE DEL ALUMNO",
      pending_months: ["Abril", "Mayo", "Julio"]
    };
    let message = draft.message_template
      .replaceAll("{colegio}", draft.school_name)
      .replaceAll("{alumno}", sample.full_name)
      .replaceAll("{periodo}", getPeriodText(sample.pending_months));
    el.messagePreview.textContent = message;
  }

  async function verifyAuthorizedStaff() {
    const { data, error } = await db
      .from("staff_users")
      .select("user_id, full_name, role, active")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.active) {
      await db.auth.signOut();
      throw new Error("Tu usuario no está autorizado para acceder a esta base.");
    }
    return data;
  }

  async function loadSettings() {
    const { data, error } = await db
      .from("app_settings")
      .select("school_name, message_template")
      .eq("id", 1)
      .single();
    if (error) throw error;
    appSettings = data;
  }

  async function loadStudents() {
    const { data, error } = await db
      .from("students")
      .select("id, full_name, pending_months, mother_phone, father_phone, status, notes, last_reminder_at, created_at, updated_at")
      .order("full_name", { ascending: true });

    if (error) throw error;
    students = data || [];
    selectedIds = new Set([...selectedIds].filter((id) => students.some((student) => student.id === id)));
    renderAll();
  }

  async function initializeApp() {
    try {
      showApp();
      await verifyAuthorizedStaff();
      await Promise.all([loadSettings(), loadStudents()]);
    } catch (error) {
      console.error(error);
      showLogin(error.message || "No fue posible cargar el sistema.");
    }
  }

  function getFilteredStudents() {
    const query = el.searchInput.value.trim().toLowerCase();
    const status = el.statusFilter.value;
    const contact = el.contactFilter.value;

    return students.filter((student) => {
      const hasPhone = Boolean(cleanPhone(student.mother_phone) || cleanPhone(student.father_phone));
      const searchable = [
        student.full_name,
        student.mother_phone,
        student.father_phone,
        ...(student.pending_months || []),
        student.notes
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || searchable.includes(query);
      const matchesStatus = !status || student.status === status;
      const matchesContact =
        !contact ||
        (contact === "with-phone" && hasPhone) ||
        (contact === "without-phone" && !hasPhone);
      return matchesQuery && matchesStatus && matchesContact;
    });
  }

  function getStudentDisplayStatus(student) {
    if (student.status === "regularized") {
      return { label: "Regularizado", className: "regularized" };
    }
    const hasPhone = Boolean(cleanPhone(student.mother_phone) || cleanPhone(student.father_phone));
    if (!hasPhone) return { label: "Sin teléfono", className: "no-phone" };
    return { label: "Pendiente", className: "pending" };
  }

  function renderStats() {
    const pending = students.filter((student) => student.status === "pending");
    const regularized = students.filter((student) => student.status === "regularized");
    const withPhone = pending.filter((student) => cleanPhone(student.mother_phone) || cleanPhone(student.father_phone));
    const multiple = pending.filter((student) => (student.pending_months || []).length > 1);

    document.getElementById("statPending").textContent = pending.length;
    document.getElementById("statWithPhone").textContent = withPhone.length;
    document.getElementById("statMultipleMonths").textContent = multiple.length;
    document.getElementById("statRegularized").textContent = regularized.length;
  }

  function renderSelection() {
    const count = selectedIds.size;
    el.selectedCount.textContent = `${count} seleccionado${count === 1 ? "" : "s"}`;
    el.sendSelectedButton.disabled = count === 0;

    const visibleEligible = getFilteredStudents().filter(
      (student) =>
        student.status === "pending" &&
        (cleanPhone(student.mother_phone) || cleanPhone(student.father_phone))
    );
    el.selectAllCheckbox.checked = visibleEligible.length > 0 && visibleEligible.every((student) => selectedIds.has(student.id));
    el.selectAllCheckbox.indeterminate =
      visibleEligible.some((student) => selectedIds.has(student.id)) && !el.selectAllCheckbox.checked;
  }

  function renderTable() {
    const filtered = getFilteredStudents();
    el.studentsBody.innerHTML = "";
    el.emptyState.classList.toggle("hidden", filtered.length > 0);
    el.tableWrap.classList.toggle("hidden", filtered.length === 0);

    for (const student of filtered) {
      const status = getStudentDisplayStatus(student);
      const hasPhone = Boolean(cleanPhone(student.mother_phone) || cleanPhone(student.father_phone));
      const selectable = student.status === "pending" && hasPhone;
      const row = document.createElement("tr");

      const motherButton = student.mother_phone
        ? `<button class="action-button whatsapp" data-action="whatsapp" data-recipient="mother" data-id="${student.id}" type="button">WhatsApp mamá</button>`
        : "";
      const fatherButton = student.father_phone
        ? `<button class="action-button whatsapp" data-action="whatsapp" data-recipient="father" data-id="${student.id}" type="button">WhatsApp papá</button>`
        : "";

      row.innerHTML = `
        <td data-label="Seleccionar" class="checkbox-column">
          <input class="student-checkbox" data-id="${student.id}" type="checkbox" ${selectedIds.has(student.id) ? "checked" : ""} ${selectable ? "" : "disabled"} aria-label="Seleccionar a ${escapeHtml(student.full_name)}">
        </td>
        <td data-label="Alumno">
          <span class="student-name">${escapeHtml(student.full_name)}</span>
          <span class="subtext">${escapeHtml(student.notes || "Sin observaciones")}</span>
        </td>
        <td data-label="Meses pendientes">
          <div class="month-tags">
            ${(student.pending_months || []).map((month) => `<span class="month-tag">${escapeHtml(month)}</span>`).join("") || '<span class="subtext">Sin meses pendientes</span>'}
          </div>
        </td>
        <td data-label="Contacto">
          <div class="contact-list">
            ${student.mother_phone ? `<a href="tel:${cleanPhone(student.mother_phone)}">Mamá: ${escapeHtml(student.mother_phone)}</a>` : ""}
            ${student.father_phone ? `<a href="tel:${cleanPhone(student.father_phone)}">Papá: ${escapeHtml(student.father_phone)}</a>` : ""}
            ${!hasPhone ? '<span class="subtext">Sin teléfono registrado</span>' : ""}
          </div>
        </td>
        <td data-label="Último recordatorio">${escapeHtml(formatDateTime(student.last_reminder_at))}</td>
        <td data-label="Estado"><span class="status-badge ${status.className}">${status.label}</span></td>
        <td data-label="Acciones">
          <div class="actions">
            ${student.status === "pending" ? motherButton + fatherButton : ""}
            ${student.status === "pending" ? `<button class="action-button" data-action="copy" data-id="${student.id}" type="button">Copiar mensaje</button>` : ""}
            <button class="action-button" data-action="call" data-id="${student.id}" type="button">Llamar</button>
            ${student.status === "pending" ? `<button class="action-button success" data-action="regularize" data-id="${student.id}" type="button">Regularizado</button>` : `<button class="action-button" data-action="restore" data-id="${student.id}" type="button">Volver a pendiente</button>`}
            <button class="action-button" data-action="edit" data-id="${student.id}" type="button">Editar</button>
            <button class="action-button danger" data-action="delete" data-id="${student.id}" type="button">Eliminar</button>
          </div>
        </td>
      `;
      el.studentsBody.appendChild(row);
    }
    renderSelection();
  }

  function renderAll() {
    renderStats();
    renderTable();
  }

  function resetStudentForm() {
    el.studentForm.reset();
    el.studentId.value = "";
    el.studentModalTitle.textContent = "Nuevo alumno";
  }

  function openStudentEditor(student = null) {
    resetStudentForm();
    if (student) {
      el.studentModalTitle.textContent = "Editar alumno";
      el.studentId.value = student.id;
      el.studentName.value = student.full_name;
      el.motherPhone.value = student.mother_phone || "";
      el.fatherPhone.value = student.father_phone || "";
      el.pendingMonths.value = joinNatural(student.pending_months || []);
      el.studentNotes.value = student.notes || "";
    }
    openModal(el.studentModal);
  }

  async function saveStudent(event) {
    event.preventDefault();
    const submitButton = el.studentForm.querySelector('button[type="submit"]');
    const id = el.studentId.value;
    const months = parseMonths(el.pendingMonths.value);
    const motherPhone = cleanPhone(el.motherPhone.value);
    const fatherPhone = cleanPhone(el.fatherPhone.value);

    if (!months.length) {
      showToast("Ingresa al menos un mes pendiente.");
      return;
    }
    if (!isValidPhone(motherPhone) || !isValidPhone(fatherPhone)) {
      showToast("Revisa los teléfonos ingresados.");
      return;
    }

    const payload = {
      full_name: el.studentName.value.trim().toUpperCase(),
      pending_months: months,
      mother_phone: motherPhone || null,
      father_phone: fatherPhone || null,
      status: "pending",
      notes: el.studentNotes.value.trim()
    };

    setLoading(submitButton, true, "Guardando...");
    try {
      let error;
      if (id) {
        ({ error } = await db.from("students").update(payload).eq("id", id));
      } else {
        ({ error } = await db.from("students").insert(payload));
      }
      if (error) throw error;
      closeModal(el.studentModal);
      await loadStudents();
      showToast(id ? "Alumno actualizado." : "Alumno registrado.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo guardar el alumno.");
    } finally {
      setLoading(submitButton, false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const submitButton = el.settingsForm.querySelector('button[type="submit"]');
    setLoading(submitButton, true, "Guardando...");
    try {
      const payload = {
        school_name: el.schoolName.value.trim(),
        message_template: el.messageTemplate.value.trim(),
        updated_at: new Date().toISOString()
      };
      const { error } = await db.from("app_settings").update(payload).eq("id", 1);
      if (error) throw error;
      appSettings = payload;
      closeModal(el.settingsModal);
      showToast("Configuración actualizada.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo guardar la configuración.");
    } finally {
      setLoading(submitButton, false);
    }
  }

  async function markReminderOpened(student, recipientType, phone, message) {
    const now = new Date().toISOString();
    const { error: logError } = await db.from("reminder_logs").insert({
      student_id: student.id,
      recipient_type: recipientType,
      phone,
      message_snapshot: message,
      action_status: "opened"
    });
    if (logError) console.warn("No se pudo guardar el historial:", logError.message);

    const { error: updateError } = await db
      .from("students")
      .update({ last_reminder_at: now })
      .eq("id", student.id);
    if (updateError) console.warn("No se pudo actualizar el último recordatorio:", updateError.message);

    student.last_reminder_at = now;
    renderTable();
  }

  async function openWhatsApp(student, recipientType) {
    const phone = recipientType === "mother" ? student.mother_phone : student.father_phone;
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) {
      showToast("Este contacto no tiene un teléfono válido.");
      return;
    }
    const message = buildMessage(student);
    await markReminderOpened(student, recipientType, cleanPhone(phone), message);
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function copyMessage(student) {
    try {
      await navigator.clipboard.writeText(buildMessage(student));
      showToast("Mensaje copiado.");
    } catch {
      showToast("No se pudo copiar automáticamente.");
    }
  }

  async function updateStudentStatus(student, status) {
    let pendingMonths = student.pending_months || [];
    if (status === "regularized") pendingMonths = [];
    if (status === "pending" && pendingMonths.length === 0) {
      const input = prompt("Escribe los meses pendientes separados por comas:");
      if (!input) return;
      pendingMonths = parseMonths(input);
      if (!pendingMonths.length) return;
    }

    const { error } = await db
      .from("students")
      .update({ status, pending_months: pendingMonths })
      .eq("id", student.id);
    if (error) throw error;
    selectedIds.delete(student.id);
    await loadStudents();
    showToast(status === "regularized" ? "Alumno marcado como regularizado." : "Alumno marcado como pendiente.");
  }

  async function deleteStudent(student) {
    const confirmed = confirm(`¿Eliminar a ${student.full_name}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    const { error } = await db.from("students").delete().eq("id", student.id);
    if (error) throw error;
    selectedIds.delete(student.id);
    await loadStudents();
    showToast("Registro eliminado.");
  }

  function getQueueRecipient(student) {
    if (cleanPhone(student.mother_phone)) {
      return { recipientType: "mother", label: "Mamá", phone: student.mother_phone };
    }
    return { recipientType: "father", label: "Papá", phone: student.father_phone };
  }

  function startQueue() {
    queueItems = [...selectedIds]
      .map((id) => students.find((student) => student.id === id))
      .filter(Boolean)
      .filter((student) => student.status === "pending")
      .map((student) => ({ student, ...getQueueRecipient(student) }))
      .filter((item) => cleanPhone(item.phone));

    if (!queueItems.length) {
      showToast("No hay contactos válidos seleccionados.");
      return;
    }
    queueIndex = 0;
    renderQueue();
    openModal(el.queueModal);
  }

  function renderQueue() {
    const item = queueItems[queueIndex];
    if (!item) {
      closeModal(el.queueModal);
      selectedIds.clear();
      renderSelection();
      showToast("Cola finalizada.");
      return;
    }
    el.queueProgress.textContent = `${queueIndex + 1} de ${queueItems.length}`;
    el.queueStudentName.textContent = item.student.full_name;
    el.queueRecipient.textContent = `${item.label}: ${item.phone}`;
    el.queueMessagePreview.textContent = buildMessage(item.student);
    el.queuePreviousButton.disabled = queueIndex === 0;
    el.queueNextButton.textContent = queueIndex === queueItems.length - 1 ? "Finalizar" : "Siguiente";
  }

  async function openCurrentQueueWhatsApp() {
    const item = queueItems[queueIndex];
    if (!item) return;
    const normalized = normalizeWhatsAppPhone(item.phone);
    const message = buildMessage(item.student);
    await markReminderOpened(item.student, item.recipientType, cleanPhone(item.phone), message);
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  function exportCsv() {
    const headers = [
      "Alumno",
      "Meses pendientes",
      "Teléfono mamá",
      "Teléfono papá",
      "Estado",
      "Último recordatorio",
      "Observaciones"
    ];
    const rows = students.map((student) => [
      student.full_name,
      joinNatural(student.pending_months || []),
      student.mother_phone || "",
      student.father_phone || "",
      student.status === "regularized" ? "Regularizado" : "Pendiente",
      formatDateTime(student.last_reminder_at),
      student.notes || ""
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cobranzas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!configReady) {
      el.setupAlert.classList.remove("hidden");
      el.loginMessage.textContent = "Primero configura Supabase en config.js.";
      return;
    }
    setLoading(el.loginButton, true, "Ingresando...");
    el.loginMessage.textContent = "";
    try {
      const { data, error } = await db.auth.signInWithPassword({
        email: el.loginEmail.value.trim(),
        password: el.loginPassword.value
      });
      if (error) throw error;
      session = data.session;
      await initializeApp();
    } catch (error) {
      console.error(error);
      el.loginMessage.textContent = error.message || "Correo o contraseña incorrectos.";
    } finally {
      setLoading(el.loginButton, false);
    }
  }

  async function logout() {
    await db.auth.signOut();
    session = null;
    students = [];
    selectedIds.clear();
    el.loginPassword.value = "";
    showLogin();
  }

  function bindEvents() {
    el.loginForm.addEventListener("submit", handleLogin);
    el.menuButton.addEventListener("click", openSidebar);
    el.sidebarClose.addEventListener("click", closeSidebar);
    el.sidebarOverlay.addEventListener("click", closeSidebar);
    el.logoutButton.addEventListener("click", logout);
    el.newStudentButton.addEventListener("click", () => openStudentEditor());
    el.studentForm.addEventListener("submit", saveStudent);
    el.settingsForm.addEventListener("submit", saveSettings);
    el.schoolName.addEventListener("input", updateMessagePreview);
    el.messageTemplate.addEventListener("input", updateMessagePreview);
    el.exportButton.addEventListener("click", exportCsv);

    el.settingsButton.addEventListener("click", () => {
      closeSidebar();
      el.schoolName.value = appSettings.school_name;
      el.messageTemplate.value = appSettings.message_template;
      updateMessagePreview();
      openModal(el.settingsModal);
    });

    el.searchInput.addEventListener("input", renderTable);
    el.statusFilter.addEventListener("change", renderTable);
    el.contactFilter.addEventListener("change", renderTable);

    el.studentsBody.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".student-checkbox");
      if (!checkbox) return;
      if (checkbox.checked) selectedIds.add(checkbox.dataset.id);
      else selectedIds.delete(checkbox.dataset.id);
      renderSelection();
    });

    el.studentsBody.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const student = students.find((item) => item.id === button.dataset.id);
      if (!student) return;

      try {
        switch (button.dataset.action) {
          case "whatsapp":
            await openWhatsApp(student, button.dataset.recipient);
            break;
          case "copy":
            await copyMessage(student);
            break;
          case "call": {
            const phone = cleanPhone(student.mother_phone) || cleanPhone(student.father_phone);
            if (!phone) showToast("Este alumno no tiene teléfono registrado.");
            else window.location.href = `tel:${phone}`;
            break;
          }
          case "regularize":
            await updateStudentStatus(student, "regularized");
            break;
          case "restore":
            await updateStudentStatus(student, "pending");
            break;
          case "edit":
            openStudentEditor(student);
            break;
          case "delete":
            await deleteStudent(student);
            break;
        }
      } catch (error) {
        console.error(error);
        showToast(error.message || "No se pudo completar la acción.");
      }
    });

    el.selectAllCheckbox.addEventListener("change", () => {
      const eligible = getFilteredStudents().filter(
        (student) =>
          student.status === "pending" &&
          (cleanPhone(student.mother_phone) || cleanPhone(student.father_phone))
      );
      if (el.selectAllCheckbox.checked) eligible.forEach((student) => selectedIds.add(student.id));
      else eligible.forEach((student) => selectedIds.delete(student.id));
      renderTable();
    });

    el.selectVisibleButton.addEventListener("click", () => {
      getFilteredStudents()
        .filter(
          (student) =>
            student.status === "pending" &&
            (cleanPhone(student.mother_phone) || cleanPhone(student.father_phone))
        )
        .forEach((student) => selectedIds.add(student.id));
      renderTable();
    });

    el.clearSelectionButton.addEventListener("click", () => {
      selectedIds.clear();
      renderTable();
    });
    el.sendSelectedButton.addEventListener("click", startQueue);
    el.queueOpenWhatsAppButton.addEventListener("click", openCurrentQueueWhatsApp);
    el.queuePreviousButton.addEventListener("click", () => {
      if (queueIndex > 0) queueIndex -= 1;
      renderQueue();
    });
    el.queueNextButton.addEventListener("click", () => {
      queueIndex += 1;
      renderQueue();
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
      if (event.key !== "Escape") return;
      document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(closeModal);
      closeSidebar();
    });
  }

  async function boot() {
    bindEvents();
    if (!configReady) {
      el.setupAlert.classList.remove("hidden");
      el.loginForm.querySelectorAll("input, button").forEach((input) => (input.disabled = true));
      return;
    }

    db = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    db.auth.onAuthStateChange((event, nextSession) => {
      session = nextSession;
      if (event === "SIGNED_OUT") showLogin();
    });

    const { data, error } = await db.auth.getSession();
    if (error) {
      showLogin(error.message);
      return;
    }
    session = data.session;
    if (session) await initializeApp();
    else showLogin();
  }

  boot().catch((error) => {
    console.error(error);
    showLogin("No se pudo iniciar el sistema.");
  });
})();
