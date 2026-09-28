const token = localStorage.getItem("pixelkey_token");

if (!token) {
  window.location.href = "./login.html";
}

let currentUser = null;
let users = [];
let products = [];
let currentKeyProductId = null;
let folders = [];
let currentFolderId = null;


// ============================
// HELPERS
// ============================

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND"
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("vi-VN");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ============================
// AUTH
// ============================

async function checkAdmin() {
  try {
    const data = await API.get("/auth/me");

    currentUser = data.user;

    if (currentUser.role !== "admin") {
      alert("Bạn không có quyền truy cập Admin.");

      window.location.href = "./account.html";
      return false;
    }

    return true;

  } catch (error) {

    localStorage.removeItem("pixelkey_token");
    localStorage.removeItem("pixelkey_user");

    window.location.href = "./login.html";

    return false;
  }
}

// ============================
// STATS
// ============================

async function loadStats() {
  try {
    const data = await API.get("/admin/stats");

    const stats = data.stats;

    document.getElementById("statUsers").textContent =
      Number(stats.users || 0);

    document.getElementById("statProducts").textContent =
      Number(stats.products || 0);

    document.getElementById("statKeys").textContent =
      Number(stats.keys || 0);

    document.getElementById("statOrders").textContent =
      Number(stats.orders || 0);

  } catch (error) {
    console.error("LOAD STATS ERROR:", error);
  }
}

// ============================
// USERS
// ============================

async function loadUsers() {

  const table = document.getElementById("usersTable");

  try {

    const data = await API.get("/admin/users");

    users = data.users || [];

    document.getElementById("statUsers").textContent =
      users.length;

    renderUsers(users);

  } catch (error) {

    table.innerHTML = `
      <tr>
        <td colspan="7" class="table-error">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}


function renderUsers(list) {

  const table = document.getElementById("usersTable");

  if (!list.length) {

    table.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">
          Không tìm thấy user.
        </td>
      </tr>
    `;

    return;
  }


  table.innerHTML = list.map(user => {

    const active = user.is_active;

    return `
      <tr>

        <td>#${user.id}</td>

        <td>
          <strong>${escapeHtml(user.username)}</strong>
        </td>

        <td>
          ${escapeHtml(user.email)}
        </td>

        <td>
          <span class="role-badge ${user.role}">
            ${escapeHtml(user.role)}
          </span>
        </td>

        <td>
          <strong class="money">
            ${formatMoney(user.balance)}
          </strong>
        </td>

        <td>
          <span class="status-badge ${active ? "active" : "blocked"}">
            ${active ? "ACTIVE" : "BLOCKED"}
          </span>
        </td>

        <td>

<div class="admin-actions">

  <button
    class="small-btn add-money"
    data-id="${user.id}"
    data-name="${escapeHtml(user.username)}"
  >
    + TIỀN
  </button>

  ${
    user.role !== "admin"
      ? `
        <button
          class="small-btn toggle-user"
          data-id="${user.id}"
          data-active="${active}"
        >
          ${active ? "KHÓA" : "MỞ"}
        </button>

        ${
          user.role === "seller"
            ? `
              <button
                class="small-btn seller-discount-btn"
                data-id="${user.id}"
                data-name="${escapeHtml(user.username)}"
                data-discount="${Number(user.seller_discount_percent || 0)}"
              >
                GIẢM ${Number(user.seller_discount_percent || 0)}%
              </button>

              <button
                class="small-btn seller-demote-btn"
                data-id="${user.id}"
                data-name="${escapeHtml(user.username)}"
              >
                HẠ SELLER
              </button>
            `
            : `
              <button
                class="small-btn seller-promote-btn"
                data-id="${user.id}"
                data-name="${escapeHtml(user.username)}"
              >
                NÂNG SELLER
              </button>
            `
        }
      `
      : ""
  }

</div>

        </td>

      </tr>
    `;

  }).join("");


  document.querySelectorAll(".add-money")
    .forEach(button => {

      button.addEventListener("click", () => {

        openBalanceModal(
          Number(button.dataset.id),
          button.dataset.name
        );

      });

    });


  document.querySelectorAll(".toggle-user")
    .forEach(button => {

      button.addEventListener("click", () => {

        toggleUser(
          Number(button.dataset.id),
          button.dataset.active === "true"
        );

      });

    });
document.querySelectorAll(".seller-promote-btn")
  .forEach(button => {

    button.addEventListener("click", () => {

      changeSellerRole(
        Number(button.dataset.id),
        "user",
        button.dataset.name
      );

    });

  });


document.querySelectorAll(".seller-demote-btn")
  .forEach(button => {

    button.addEventListener("click", () => {

      changeSellerRole(
        Number(button.dataset.id),
        "seller",
        button.dataset.name
      );

    });

  });


document.querySelectorAll(".seller-discount-btn")
  .forEach(button => {

    button.addEventListener("click", () => {

      changeSellerDiscount(
        Number(button.dataset.id),
        button.dataset.name,
        Number(button.dataset.discount || 0)
      );

    });

  });
}
// ============================
// SELLER
// ============================

async function changeSellerRole(userId, role, username) {

  const isSeller = role === "seller";

  const action = isSeller
    ? "hạ tài khoản này về User"
    : "nâng tài khoản này thành Seller";

  if (!confirm(
    `Bạn có chắc muốn ${action}?\n\n` +
    `Tài khoản: ${username}`
  )) {
    return;
  }

  try {

    await API.put(
      `/admin/users/${userId}/role`,
      {
        role: isSeller ? "user" : "seller"
      }
    );

    alert(
      isSeller
        ? `Đã hạ ${username} về User.`
        : `Đã nâng ${username} thành Seller.`
    );

    await loadUsers();

  } catch (error) {

    alert(error.message);
  }
}


// ============================
// SELLER DISCOUNT
// ============================

async function changeSellerDiscount(
  userId,
  username,
  currentDiscount
) {

  const input = prompt(
    `Nhập % giảm giá cho Seller "${username}":\n\n` +
    `Mức hiện tại: ${currentDiscount}%\n` +
    `Cho phép từ 0% đến 90%.`,
    currentDiscount
  );

  if (input === null) {
    return;
  }

  const discount = Number(input);

  if (
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > 90
  ) {
    alert("Mức giảm phải từ 0% đến 90%.");
    return;
  }

  try {

    await API.put(
      `/admin/users/${userId}/seller-discount`,
      {
        discount_percent: discount
      }
    );

    alert(
      `Đã cập nhật giảm giá cho ${username}: ${discount}%`
    );

    await loadUsers();

  } catch (error) {

    alert(error.message);
  }
}


// ============================
// BALANCE
// ============================
// ============================
// BALANCE
// ============================

function openBalanceModal(userId, username) {

  document.getElementById("balanceUserId").value =
    userId;

  document.getElementById("balanceUserName").textContent =
    `User: ${username}`;

  document.getElementById("balanceAmount").value = "";

  document
    .getElementById("balanceModal")
    .classList.remove("hidden");
}


async function addBalance() {

  const userId = Number(
    document.getElementById("balanceUserId").value
  );

  const amount = Number(
    document.getElementById("balanceAmount").value
  );

  if (!Number.isFinite(amount) || amount <= 0) {

    alert("Số tiền không hợp lệ.");

    return;
  }

  try {

    const result = await API.post(
      `/admin/users/${userId}/balance`,
      {
        amount
      }
    );

    alert(
      `Đã cộng ${formatMoney(amount)} cho ${result.user.username}.\n\n` +
      `Số dư mới: ${formatMoney(result.user.balance)}`
    );

    closeModal("balanceModal");

    await loadUsers();

  } catch (error) {

    alert(error.message);
  }
}


// ============================
// TOGGLE USER
// ============================

async function toggleUser(userId, currentlyActive) {

  const action = currentlyActive
    ? "khóa"
    : "mở khóa";

  if (!confirm(`Bạn có chắc muốn ${action} tài khoản này?`)) {
    return;
  }

  try {

    await API.put(
      `/admin/users/${userId}/status`,
      {
        is_active: !currentlyActive
      }
    );

    await loadUsers();

  } catch (error) {

    alert(error.message);
  }
}


// ============================
// PRODUCTS
// ============================

async function loadProducts() {

  const table =
    document.getElementById("productsTable");

  try {

    const response = await fetch(
      `${CONFIG.API_URL}/products`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Không thể tải sản phẩm"
      );
    }

    products = data.products || [];

    document.getElementById("statProducts").textContent =
      products.length;

    renderProducts(products);

  } catch (error) {

    table.innerHTML = `
      <tr>
        <td colspan="7" class="table-error">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}


function renderProducts(list) {

  const table =
    document.getElementById("productsTable");

  if (!list.length) {

    table.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">
          Chưa có sản phẩm.
        </td>
      </tr>
    `;

    return;
  }


  table.innerHTML = list.map(product => {

    return `
      <tr>

        <td>#${product.id}</td>

        <td>
          <strong>
            ${escapeHtml(product.name)}
          </strong>
        </td>

        <td>
          ${escapeHtml(product.category || "-")}
        </td>

        <td>
          ${formatMoney(product.price)}
        </td>

        <td>
          <strong>
            ${Number(product.stock || 0)}
          </strong>
        </td>

        <td>
          <span class="status-badge ${
            product.is_active
              ? "active"
              : "blocked"
          }">
            ${
              product.is_active
                ? "ACTIVE"
                : "HIDDEN"
            }
          </span>
        </td>

        <td>

          <div class="admin-actions">

            <button
              class="small-btn edit-product"
              data-id="${product.id}"
            >
              SỬA
            </button>

            <button
              class="small-btn key-product"
              data-id="${product.id}"
            >
              KEYS
            </button>

            <button
              class="small-btn danger delete-product"
              data-id="${product.id}"
            >
              XÓA
            </button>

          </div>

        </td>

      </tr>
    `;

  }).join("");


  document.querySelectorAll(".edit-product")
    .forEach(button => {

      button.addEventListener("click", () => {

        const product = products.find(
          item => Number(item.id) ===
                  Number(button.dataset.id)
        );

        if (product) {
          openProductModal(product);
        }

      });

    });


  document.querySelectorAll(".key-product")
    .forEach(button => {

      button.addEventListener("click", () => {

        const product = products.find(
          item => Number(item.id) ===
                  Number(button.dataset.id)
        );

        if (product) {
          openKeyModal(product);
        }

      });

    });


  document.querySelectorAll(".delete-product")
    .forEach(button => {

      button.addEventListener("click", () => {

        deleteProduct(
          Number(button.dataset.id)
        );

      });

    });

}

async function loadFolders() {
  const container = document.getElementById("foldersAdminList");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="table-loading">
      Đang tải folder...
    </div>
  `;

  try {
    const result = await API.get("/admin/folders");

    folders = result.folders || [];

    renderFolders();
  } catch (error) {
    console.error("LOAD FOLDERS ERROR:", error);

    container.innerHTML = `
      <div class="admin-error">
        Không thể tải danh sách folder.
      </div>
    `;
  }
}


function renderFolders() {
  const container =
    document.getElementById("foldersAdminList");

  if (!container) {
    return;
  }

  if (!folders.length) {
    container.innerHTML = `
      <tr>
        <td colspan="7">
          Chưa có Folder nào.
        </td>
      </tr>
    `;

    return;
  }

  container.innerHTML = folders.map(folder => {

    const imageHtml = folder.image_url
      ? `
        <img
          src="${escapeHtml(folder.image_url)}"
          alt="${escapeHtml(folder.name)}"
          style="
            width: 70px;
            height: 50px;
            object-fit: cover;
            border: 2px solid #111827;
          "
        >
      `
      : `
        <span>Không có ảnh</span>
      `;

    return `
      <tr>

        <td>
          #${folder.id}
        </td>

        <td>
          <strong>
            ${escapeHtml(folder.name)}
          </strong>
        </td>

        <td>
          ${escapeHtml(
            folder.description || "—"
          )}
        </td>

        <td>
          ${imageHtml}
        </td>

        <td>
          ${folder.sort_order}
        </td>

        <td>
          ${
            folder.is_active
              ? `
                <span class="status-badge active">
                  ACTIVE
                </span>
              `
              : `
                <span class="status-badge inactive">
                  HIDDEN
                </span>
              `
          }
        </td>

        <td>
<button
  type="button"
  class="btn btn-secondary folder-products-button"
  data-folder-id="${folder.id}"
>
  SẢN PHẨM
</button>
          <button
            type="button"
            class="btn btn-secondary edit-folder-button"
            data-folder-id="${folder.id}"
          >
            SỬA
          </button>

          <button
            type="button"
            class="btn btn-danger delete-folder-button"
            data-folder-id="${folder.id}"
          >
            XÓA
          </button>

        </td>

      </tr>
    `;
  }).join("");

  bindFolderButtons();
}


function bindFolderButtons() {

  document
    .querySelectorAll(".edit-folder-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          const folderId =
            Number(button.dataset.folderId);

          openFolderForm(folderId);
        }
      );

    });


  document
    .querySelectorAll(".delete-folder-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          const folderId =
            Number(button.dataset.folderId);

          deleteFolder(folderId);
        }
      );

    });


  document
    .querySelectorAll(".folder-products-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          const folderId =
            Number(button.dataset.folderId);

          openFolderProducts(folderId);
        }
      );

    });

}
async function openFolderProducts(folderId) {
  const modal = document.getElementById("folderProductsModal");
  const list = document.getElementById("folderProductsList");
  const title = document.getElementById("folderProductsTitle");

  if (!modal || !list) return;

  currentFolderId = folderId;

  const folder = folders.find(
    item => Number(item.id) === Number(folderId)
  );

  if (!folder) return;

  title.textContent = `Folder: ${folder.name}`;
  list.innerHTML = "Đang tải sản phẩm...";
  modal.style.display = "block";

  try {
    // Lấy sản phẩm hiện đang nằm trong Folder
    const result = await API.get(
      `/admin/folders/${folderId}/products`
    );

    const selectedProducts = result.products || [];

    const selectedIds = new Set(
      selectedProducts.map(product => Number(product.id))
    );

    if (!products.length) {
      await loadProducts();
    }

    if (!products.length) {
      list.innerHTML = "<p>Chưa có sản phẩm nào.</p>";
      return;
    }

    /*
     * Sản phẩm đã nằm trong Folder sẽ giữ nguyên
     * thứ tự hiện tại.
     *
     * Sản phẩm chưa nằm trong Folder sẽ nằm phía dưới.
     */
    const selectedMap = new Map(
      selectedProducts.map(product => [
        Number(product.id),
        product
      ])
    );

    const orderedProducts = [
      ...selectedProducts,
      ...products.filter(
        product => !selectedIds.has(Number(product.id))
      )
    ];

    list.innerHTML = orderedProducts.map(product => {

      const productId = Number(product.id);

      const checked = selectedIds.has(productId)
        ? "checked"
        : "";

      return `
        <div
          class="folder-product-item"
          data-product-id="${productId}"
          style="
            display:flex;
            align-items:center;
            gap:10px;
            padding:12px;
            margin-bottom:8px;
            border:1px solid #333;
            border-radius:8px;
          "
        >

          <input
            type="checkbox"
            class="folder-product-checkbox"
            value="${productId}"
            ${checked}
          >

          <div style="flex:1;">
            <strong>${escapeHtml(product.name)}</strong>
            <div style="font-size:13px; opacity:0.7;">
              #${productId}
            </div>
          </div>

          <button
            type="button"
            class="btn btn-secondary folder-product-up"
            title="Đưa lên"
          >
            ↑
          </button>

          <button
            type="button"
            class="btn btn-secondary folder-product-down"
            title="Đưa xuống"
          >
            ↓
          </button>

        </div>
      `;
    }).join("");

    // Nút ↑
    list.querySelectorAll(
      ".folder-product-up"
    ).forEach(button => {

      button.addEventListener("click", () => {

        const item =
          button.closest(".folder-product-item");

        if (!item) return;

        const previous =
          item.previousElementSibling;

        if (!previous) return;

        item.parentNode.insertBefore(
          item,
          previous
        );
      });

    });

    // Nút ↓
    list.querySelectorAll(
      ".folder-product-down"
    ).forEach(button => {

      button.addEventListener("click", () => {

        const item =
          button.closest(".folder-product-item");

        if (!item) return;

        const next =
          item.nextElementSibling;

        if (!next) return;

        item.parentNode.insertBefore(
          next,
          item
        );
      });

    });

  } catch (error) {

    console.error(
      "LOAD FOLDER PRODUCTS ERROR:",
      error
    );

    list.innerHTML =
      "<p>Không thể tải sản phẩm.</p>";
  }
}
// ============================
// PRODUCT MODAL
// ============================

function openProductModal(product = null) {

  document
    .getElementById("productModal")
    .classList.remove("hidden");


  document.getElementById("productId").value =
    product?.id || "";

  document.getElementById("productName").value =
    product?.name || "";

  document.getElementById("productSlug").value =
    product?.slug || "";

  document.getElementById("productCategory").value =
    product?.category || "Game";

  document.getElementById("productPrice").value =
    product?.price || "";

  document.getElementById("productImage").value =
    product?.image_url || "";

  document.getElementById("productDescription").value =
    product?.description || "";

  document.getElementById("productActive").checked =
    product?.is_active !== false;


  document.getElementById("productModalTitle")
    .textContent =
      product
        ? "Sửa sản phẩm"
        : "Thêm game";
}


async function saveProduct(event) {

  event.preventDefault();


  const id =
    document.getElementById("productId").value;


  const body = {

    name:
      document.getElementById("productName").value.trim(),

    slug:
      document.getElementById("productSlug").value.trim(),

    category:
      document.getElementById("productCategory").value.trim(),

    price:
      Number(document.getElementById("productPrice").value),

    image_url:
      document.getElementById("productImage").value.trim(),

    description:
      document.getElementById("productDescription").value.trim(),

    is_active:
      document.getElementById("productActive").checked

  };


  try {

    if (id) {

      await API.put(
        `/products/${id}`,
        body
      );

      alert("Đã cập nhật sản phẩm.");

    } else {

      await API.post(
        "/products",
        body
      );

      alert("Đã thêm sản phẩm.");
    }


    closeModal("productModal");

    await loadProducts();

  } catch (error) {

    alert(error.message);
  }
}


// ============================
// DELETE PRODUCT
// ============================

async function deleteProduct(id) {

  const product = products.find(
    item => Number(item.id) === id
  );

  if (!product) return;


  if (
    !confirm(
      `Xóa sản phẩm "${product.name}"?\n\n` +
      `Chỉ nên xóa sản phẩm chưa có giao dịch.`
    )
  ) {
    return;
  }


  try {

    await API.delete(
      `/products/${id}`
    );

    alert("Đã xóa sản phẩm.");

    await loadProducts();

  } catch (error) {

    alert(error.message);
  }
}


// ============================
// GAME KEYS
// ============================

function openKeyModal(product) {

  currentKeyProductId =
    Number(product.id);

  document.getElementById("keyProductName")
    .textContent =
      product.name;

  document.getElementById("keyInput").value = "";

  document
    .getElementById("keyModal")
    .classList.remove("hidden");

  loadKeys(product.id);
}


async function loadKeys(productId) {

  const container =
    document.getElementById("keyList");

  container.innerHTML =
    "Đang tải key...";


  try {

    const data = await API.get(
      `/products/${productId}/keys`
    );

    const keys = data.keys || [];


    if (!keys.length) {

      container.innerHTML =
        `<div class="key-empty">Chưa có key.</div>`;

      return;
    }


    container.innerHTML = keys.map(key => {

      return `
        <div class="key-row">

          <span>
            ${escapeHtml(key.key_value)}
          </span>

          <span class="key-status">
            ${escapeHtml(key.status)}
          </span>

          ${
            key.status === "available"
              ? `
                <button
                  class="small-btn danger delete-key"
                  data-id="${key.id}"
                >
                  XÓA
                </button>
              `
              : ""
          }

        </div>
      `;

    }).join("");


    document.querySelectorAll(".delete-key")
      .forEach(button => {

        button.addEventListener("click", () => {

          deleteKey(
            Number(button.dataset.id)
          );

        });

      });


  } catch (error) {

    container.innerHTML =
      `<div class="table-error">
        ${escapeHtml(error.message)}
      </div>`;
  }
}


async function addKeys() {

  const raw =
    document.getElementById("keyInput")
      .value.trim();


  if (!raw) {

    alert("Hãy nhập ít nhất một key.");

    return;
  }


  const keys = raw
    .split(/\r?\n/)
    .map(key => key.trim())
    .filter(Boolean);


  if (!keys.length) {

    alert("Không có key hợp lệ.");

    return;
  }


  try {

    const result = await API.post(
      `/products/${currentKeyProductId}/keys`,
      {
        keys
      }
    );


    alert(
      `Đã thêm ${result.added || keys.length} key.`
    );


    document.getElementById("keyInput").value = "";

    await loadKeys(currentKeyProductId);
    await loadProducts();

  } catch (error) {

    alert(error.message);
  }
}


async function deleteKey(keyId) {

  if (!confirm("Xóa game key này?")) {
    return;
  }


  try {

    await API.delete(
      `/products/keys/${keyId}`
    );

    await loadKeys(currentKeyProductId);

    await loadProducts();

  } catch (error) {

    alert(error.message);
  }
}


// ============================
// ORDERS
// ============================

async function loadOrders() {

  const table =
    document.getElementById("ordersTable");

  try {

    const data =
      await API.get("/admin/orders");

    const orders =
      data.orders || [];


    document.getElementById("statOrders")
      .textContent =
        orders.length;


    if (!orders.length) {

      table.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty">
            Chưa có đơn hàng.
          </td>
        </tr>
      `;

      return;
    }


    table.innerHTML = orders.map(order => {

      return `
        <tr>

          <td>#${order.id}</td>

          <td>
            <strong>
              ${escapeHtml(order.order_code)}
            </strong>
          </td>

          <td>
            ${escapeHtml(order.username || "-")}
          </td>

          <td>
            ${formatMoney(order.total)}
          </td>

          <td>
            ${escapeHtml(order.payment_method || "-")}
          </td>

          <td>
            <span class="status-badge active">
              ${escapeHtml(order.status)}
            </span>
          </td>

          <td>
            ${formatDate(order.created_at)}
          </td>

        </tr>
      `;

    }).join("");


  } catch (error) {

    table.innerHTML = `
      <tr>
        <td colspan="7" class="table-error">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}


// ============================
// MODAL
// ============================

function closeModal(id) {

  document
    .getElementById(id)
    .classList.add("hidden");
}


document
  .getElementById("closeProductModal")
  .addEventListener("click", () =>
    closeModal("productModal")
  );


document
  .getElementById("closeKeyModal")
  .addEventListener("click", () =>
    closeModal("keyModal")
  );


document
  .getElementById("closeBalanceModal")
  .addEventListener("click", () =>
    closeModal("balanceModal")
  );


document
  .getElementById("newProductButton")
  .addEventListener("click", () =>
    openProductModal()
  );


document
  .getElementById("productForm")
  .addEventListener(
    "submit",
    saveProduct
  );


document
  .getElementById("addKeysButton")
  .addEventListener(
    "click",
    addKeys
  );


document
  .getElementById("addBalanceButton")
  .addEventListener(
    "click",
    addBalance
  );


// ============================
// USER SEARCH
// ============================

document
  .getElementById("userSearch")
  .addEventListener("input", event => {

    const keyword =
      event.target.value
        .trim()
        .toLowerCase();


    if (!keyword) {

      renderUsers(users);

      return;
    }


    const filtered =
      users.filter(user =>
        user.username
          ?.toLowerCase()
          .includes(keyword) ||

        user.email
          ?.toLowerCase()
          .includes(keyword)
      );


    renderUsers(filtered);
  });


// ============================
// LOGOUT
// ============================

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


// ============================
// INIT
// ============================

async function initAdmin() {

  const allowed =
    await checkAdmin();

  if (!allowed) return;

  await Promise.all([
    loadStats(),
    loadUsers(),
    loadProducts(),
    loadOrders(),
    loadFolders()
  ]);

  initFolderEvents();
}

initAdmin();
