const loginForm =
  document.getElementById("loginForm");

const registerForm =
  document.getElementById("registerForm");


function showMessage(element, message, type = "error") {

  if (!element) return;

  element.textContent = message;

  element.className =
    `form-message ${type}`;

}


function saveLogin(data) {

  if (!data.token) {
    throw new Error("Server không trả về token");
  }

  localStorage.setItem(
    "pixelkey_token",
    data.token
  );

  if (data.user) {

    localStorage.setItem(
      "pixelkey_user",
      JSON.stringify(data.user)
    );

  }

}


if (loginForm) {

  loginForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const message =
        document.getElementById("loginMessage");

      const username =
        document
          .getElementById("loginUsername")
          .value
          .trim();

      const password =
        document
          .getElementById("loginPassword")
          .value;


      showMessage(
        message,
        "Đang đăng nhập...",
        "loading"
      );


      try {

        const data = await API.post(
          "/auth/login",
          {
            username,
            password
          }
        );


        saveLogin(data);


        showMessage(
          message,
          "Đăng nhập thành công!",
          "success"
        );


        setTimeout(() => {

          if (data.user?.role === "admin") {

            window.location.href =
              "./admin.html";

          } else {

            window.location.href =
              "./account.html";

          }

        }, 500);


      } catch (error) {

        console.error(error);

        showMessage(
          message,
          error.message,
          "error"
        );

      }

    }
  );

}


if (registerForm) {

  registerForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const message =
        document.getElementById(
          "registerMessage"
        );


      const username =
        document
          .getElementById("registerUsername")
          .value
          .trim();


      const email =
        document
          .getElementById("registerEmail")
          .value
          .trim();


      const password =
        document
          .getElementById("registerPassword")
          .value;


      const confirmPassword =
        document
          .getElementById(
            "registerPasswordConfirm"
          )
          .value;


      if (password !== confirmPassword) {

        showMessage(
          message,
          "Mật khẩu nhập lại không khớp.",
          "error"
        );

        return;

      }


      showMessage(
        message,
        "Đang tạo tài khoản...",
        "loading"
      );


      try {

        const data = await API.post(
          "/auth/register",
          {
            username,
            email,
            password
          }
        );


        saveLogin(data);


        showMessage(
          message,
          "Đăng ký thành công!",
          "success"
        );


        setTimeout(() => {

          window.location.href =
            "./account.html";

        }, 500);


      } catch (error) {

        console.error(error);

        showMessage(
          message,
          error.message,
          "error"
        );

      }

    }
  );

}