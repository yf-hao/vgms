(() => {
  if (location.origin !== "https://vgms.fanyu.com") {
    return;
  }

  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
  let filling = false;
  let filled = false;
  let rerunRequested = false;
  let lastPathname = "";

  function isLoginPath(pathname) {
    return /^\/unified\/auth\/login(?:\/|$)/.test(pathname);
  }

  function showStatus(message, isError = false, centered = false) {
    let notice = document.querySelector("#vgms-login-autofill-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "vgms-login-autofill-notice";
      document.body.appendChild(notice);
    }
    Object.assign(notice.style, {
      position: "fixed",
      top: centered ? "50%" : "12px",
      left: centered ? "50%" : "auto",
      right: centered ? "auto" : "12px",
      transform: centered ? "translate(-50%, -50%)" : "none",
      zIndex: "2147483647",
      maxWidth: "min(420px, calc(100vw - 24px))",
      padding: "10px 14px",
      borderRadius: "5px",
      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
      color: "#fff",
      textAlign: centered ? "center" : "left",
      font: "14px/1.5 sans-serif"
    });
    notice.style.backgroundColor = isError ? "#b3261e" : "#137333";
    notice.textContent = `VGMS 填写助手：${message}`;
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function waitFor(getValue, timeout = 10000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = getValue();
      if (value) {
        return value;
      }
      await sleep(200);
    }
    return null;
  }

  function selectedSchool(input) {
    const selection = input
      .closest(".el-select__wrapper")
      ?.querySelector(".el-select__selection");
    const selectedItem = [...(selection?.querySelectorAll(".el-select__selected-item") || [])]
      .find((item) => !item.contains(input));
    return normalize(selectedItem?.textContent);
  }

  function findSchoolOption(school) {
    return [...document.querySelectorAll('[role="option"], .el-select-dropdown__item')]
      .find((item) =>
        item.getAttribute("aria-disabled") !== "true" &&
        normalize(item.textContent) === school
      );
  }

  async function clickSchoolOption(input, school) {
    const option = findSchoolOption(school);
    if (!option) {
      return false;
    }
    option.click();
    return Boolean(await waitFor(() => selectedSchool(input) === school, 3000));
  }

  async function chooseSchool(input, school) {
    if (selectedSchool(input) === school) {
      return true;
    }

    showStatus("正在加载学校列表，请稍候...", false, true);
    // 学校选项加载完成后再展开下拉框，避免显示“无数据”
    if (!(await waitFor(() => findSchoolOption(school), 20000))) {
      return false;
    }

    input.focus();
    input.click();
    return clickSchoolOption(input, school);
  }

  async function fillLoginForm() {
    if (!isLoginPath(location.pathname)) {
      return;
    }
    if (filling) {
      rerunRequested = true;
      return;
    }
    if (filled) {
      return;
    }
    filling = true;

    try {
      const stored = await chrome.storage.local.get("loginCredentials");
      const credentials = stored.loginCredentials;
      if (
        !credentials ||
        typeof credentials.school !== "string" ||
        typeof credentials.account !== "string" ||
        typeof credentials.password !== "string" ||
        !credentials.school.trim() ||
        !credentials.account.trim() ||
        !credentials.password
      ) {
        return;
      }

      const loginFields = await waitFor(() => {
        const fields = {
          schoolInput: document.querySelector("#login-field-1-school"),
          accountInput: document.querySelector("#login-field-1-account"),
          passwordInput: document.querySelector("#login-field-1-password"),
          agreeCheckbox: document.querySelector(
            ".form-panel__check[type='checkbox']"
          )
        };
        return Object.values(fields).every(Boolean) ? fields : null;
      }, 20000);
      if (!loginFields) {
        showStatus("未找到完整的登录表单，请刷新页面后重试。", true);
        return;
      }
      const {
        schoolInput,
        accountInput,
        passwordInput,
        agreeCheckbox
      } = loginFields;

      if (!(await chooseSchool(schoolInput, credentials.school.trim()))) {
        showStatus("学校未匹配或未能确认选择，请手动选择学校。", true);
        return;
      }

      setInputValue(accountInput, credentials.account.trim());
      setInputValue(passwordInput, credentials.password);
      if (!agreeCheckbox.checked) {
        agreeCheckbox.click();
      }
      filled = true;
      showStatus("已填入登录信息并勾选协议；请检查后手动登录。");
    } catch (error) {
      showStatus(`自动填写失败：${error.message}`, true);
    } finally {
      filling = false;
      if (rerunRequested) {
        rerunRequested = false;
        void fillLoginForm();
      }
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "local" &&
      changes.loginCredentials &&
      isLoginPath(location.pathname)
    ) {
      filled = false;
      void fillLoginForm();
    }
  });

  function checkRoute() {
    const { pathname } = location;
    if (pathname === lastPathname) {
      return;
    }
    lastPathname = pathname;
    if (isLoginPath(pathname)) {
      filled = false;
      void fillLoginForm();
    }
  }

  checkRoute();
  window.setInterval(checkRoute, 300);
})();
