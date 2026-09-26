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

  // Đã đăng nhập
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
    <a href="./account.html" class="btn btn-primary profile-button">
      👤 ${escapeHtml(username)}
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
