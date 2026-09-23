"use strict";

const content = document.querySelector("#content");
const statusBox = document.querySelector("#status");
const searchInput = document.querySelector("#search");
const searchWrap = document.querySelector("#search-wrap");
const modal = document.querySelector("#modal");
const modalContent = document.querySelector("#modal-content");
const closeButton = document.querySelector("#close");
const viewTitle = document.querySelector("#view-title");

let currentView = "members";
let roles = [];
let searchTimer = null;

const avatarFallback = "/logo.svg";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatNumber(value) {
  return new Intl.NumberFormat("ar-SA").format(Number(value) || 0);
}

function safeAvatar(member) {
  return member?.avatar || avatarFallback;
}

function formatVoiceTime(minutes) {
  const totalMinutes = Number(minutes) || 0;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}د`;
  }

  return `${hours}س ${remainingMinutes}د`;
}

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

function openModal() {
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  modalContent.innerHTML = "";
}

function memberCard(member) {
  const importantRoles = member.importantRoles || [];

  const roleMarkup = importantRoles.length
    ? importantRoles
        .map((role) => `<span class="role">${escapeHtml(role.name)}</span>`)
        .join("")
    : `<span class="member-tag">عضو</span>`;

  return `
    <article class="card member-card" data-member-id="${escapeHtml(member.id)}">
      <img
        class="member-avatar"
        src="${escapeHtml(safeAvatar(member))}"
        alt="${escapeHtml(member.name)}"
        onerror="this.onerror=null;this.src='${avatarFallback}'"
      >

      <div class="member-info">
        <h3>${escapeHtml(member.name)}</h3>
        <p>@${escapeHtml(member.username || "")}</p>

        <div class="roles">
          ${roleMarkup}
        </div>
      </div>

      <span class="card-arrow">↗</span>
    </article>
  `;
}

function bindMemberCards() {
  document.querySelectorAll("[data-member-id]").forEach((card) => {
    card.addEventListener("click", () => {
      openMember(card.dataset.memberId);
    });
  });
}

function renderMembers(memberList) {
  content.className = "grid";

  if (!memberList.length) {
    content.innerHTML = `
      <div class="empty-content">
        <div class="empty-icon">⌕</div>
        <h3>لا توجد نتائج</h3>
        <p>جرّب البحث باسم أو يوزر مختلف.</p>
      </div>
    `;

    return;
  }

  content.innerHTML = memberList.map(memberCard).join("");
  bindMemberCards();
}

function topMemberCard(member, label, value, index) {
  return `
    <article
      class="top-card"
      data-member-id="${escapeHtml(member.id)}"
    >
      <span class="top-rank">${index + 1}</span>

      <img
        src="${escapeHtml(safeAvatar(member))}"
        alt="${escapeHtml(member.name)}"
        onerror="this.onerror=null;this.src='${avatarFallback}'"
      >

      <div class="top-info">
        <small>${escapeHtml(label)}</small>
        <h3>${escapeHtml(member.name)}</h3>
        <strong>${escapeHtml(formatNumber(value))}</strong>
      </div>
    </article>
  `;
}

function renderTopSection(title, members, valueKey, label) {
  const cards = members
    .map((member, index) => {
      let value = member.stats?.[valueKey] || 0;

      if (valueKey === "mentionsReceived") {
        value = member.stats?.mentionsReceived || 0;
      }

      return topMemberCard(member, label, value, index);
    })
    .join("");

  return `
    <section class="top-section">
      <div class="top-section-header">
        <h3>${title}</h3>
        <span class="top-count">TOP 10</span>
      </div>

      ${
        cards ||
        `<p class="muted top-empty">لا توجد إحصائيات كافية حتى الآن.</p>`
      }
    </section>
  `;
}

function renderTop(data) {
  content.className = "top-grid";

  content.innerHTML = `
    ${renderTopSection(
      "🏆 أكثر الرسائل",
      data.messages || [],
      "messages",
      "رسالة"
    )}

    ${renderTopSection(
      "💬 أكثر المنشنات",
      data.mentions || [],
      "mentionsReceived",
      "منشن جاه"
    )}

    ${renderTopSection(
      "🎙️ أكثر وقت صوتي",
      data.voice || [],
      "voiceMinutes",
      "دقيقة"
    )}

    ${renderTopSection(
      "⚡ أكثر دخول صوتي",
      data.joins || [],
      "voiceJoins",
      "دخول"
    )}
  `;

  document.querySelectorAll(".top-card").forEach((card) => {
    card.addEventListener("click", () => {
      openMember(card.dataset.memberId);
    });
  });
}

function roleCard(role) {
  const permissions = role.permissions || [];

  const permissionMarkup = permissions.length
    ? permissions
        .slice(0, 4)
        .map(
          (permission) =>
            `<span class="permission">${escapeHtml(permission)}</span>`
        )
        .join("")
    : `<span class="permission muted-permission">صلاحيات عادية</span>`;

  return `
    <article
      class="role-card"
      data-role-id="${escapeHtml(role.id)}"
    >
      <div class="role-card-top">
        <span
          class="role-color"
          style="background:${escapeHtml(role.color || "#c58ab9")}"
        ></span>

        <small>${formatNumber(role.membersCount)} عضو</small>
      </div>

      <h3>${escapeHtml(role.name)}</h3>

      <div class="permissions-preview">
        ${permissionMarkup}
      </div>

      <span class="role-hint">
        اضغط لعرض الأعضاء
      </span>
    </article>
  `;
}

function renderRoles() {
  content.className = "role-grid";

  if (!roles.length) {
    content.innerHTML = `
      <div class="empty-content">
        <div class="empty-icon">⌁</div>
        <h3>لا توجد رتب</h3>
        <p>تعذر تحميل الرتب حاليًا.</p>
      </div>
    `;

    return;
  }

  content.innerHTML = roles.map(roleCard).join("");

  document.querySelectorAll("[data-role-id]").forEach((card) => {
    card.addEventListener("click", () => {
      openRole(card.dataset.roleId);
    });
  });
}

function statistic(value, label) {
  return `
    <div class="stat-box">
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(label)}</small>
    </div>
  `;
}

function permissionList(permissions) {
  if (!permissions?.length) {
    return `<span class="muted">لا توجد صلاحيات إدارية بارزة</span>`;
  }

  return permissions
    .map(
      (permission) =>
        `<span class="permission">${escapeHtml(permission)}</span>`
    )
    .join("");
}

async function openMember(memberId) {
  try {
    modalContent.innerHTML = `
      <div class="loading-box">
        <div class="loader"></div>
        <p>جاري تحميل ملف العضو...</p>
      </div>
    `;

    openModal();

    const response = await fetch(
      `/api/public/member/${encodeURIComponent(memberId)}`
    );

    if (!response.ok) {
      throw new Error("Member request failed");
    }

    const member = await response.json();
    const stats = member.stats || {};
    const voiceMinutes = stats.voiceMinutes || 0;

    const allRoles = member.roles || [];
    const rolesMarkup = allRoles.length
      ? allRoles
          .map(
            (role) =>
              `<span class="role">${escapeHtml(role.name)}</span>`
          )
          .join("")
      : `<span class="muted">لا توجد رتب إضافية</span>`;

    const upcomingMarkup = member.upcomingRoles?.length
      ? member.upcomingRoles
          .map(
            (role) =>
              `<span class="role">${escapeHtml(role.name)}</span>`
          )
          .join("")
      : `<span class="muted">لا توجد رتبة أعلى متاحة</span>`;

    modalContent.innerHTML = `
      <div class="profile">
        <div class="profile-header">
          <img
            class="profile-avatar"
            src="${escapeHtml(safeAvatar(member))}"
            alt="${escapeHtml(member.name)}"
            onerror="this.onerror=null;this.src='${avatarFallback}'"
          >

          <div>
            <p class="eyebrow">ملف العضو</p>
            <h2>${escapeHtml(member.name)}</h2>
            <p class="muted">
              @${escapeHtml(member.username || "")}
            </p>
            <span class="profile-rank">
              ${escapeHtml(member.rank || "عضو")}
            </span>
          </div>
        </div>

        <div class="stat-grid">
          ${statistic(formatNumber(stats.messages), "رسالة")}
          ${statistic(formatNumber(stats.mentionsReceived), "منشن جاه")}
          ${statistic(formatNumber(stats.mentionsSent), "منشن أرسله")}
          ${statistic(formatVoiceTime(voiceMinutes), "وقت صوتي")}
          ${statistic(formatNumber(stats.voiceJoins), "دخول صوتي")}
          ${statistic(formatNumber(stats.chatRounds), "نشاط شات")}
        </div>

        <section class="profile-section">
          <div class="section-title">
            <h3>كل رتب العضو</h3>
            <span>${formatNumber(allRoles.length)}</span>
          </div>

          <div class="roles profile-roles">
            ${rolesMarkup}
          </div>
        </section>

        <section class="profile-section">
          <div class="section-title">
            <h3>أقوى الصلاحيات</h3>
          </div>

          <div class="permission-box">
            ${permissionList(member.permissions)}
          </div>
        </section>

        <section class="profile-section">
          <div class="section-title">
            <h3>الرتب القادمة</h3>
          </div>

          <div class="roles profile-roles">
            ${upcomingMarkup}
          </div>
        </section>

        <button
          class="primary message-button"
          type="button"
          data-message-member="${escapeHtml(member.id)}"
          data-message-name="${escapeHtml(member.name)}"
        >
          إرسال رسالة خاصة
        </button>
      </div>
    `;

    const messageButton = document.querySelector("[data-message-member]");

    if (messageButton) {
      messageButton.addEventListener("click", () => {
        openMessageForm(
          messageButton.dataset.messageMember,
          messageButton.dataset.messageName
        );
      });
    }
  } catch (error) {
    modalContent.innerHTML = `
      <div class="empty-content">
        <h3>تعذر تحميل العضو</h3>
        <p>حاول مرة أخرى بعد قليل.</p>
      </div>
    `;
  }
}

async function openRole(roleId) {
  try {
    modalContent.innerHTML = `
      <div class="loading-box">
        <div class="loader"></div>
        <p>جاري تحميل أعضاء الرتبة...</p>
      </div>
    `;

    openModal();

    const response = await fetch(
      `/api/public/roles/${encodeURIComponent(roleId)}/members`
    );

    if (!response.ok) {
      throw new Error("Role request failed");
    }

    const data = await response.json();
    const role = data.role || {};
    const members = data.members || [];

    modalContent.innerHTML = `
      <div class="role-details">
        <p class="eyebrow">دليل الرتبة</p>
        <h2>${escapeHtml(role.name || "الرتبة")}</h2>

        <div class="role-meta">
          <span>${formatNumber(role.membersCount)} عضو</span>
          <span>${formatNumber(role.permissions?.length || 0)} صلاحية مهمة</span>
        </div>

        <h3>أقوى الصلاحيات</h3>

        <div class="permission-box">
          ${permissionList(role.permissions)}
        </div>

        <h3>أعضاء الرتبة</h3>

        <div class="grid compact-grid">
          ${
            members.length
              ? members.map(memberCard).join("")
              : `<p class="muted">لا يوجد أعضاء بهذه الرتبة.</p>`
          }
        </div>
      </div>
    `;

    bindMemberCards();
  } catch (error) {
    modalContent.innerHTML = `
      <div class="empty-content">
        <h3>تعذر تحميل الرتبة</h3>
        <p>حاول مرة أخرى بعد قليل.</p>
      </div>
    `;
  }
}

function toggleSenderName() {
  const checkbox = document.querySelector("#include-name");
  const nameWrap = document.querySelector("#sender-name-wrap");

  if (!checkbox || !nameWrap) {
    return;
  }

  nameWrap.classList.toggle("hidden", !checkbox.checked);
}

function openMessageForm(memberId, memberName) {
  modalContent.innerHTML = `
    <div class="message-form">
      <p class="eyebrow">رسالة خاصة</p>
      <h2>إرسال إلى ${escapeHtml(memberName)}</h2>

      <p class="muted">
        يمكنك إظهار اسم المرسل أو إرسال الرسالة بدونه.
      </p>

      <label class="check-row">
        <input
          id="include-name"
          type="checkbox"
        >

        <span>إظهار اسم المرسل</span>
      </label>

      <div id="sender-name-wrap" class="hidden">
        <input
          id="sender-name"
          class="full-input"
          maxlength="60"
          placeholder="اكتب الاسم الذي سيظهر..."
        >
      </div>

      <textarea
        id="message-text"
        maxlength="1000"
        placeholder="اكتب رسالتك هنا..."
      ></textarea>

      <input
        id="message-key"
        class="full-input"
        type="password"
        placeholder="مفتاح الإرسال"
      >

      <p id="message-status" class="form-status"></p>

      <button
        id="send-message-button"
        class="primary message-button"
        type="button"
      >
        إرسال الآن
      </button>
    </div>
  `;

  document
    .querySelector("#include-name")
    .addEventListener("change", toggleSenderName);

  document
    .querySelector("#send-message-button")
    .addEventListener("click", () => {
      sendMessage(memberId);
    });
}

async function sendMessage(memberId) {
  const messageInput = document.querySelector("#message-text");
  const keyInput = document.querySelector("#message-key");
  const includeName = document.querySelector("#include-name");
  const senderNameInput = document.querySelector("#sender-name");
  const formStatus = document.querySelector("#message-status");
  const sendButton = document.querySelector("#send-message-button");

  const text = messageInput?.value.trim() || "";
  const key = keyInput?.value.trim() || "";
  const showName = Boolean(includeName?.checked);
  const senderName = senderNameInput?.value.trim() || "";

  if (!text) {
    formStatus.textContent = "اكتب الرسالة أولًا.";
    formStatus.className = "form-status error";
    return;
  }

  if (showName && !senderName) {
    formStatus.textContent = "اكتب اسم المرسل أو عطّل خيار إظهاره.";
    formStatus.className = "form-status error";
    return;
  }

  const finalMessage = showName
    ? `من: ${senderName}\n\n${text}`
    : text;

  sendButton.disabled = true;
  sendButton.textContent = "جاري الإرسال...";
  formStatus.textContent = "";

  try {
    const response = await fetch("/api/public/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        memberId,
        message: finalMessage,
        key
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "تعذر إرسال الرسالة");
    }

    formStatus.textContent = "تم إرسال الرسالة بنجاح.";
    formStatus.className = "form-status success";
    messageInput.value = "";
  } catch (error) {
    formStatus.textContent = error.message || "تعذر إرسال الرسالة.";
    formStatus.className = "form-status error";
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "إرسال الآن";
  }
}

function resetMembersView() {
  content.className = "grid empty";

  content.innerHTML = `
    <div class="empty-content">
      <div class="empty-icon">⌕</div>
      <h3>ابدأ بالبحث</h3>
      <p>اكتب اسم العضو أو اليوزر وستظهر النتائج هنا.</p>
    </div>
  `;

  setStatus("اكتب اسم العضو أو اليوزر للبحث");
}

async function searchMembers() {
  clearTimeout(searchTimer);

  const query = searchInput.value.trim();

  if (!query) {
    resetMembersView();
    return;
  }

  setStatus("جاري البحث...");

  searchTimer = setTimeout(async () => {
    try {
      const response = await fetch(
        `/api/public/members?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      const memberList = data.members || [];

      setStatus(`تم العثور على ${formatNumber(memberList.length)} نتيجة`);
      renderMembers(memberList);
    } catch (error) {
      setStatus("تعذر تنفيذ البحث");
      renderMembers([]);
    }
  }, 300);
}

async function loadInitialData() {
  try {
    const [serverResponse, rolesResponse] = await Promise.all([
      fetch("/api/public/server"),
      fetch("/api/public/roles")
    ]);

    if (!serverResponse.ok || !rolesResponse.ok) {
      throw new Error("Initial data request failed");
    }

    const server = await serverResponse.json();
    const roleData = await rolesResponse.json();

    roles = roleData.roles || [];

    const serverName = document.querySelector("#server-name");
    const serverCount = document.querySelector("#server-count");
    const inviteButton = document.querySelector("#invite");

    if (serverName) {
      serverName.textContent = server.name || "MLD";
    }

    if (serverCount) {
      serverCount.textContent = formatNumber(server.memberCount);
    }

    if (inviteButton) {
      if (server.invite) {
        inviteButton.href = server.invite;
      } else {
        inviteButton.style.display = "none";
      }
    }
  } catch (error) {
    setStatus("تعذر الاتصال بالخدمة");
  }
}

async function changeView(view) {
  currentView = view;

  if (view === "members") {
    viewTitle.textContent = "ابحث عن عضو";
    searchWrap.style.display = "flex";
    resetMembersView();
    return;
  }

  searchWrap.style.display = "none";

  if (view === "roles") {
    viewTitle.textContent = "الرتب القيادية";
    setStatus("اختر رتبة لعرض أعضائها");
    renderRoles();
    return;
  }

  if (view === "top") {
    viewTitle.textContent = "لوحة TOP";
    setStatus("جاري تحميل ترتيب النشاط...");
    content.className = "top-grid";

    try {
      const response = await fetch("/api/public/top");

      if (!response.ok) {
        throw new Error("Top request failed");
      }

      const data = await response.json();
      renderTop(data);
      setStatus("ترتيب الأعضاء حسب النشاط");
    } catch (error) {
      setStatus("تعذر تحميل لوحة TOP");
    }
  }
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    changeView(button.dataset.view);
  });
});

searchInput.addEventListener("input", () => {
  if (currentView !== "members") {
    changeView("members");
  }

  searchMembers();
});

closeButton.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.classList.contains("hidden")) {
    closeModal();
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();

loadInitialData();
