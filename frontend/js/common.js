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

  const username = user.username || "Người chơi";

  navActions.innerHTML = `
    <a href="./account.html" class="profile-card">
      <span class="profile-avatar">
        <span class="profile-avatar-pixel">◆</span>
      </span>

      <span class="profile-info">
        <span class="profile-username">${escapeHtml(username)}</span>
        <span class="profile-role">PLAYER</span>
      </span>

      <span class="profile-arrow">›</span>
    </a>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
