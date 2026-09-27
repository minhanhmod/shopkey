const productsGrid = document.getElementById("productsGrid");
const searchInput = document.getElementById("searchInput");

let products = [];
let currentUser = null;


// ============================
// FORMAT MONEY
// ============================

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND"
  }).format(Number(value || 0));
}


// ============================
// ESCAPE HTML
// ============================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ============================
// GET SELLER PRICE
// ============================

function getProductPrice(product) {

  const originalPrice = Number(product.price || 0);

  if (
    currentUser &&
    currentUser.role === "seller"
  ) {

    const discountPercent =
      Number(
        currentUser.seller_discount_percent || 0
      );

    const discount =
      originalPrice * discountPercent / 100;

    return Number(
      (originalPrice - discount).toFixed(2)
    );
  }

  return originalPrice;
}


// ============================
// RENDER PRODUCTS
// ============================

function renderProducts(list) {

  if (!list.length) {

    productsGrid.innerHTML = `
      <div class="empty">
        Không tìm thấy game nào.
      </div>
    `;

    return;
  }


  productsGrid.innerHTML =
    list.map(product => {

      const image = product.image_url
        ? `
          <img
            src="${escapeHtml(product.image_url)}"
            alt="${escapeHtml(product.name)}"
          >
        `
        : `
          <div class="product-placeholder">
            🎮
          </div>
        `;


      const stock =
        Number(product.stock || 0);


      const loggedIn =
        Boolean(
          localStorage.getItem("pixelkey_token")
        );


      const originalPrice =
        Number(product.price || 0);


      const finalPrice =
        getProductPrice(product);


      const isSeller =
        currentUser &&
        currentUser.role === "seller";


      const discountPercent =
        isSeller
          ? Number(
              currentUser.seller_discount_percent || 0
            )
          : 0;


      let priceHtml;


      if (
        isSeller &&
        discountPercent > 0
      ) {

        priceHtml = `
          <div class="product-price">
            ${formatMoney(finalPrice)}
          </div>

          <div
            class="product-original-price"
            style="
              text-decoration: line-through;
              opacity: 0.6;
              font-size: 0.85em;
            "
          >
            ${formatMoney(originalPrice)}
          </div>

          <div
            class="product-discount"
            style="
              font-size: 0.85em;
              font-weight: 600;
            "
          >
            Seller -${discountPercent}%
          </div>
        `;

      } else {

        priceHtml = `
          <div class="product-price">
            ${formatMoney(finalPrice)}
          </div>
        `;

      }


      let buyButton;


      if (stock <= 0) {

        buyButton = `
          <button
            class="btn btn-disabled"
            disabled
          >
            HẾT HÀNG
          </button>
        `;

} else {

  buyButton = `
    <div class="quantity-box">

      <button
        type="button"
        class="quantity-minus"
        data-product-id="${product.id}"
      >
        −
      </button>

      <span
        class="quantity-value"
        data-product-id="${product.id}"
      >
        1
      </span>

      <button
        type="button"
        class="quantity-plus"
        data-product-id="${product.id}"
      >
        +
      </button>

    </div>

    <div
      class="quantity-total"
      data-product-id="${product.id}"
    >
      Tổng: ${formatMoney(finalPrice)}
    </div>

    <button
      class="btn btn-primary buy-button"
      data-product-id="${product.id}"
      data-price="${finalPrice}"
      data-stock="${stock}"
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
              ${escapeHtml(
                product.category || "GAME"
              )}
            </div>


            <h3 class="product-name">
              ${escapeHtml(
                product.name
              )}
            </h3>


            <p class="product-description">
              ${escapeHtml(
                product.description ||
                "Game key kỹ thuật số."
              )}
            </p>


            <div class="product-footer">

              <div>

                ${priceHtml}

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

document
  .querySelectorAll(".quantity-minus")
  .forEach(button => {

    button.addEventListener("click", () => {

      const productId =
        Number(button.dataset.productId);

      const valueElement =
        document.querySelector(
          `.quantity-value[data-product-id="${productId}"]`
        );

      const totalElement =
        document.querySelector(
          `.quantity-total[data-product-id="${productId}"]`
        );

      const product =
        products.find(
          item =>
            Number(item.id) === productId
        );

      if (
        !valueElement ||
        !totalElement ||
        !product
      ) {
        return;
      }

      let quantity =
        Number(valueElement.textContent);

      quantity =
        Math.max(1, quantity - 1);

      valueElement.textContent =
        quantity;

      const price =
        getProductPrice(product);

      totalElement.textContent =
        `Tổng: ${formatMoney(
          price * quantity
        )}`;

    });

  });


document
  .querySelectorAll(".quantity-plus")
  .forEach(button => {

    button.addEventListener("click", () => {

      const productId =
        Number(button.dataset.productId);

      const valueElement =
        document.querySelector(
          `.quantity-value[data-product-id="${productId}"]`
        );

      const totalElement =
        document.querySelector(
          `.quantity-total[data-product-id="${productId}"]`
        );

      const product =
        products.find(
          item =>
            Number(item.id) === productId
        );

      if (
        !valueElement ||
        !totalElement ||
        !product
      ) {
        return;
      }

      let quantity =
        Number(valueElement.textContent);

      const stock =
        Number(product.stock || 0);

      quantity =
        Math.min(stock, quantity + 1);

      valueElement.textContent =
        quantity;

      const price =
        getProductPrice(product);

      totalElement.textContent =
        `Tổng: ${formatMoney(
          price * quantity
        )}`;

    });

  });
  document
    .querySelectorAll(".buy-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          buyProduct(
            Number(
              button.dataset.productId
            ),
            button
          );

        }
      );

    });

}


// ============================
// LOAD CURRENT USER
// ============================

async function loadCurrentUser() {

  const token =
    localStorage.getItem(
      "pixelkey_token"
    );


  if (!token) {

    currentUser = null;

    return;

  }


  try {

    const response =
      await API.get("/auth/me");


    currentUser =
      response.user || null;


    if (currentUser) {

      localStorage.setItem(
        "pixelkey_user",
        JSON.stringify(currentUser)
      );

    }

  } catch (error) {

    console.error(
      "Không thể tải thông tin user:",
      error
    );


    try {

      currentUser =
        JSON.parse(
          localStorage.getItem(
            "pixelkey_user"
          ) || "null"
        );

    } catch {

      currentUser = null;

    }

  }

}


// ============================
// LOAD PRODUCTS
// ============================

async function loadProducts() {

  try {

    const response =
      await fetch(
        `${CONFIG.API_URL}/products`
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.message ||
        "Không thể tải sản phẩm"
      );

    }


    products =
      data.products || [];


    renderProducts(products);

  } catch (error) {

    console.error(error);


    productsGrid.innerHTML = `
      <div class="empty">

        Không thể kết nối đến máy chủ PIXELKEY.

        <br><br>

        Hãy kiểm tra backend đang chạy ở
        <strong>
          localhost:10000
        </strong>.

      </div>
    `;

  }

}


// ============================
// BUY PRODUCT
// ============================

async function buyProduct(
  productId,
  button
) {

  const token =
    localStorage.getItem(
      "pixelkey_token"
    );

  // Chưa đăng nhập
  if (!token) {

    const goLogin =
      confirm(
        "Bạn cần đăng nhập để mua game.\n\n" +
        "Đi tới trang đăng nhập?"
      );

    if (goLogin) {

      window.location.href =
        "./login.html";

    }

    return;

  }

  const product =
    products.find(
      item =>
        Number(item.id) ===
        Number(productId)
    );

  if (!product) {

    alert(
      "Không tìm thấy sản phẩm."
    );

    return;

  }

  // Lấy số lượng từ ô quantity
  const quantityElement =
    document.querySelector(
      `.quantity-value[data-product-id="${productId}"]`
    );

  let quantity =
    Number(
      quantityElement?.textContent || 1
    );

  if (!Number.isInteger(quantity) || quantity < 1) {
    quantity = 1;
  }

  const stock =
    Number(product.stock || 0);

  if (quantity > stock) {

    alert(
      `Kho chỉ còn ${stock} key.`
    );

    return;

  }

  const finalPrice =
    getProductPrice(product);

  const total =
    finalPrice * quantity;

  const confirmed =
    confirm(
      `Bạn có chắc muốn mua "${product.name}"?\n\n` +
      `Số lượng: ${quantity} key\n` +
      `Đơn giá: ${formatMoney(finalPrice)}\n` +
      `Tổng tiền: ${formatMoney(total)}`
    );

  if (!confirmed) {

    return;

  }

  const oldText =
    button.textContent;

  button.disabled = true;

  button.textContent =
    "ĐANG MUA...";

  try {

    const result =
      await API.post(
        "/orders",
        {
          product_id: productId,
          quantity: quantity
        }
      );

    const keys =
      Array.isArray(result.game_keys)
        ? result.game_keys
        : [];

    const keyText =
      keys.length > 0
        ? keys
            .map(
              (key, index) =>
                `${index + 1}. ${key}`
            )
            .join("\n")
        : "Không có key";

    alert(
      `MUA GAME THÀNH CÔNG!\n\n` +

      `Game: ${
        result.order.product_name
      }\n` +

      `Số lượng: ${
        result.order.quantity
      } key\n` +

      `Mã đơn: ${
        result.order.order_code
      }\n\n` +

      `GAME KEY:\n` +
      `${keyText}\n\n` +

      `Tổng tiền: ${
        formatMoney(
          result.order.total
        )
      }\n` +

      `Số dư còn lại: ${
        formatMoney(
          result.balance
        )
      }`
    );

    // Cập nhật user local
    try {

      const user =
        JSON.parse(
          localStorage.getItem(
            "pixelkey_user"
          ) || "{}"
        );

      user.balance =
        result.balance;

      localStorage.setItem(
        "pixelkey_user",
        JSON.stringify(user)
      );

    } catch {}

    // Tải lại sản phẩm
    await loadProducts();

  } catch (error) {

    console.error(error);

    alert(
      `Không thể mua game.\n\n` +
      `${error.message}`
    );

    button.disabled = false;

    button.textContent =
      oldText;

  }

}

// ============================
// SEARCH
// ============================

searchInput?.addEventListener(
  "input",
  () => {

    const keyword =
      searchInput.value
        .trim()
        .toLowerCase();


    const filtered =
      products.filter(product =>

        product.name
          ?.toLowerCase()
          .includes(keyword)

        ||

        product.category
          ?.toLowerCase()
          .includes(keyword)

        ||

        product.description
          ?.toLowerCase()
          .includes(keyword)

      );


    renderProducts(filtered);

  }
);


// ============================
// INIT
// ============================

async function initHome() {

  await loadCurrentUser();

  await loadProducts();

}


initHome();
