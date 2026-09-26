const productsGrid = document.getElementById("productsGrid");
const searchInput = document.getElementById("searchInput");

let products = [];

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

function renderProducts(list) {
  if (!list.length) {
    productsGrid.innerHTML = `
      <div class="empty">
        Không tìm thấy game nào.
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = list.map(product => {
    const image = product.image_url
      ? `<img src="${escapeHtml(product.image_url)}"
              alt="${escapeHtml(product.name)}">`
      : `<div class="product-placeholder">🎮</div>`;

    const stock = Number(product.stock || 0);
    const loggedIn = Boolean(localStorage.getItem("pixelkey_token"));

    let buyButton;

    if (stock <= 0) {
      buyButton = `
        <button class="btn btn-disabled" disabled>
          HẾT HÀNG
        </button>
      `;
    } else {
      buyButton = `
        <button
          class="btn btn-primary buy-button"
          data-product-id="${product.id}"
        >
          MUA NGAY
        </button>
      `;
    }

    return `
      <article class="product-card">
        <div class="product-image">
          ${image}
        </div>

        <div class="product-body">
          <div class="product-category">
            ${escapeHtml(product.category || "GAME")}
          </div>

          <h3 class="product-name">
            ${escapeHtml(product.name)}
          </h3>

          <p class="product-description">
            ${escapeHtml(
              product.description || "Game key kỹ thuật số."
            )}
          </p>

          <div class="product-footer">
            <div>
              <div class="product-price">
                ${formatMoney(product.price)}
              </div>

              <div class="product-stock">
                ${
                  stock > 0
                    ? `Còn ${stock} key`
                    : "Hết hàng"
                }
              </div>
            </div>

            ${buyButton}
          </div>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".buy-button").forEach(button => {
    button.addEventListener("click", () => {
      buyProduct(Number(button.dataset.productId), button);
    });
  });
}

async function loadProducts() {
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

    renderProducts(products);
  } catch (error) {
    console.error(error);

    productsGrid.innerHTML = `
      <div class="empty">
        Không thể kết nối đến máy chủ PIXELKEY.
        <br><br>
        Hãy kiểm tra backend đang chạy ở
        <strong>localhost:10000</strong>.
      </div>
    `;
  }
}

async function buyProduct(productId, button) {
  const token = localStorage.getItem("pixelkey_token");

  // Chưa đăng nhập
  if (!token) {
    const goLogin = confirm(
      "Bạn cần đăng nhập để mua game.\n\nĐi tới trang đăng nhập?"
    );

    if (goLogin) {
      window.location.href = "./login.html";
    }

    return;
  }

  const product = products.find(
    item => Number(item.id) === Number(productId)
  );

  if (!product) {
    alert("Không tìm thấy sản phẩm.");
    return;
  }

  const price = formatMoney(product.price);

  const confirmed = confirm(
    `Bạn có chắc muốn mua "${product.name}" với giá ${price} không?`
  );

  if (!confirmed) {
    return;
  }

  const oldText = button.textContent;

  button.disabled = true;
  button.textContent = "ĐANG MUA...";

  try {
    const result = await API.post("/orders", {
      product_id: productId
    });

    alert(
      `MUA GAME THÀNH CÔNG!\n\n` +
      `Game: ${result.order.product_name}\n` +
      `Mã đơn: ${result.order.order_code}\n\n` +
      `GAME KEY:\n${result.game_key}\n\n` +
      `Số dư còn lại: ${formatMoney(result.balance)}`
    );

    // Cập nhật user local
    try {
      const user = JSON.parse(
        localStorage.getItem("pixelkey_user") || "{}"
      );

      user.balance = result.balance;

      localStorage.setItem(
        "pixelkey_user",
        JSON.stringify(user)
      );
    } catch {}

    // Tải lại sản phẩm để cập nhật stock
    await loadProducts();

  } catch (error) {
    console.error(error);

    alert(
      `Không thể mua game.\n\n${error.message}`
    );

    button.disabled = false;
    button.textContent = oldText;
  }
}

searchInput?.addEventListener("input", () => {
  const keyword = searchInput.value
    .trim()
    .toLowerCase();

  const filtered = products.filter(product =>
    product.name?.toLowerCase().includes(keyword) ||
    product.category?.toLowerCase().includes(keyword) ||
    product.description?.toLowerCase().includes(keyword)
  );

  renderProducts(filtered);
});

loadProducts();