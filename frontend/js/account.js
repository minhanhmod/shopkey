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


initAccount();