document.addEventListener("DOMContentLoaded", () => {
  updateNavigation();
});

function updateNavigation() {
  const navActions = document.getElementById("navActions");
  if (!navActions) return;

  const token = localStorage.getItem("pixelkey_token");
  const userData = localStorage.getItem("pixelkey_user");

  // Chưa đăng nhập
  if (!token || !userData) {
    navActions.innerHTML = `
      <a href="./login.html" class="btn btn-outline">
        Đăng nhập
      </a>

      <a href="./register.html" class="btn btn-primary">
        Đăng ký
      </a>
    `;

    return;
  }

  let user;

  try {
    user = JSON.parse(userData);
  } catch (error) {
    localStorage.removeItem("pixelkey_token");
    localStorage.removeItem("pixelkey_user");

    updateNavigation();
    return;
  }

  const username = user.username || "Người chơi";
  const balance = Number(user.balance || 0);

  navActions.innerHTML = `
    <div class="profile-menu">

      <button
        type="button"
        class="profile-card"
        id="profileToggle"
        aria-expanded="false"
      >
        <span class="profile-avatar">
          <span class="profile-avatar-pixel">◆</span>
        </span>

        <span class="profile-info">
          <span class="profile-username">
            ${escapeHtml(username)}
          </span>

          <span class="profile-role">
            ${user.role === "admin" ? "ADMIN" : "PLAYER"}
          </span>
        </span>

        <span class="profile-arrow">⌄</span>
      </button>

      <div class="profile-dropdown" id="profileDropdown">

        <div class="profile-dropdown-header">
          <div class="dropdown-avatar">
            ◆
          </div>

          <div class="dropdown-user">
            <strong>${escapeHtml(username)}</strong>
            <span>
              ${user.role === "admin" ? "ADMIN" : "PLAYER"}
            </span>
          </div>
        </div>

        <div class="profile-balance">
          <div>
            <span class="balance-label">SỐ DƯ PIXELKEY</span>
            <strong>${formatMoney(balance)}đ</strong>
          </div>

          <span class="balance-icon">₫</span>
        </div>

        <div class="profile-dropdown-divider"></div>

        <a href="./account.html" class="profile-dropdown-item">
          <span class="dropdown-item-icon">◈</span>
          <span>Hồ sơ của tôi</span>
        </a>

        <a href="./account.html#orders" class="profile-dropdown-item">
          <span class="dropdown-item-icon">▣</span>
          <span>Đơn hàng</span>
        </a>

        <a href="./account.html#topup" class="profile-dropdown-item">
          <span class="dropdown-item-icon">＋</span>
          <span>Nạp tiền</span>
        </a>

        ${
          user.role === "admin"
            ? `
              <a href="./admin.html" class="profile-dropdown-item admin-item">
                <span class="dropdown-item-icon">◆</span>
                <span>Trang quản trị</span>
              </a>
            `
            : ""
        }

        <div class="profile-dropdown-divider"></div>

        <button
          type="button"
          class="profile-dropdown-item logout-item"
          id="logoutButton"
        >
          <span class="dropdown-item-icon">↪</span>
          <span>Đăng xuất</span>
        </button>

      </div>
    </div>
  `;

  setupProfileMenu();
}

function setupProfileMenu() {
  const profileToggle = document.getElementById("profileToggle");
  const profileDropdown = document.getElementById("profileDropdown");
  const logoutButton = document.getElementById("logoutButton");

  if (!profileToggle || !profileDropdown) return;

  profileToggle.addEventListener("click", (event) => {
    event.stopPropagation();

    const isOpen = profileDropdown.classList.toggle("show");

    profileToggle.setAttribute(
      "aria-expanded",
      isOpen ? "true" : "false"
    );
  });

  // Bấm ra ngoài dropdown → đóng
  document.addEventListener("click", (event) => {
    const profileMenu = document.querySelector(".profile-menu");

    if (!profileMenu) return;

    if (!profileMenu.contains(event.target)) {
      profileDropdown.classList.remove("show");
      profileToggle.setAttribute("aria-expanded", "false");
    }
  });

  // Đăng xuất
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("pixelkey_token");
      localStorage.removeItem("pixelkey_user");

      window.location.href = "./index.html";
    });
  }
}

function formatMoney(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
