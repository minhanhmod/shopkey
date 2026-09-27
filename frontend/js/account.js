const token = localStorage.getItem("pixelkey_token");


if (!token) {

  window.location.href = "./login.html";

}


const accountUsername =
  document.getElementById("accountUsername");

const accountEmail =
  document.getElementById("accountEmail");

const accountBalance =
  document.getElementById("accountBalance");

const accountRole =
  document.getElementById("accountRole");

const orderCount =
  document.getElementById("orderCount");

const profileUsername =
  document.getElementById("profileUsername");

const profileEmail =
  document.getElementById("profileEmail");

const profileId =
  document.getElementById("profileId");

const ordersContainer =
  document.getElementById("ordersContainer");
const topupAmount =
  document.getElementById("topupAmount");

const createTopup =
  document.getElementById("createTopup");

const topupMessage =
  document.getElementById("topupMessage");

const topupResult =
  document.getElementById("topupResult");

const topupQr =
  document.getElementById("topupQr");

const topupOrderCode =
  document.getElementById("topupOrderCode");

const topupOrderAmount =
  document.getElementById("topupOrderAmount");

const topupStatus =
  document.getElementById("topupStatus");

const topupCheckout =
  document.getElementById("topupCheckout");

let currentTopupOrderCode = null;
let topupPollTimer = null;


function formatMoney(value) {

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND"
  }).format(Number(value || 0));

}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function formatDate(value) {

  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(
    "vi-VN"
  );

}


async function loadAccount() {

  try {

    const data =
      await API.get("/auth/me");


    const user = data.user;


    accountUsername.textContent =
      user.username;

    accountEmail.textContent =
      user.email;


    accountBalance.textContent =
      formatMoney(user.balance);


    accountRole.textContent =
      user.role === "admin"
        ? "ADMIN"
        : "USER";


    profileUsername.textContent =
      user.username;

    profileEmail.textContent =
      user.email;

    profileId.textContent =
      user.id;


    localStorage.setItem(
      "pixelkey_user",
      JSON.stringify(user)
    );


    if (user.role === "admin") {

      const adminLink =
        document.createElement("a");

      adminLink.href =
        "./admin.html";

      adminLink.className =
        "btn btn-outline";

      adminLink.textContent =
        "⚙ Admin";


      document
        .querySelector(".nav-inner")
        .insertBefore(
          adminLink,
          document.getElementById("logoutButton")
        );

    }


  } catch (error) {

    console.error(error);

    localStorage.removeItem(
      "pixelkey_token"
    );

    localStorage.removeItem(
      "pixelkey_user"
    );

    window.location.href =
      "./login.html";

  }

}


async function loadOrders() {

  try {

    const data =
      await API.get("/orders");


    const orders =
      data.orders || [];


    orderCount.textContent =
      orders.length;


    if (!orders.length) {

      ordersContainer.innerHTML = `
        <div class="account-empty">

          <div class="empty-icon">
            🎮
          </div>

          <h3>
            Chưa có đơn hàng
          </h3>

          <p>
            Bạn chưa mua game nào.
          </p>

          <a
            href="./index.html"
            class="btn btn-primary"
          >
            Xem Game
          </a>

        </div>
      `;

      return;

    }


    ordersContainer.innerHTML =
      orders.map(order => {

        const items =
          Array.isArray(order.items)
            ? order.items
            : [];


        return `
          <article class="order-card">

            <div class="order-top">

              <div>

                <span class="order-code">
                  ${escapeHtml(
                    order.order_code
                  )}
                </span>

                <div class="order-date">
                  ${formatDate(
                    order.created_at
                  )}
                </div>

              </div>


              <div class="order-status">
                ${escapeHtml(
                  order.status
                )}
              </div>

            </div>


            <div class="order-items">

              ${
                items.length
                  ? items.map(item => `
                    <div class="order-item">

                      <div class="order-game-icon">
                        🎮
                      </div>

                      <div class="order-game">

                        <strong>
                          ${escapeHtml(
                            item.product_name ||
                            "Game"
                          )}
                        </strong>

                        ${
                          item.key
                            ? `
                              <div class="game-key">
                                <span>
                                  ${escapeHtml(
                                    item.key
                                  )}
                                </span>

                                <button
                                  class="copy-key"
                                  data-key="${escapeHtml(
                                    item.key
                                  )}"
                                >
                                  COPY
                                </button>
                              </div>
                            `
                            : ""
                        }

                      </div>

                    </div>
                  `).join("")
                  : `
                    <div class="order-item">
                      Không có game key.
                    </div>
                  `
              }

            </div>


            <div class="order-bottom">

              <span>
                Tổng tiền
              </span>

              <strong>
                ${formatMoney(
                  order.total
                )}
              </strong>

            </div>

          </article>
        `;

      }).join("");


    document
      .querySelectorAll(".copy-key")
      .forEach(button => {

        button.addEventListener(
          "click",
          async () => {

            const key =
              button.dataset.key;


            try {

              await navigator.clipboard.writeText(
                key
              );

              button.textContent =
                "COPIED";

              setTimeout(() => {
                button.textContent =
                  "COPY";
              }, 1500);

            } catch {

              alert(
                "Không thể copy key."
              );

            }

          }
        );

      });


  } catch (error) {

    console.error(error);

    ordersContainer.innerHTML = `
      <div class="account-empty">
        Không thể tải lịch sử đơn hàng.
      </div>
    `;

  }

}


document
  .getElementById("logoutButton")
  .addEventListener("click", () => {

    localStorage.removeItem(
      "pixelkey_token"
    );

    localStorage.removeItem(
      "pixelkey_user"
    );

    window.location.href =
      "./index.html";

  });


async function initAccount() {

  await loadAccount();

  await loadOrders();

}

function showTopupMessage(message, type = "") {
  if (!topupMessage) return;

  topupMessage.textContent = message;
  topupMessage.className =
    `topup-message ${type}`;
}


function formatTopupStatus(status) {
  const statuses = {
    pending: "ĐANG CHỜ THANH TOÁN",
    paid: "✓ NẠP TIỀN THÀNH CÔNG",
    cancelled: "ĐÃ HỦY",
    expired: "ĐÃ HẾT HẠN"
  };

  return statuses[status] || status;
}


async function createTopupOrder() {
  const amount = Number(
    topupAmount?.value
  );

  if (!amount || amount < 10000) {
    showTopupMessage(
      "Số tiền nạp tối thiểu là 10.000đ.",
      "error"
    );

    topupAmount?.focus();

    return;
  }

  if (amount > 50000000) {
    showTopupMessage(
      "Số tiền nạp tối đa là 50.000.000đ.",
      "error"
    );

    return;
  }

  createTopup.disabled = true;
  createTopup.textContent =
    "ĐANG TẠO ĐƠN...";

  showTopupMessage(
    "Đang tạo đơn nạp PayOS...",
    "loading"
  );

  try {
    const data = await API.post(
      "/topups",
      {
        amount
      }
    );

    currentTopupOrderCode =
      data.orderCode;

    topupOrderCode.textContent =
      data.orderCode;

    topupOrderAmount.textContent =
      formatMoney(data.amount);

    topupCheckout.href =
      data.checkoutUrl || "#";

    topupStatus.textContent =
      "ĐANG CHỜ THANH TOÁN";

    topupResult.hidden = false;

    showTopupMessage(
      "Đơn nạp đã được tạo. Hãy quét QR hoặc mở PayOS để thanh toán.",
      "success"
    );

    // Tạo QR từ chuỗi QR PayOS
    if (
      data.qrCode &&
      typeof QRCode !== "undefined"
    ) {
      QRCode.toCanvas(
        topupQr,
        data.qrCode,
        {
          width: 190,
          margin: 2
        },
        (error) => {
          if (error) {
            console.error(
              "QR error:",
              error
            );
          }
        }
      );
    }

    clearInterval(topupPollTimer);

    topupPollTimer =
      setInterval(
        checkTopupStatus,
        3000
      );

  } catch (error) {
    console.error(error);

    showTopupMessage(
      error.message ||
        "Không thể tạo đơn nạp tiền.",
      "error"
    );
  } finally {
    createTopup.disabled = false;

    createTopup.textContent =
      "💳 Nạp tiền qua PayOS";
  }
}


async function checkTopupStatus() {
  if (!currentTopupOrderCode) {
    return;
  }

  try {
    const data = await API.get(
      `/topups/${currentTopupOrderCode}`
    );

    const status =
      String(data.status || "")
        .toLowerCase();

    topupStatus.textContent =
      formatTopupStatus(status);

    if (status === "paid") {
      clearInterval(topupPollTimer);

      showTopupMessage(
        "✓ Nạp tiền thành công! Số dư của bạn đã được cộng.",
        "success"
      );

      await loadAccount();

      topupStatus.classList.add(
        "paid"
      );
    }

    if (
      status === "cancelled" ||
      status === "expired"
    ) {
      clearInterval(topupPollTimer);

      showTopupMessage(
        "Đơn nạp tiền đã hết hạn hoặc bị hủy.",
        "error"
      );
    }

  } catch (error) {
    console.error(
      "Topup status error:",
      error
    );
  }
}


// Nút số tiền nhanh

document
  .querySelectorAll("[data-topup]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        topupAmount.value =
          button.dataset.topup;

        topupAmount.focus();

      }
    );

  });


// Tạo đơn nạp

if (createTopup) {
  createTopup.addEventListener(
    "click",
    createTopupOrder
  );
}
// =========================
// TOP UP
// =========================

document.querySelectorAll(".topup-quick-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const amount = button.dataset.amount;
    document.getElementById("topupAmount").value = amount;
  });
});

const topupButton = document.getElementById("topupButton");

if (topupButton) {
  topupButton.addEventListener("click", async () => {
    const amountInput = document.getElementById("topupAmount");
    const result = document.getElementById("topupResult");

    const amount = Number(amountInput.value);

    if (!amount || amount < 10000) {
      result.innerHTML = "⚠️ Số tiền nạp tối thiểu là 10.000đ.";
      return;
    }

    try {
      topupButton.disabled = true;
      topupButton.textContent = "Đang tạo thanh toán...";

      const data = await API.post("/topups", {
        amount
      });

const qrBox = document.getElementById("topupQrBox");
const qrImage = document.getElementById("topupQr");

result.innerHTML = `
  <div class="topup-payment">

    <h3>Thanh toán đang chờ</h3>

    <p>
      Mã đơn:
      <strong>${data.orderCode}</strong>
    </p>

    <p>
      Số tiền:
      <strong>${formatMoney(data.amount)}</strong>
    </p>

    <p>
      Nội dung chuyển khoản:
      <strong>NAP ${data.orderCode}</strong>
    </p>

    <a
      href="${data.checkoutUrl}"
      target="_blank"
      class="btn btn-primary"
    >
      Mở trang thanh toán PayOS
    </a>

    <p class="topup-note">
      Quét mã QR hoặc mở trang PayOS để thanh toán.
    </p>

  </div>
`;

if (data.qrCode && qrImage && qrBox) {
  qrBox.hidden = false;

  QRCode.toDataURL(data.qrCode, {
    width: 280,
    margin: 2
  })
    .then((url) => {
      qrImage.src = url;
    })
    .catch((error) => {
      console.error("Không tạo được QR:", error);
    });
}

    } catch (error) {
      result.innerHTML = `
        <div class="topup-error">
          ❌ ${escapeHtml(error.message)}
        </div>
      `;
    } finally {
      topupButton.disabled = false;
      topupButton.textContent = "💳 Nạp tiền qua PayOS";
    }
  });
}
initAccount();
