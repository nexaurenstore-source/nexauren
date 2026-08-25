(() => {
  "use strict";

  const input = document.querySelector("#image-input");
  const uploadError = document.querySelector("#upload-error");
  const screens = [...document.querySelectorAll("[data-screen]")];
  const editorPreview = document.querySelector("#editor-preview");
  const resultPreview = document.querySelector("#result-preview");
  const widthInput = document.querySelector("#width-input");
  const heightInput = document.querySelector("#height-input");
  const lockRatio = document.querySelector("#lock-ratio");
  const formatSelect = document.querySelector("#format-select");
  const originalSize = document.querySelector("#original-size");
  const resultSize = document.querySelector("#result-size");
  const resultFormat = document.querySelector("#result-format");
  const modal = document.querySelector("#download-modal");

  let image = null;
  let objectUrl = null;
  let resultObjectUrl = null;
  let outputBlob = null;
  let ratio = 1;
  let tool = { id: "image-resizer", name: "Image Resizer", url: "/tools/image/image-resizer/" };

  const showScreen = (name) => {
    screens.forEach((screen) => {
      const active = screen.dataset.screen === name;
      screen.hidden = !active;
      screen.classList.toggle("is-active", active);
    });
  };

  const setError = (message = "") => {
    if (!uploadError) return;
    uploadError.textContent = message;
    uploadError.hidden = !message;
  };

  const loadImage = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      return;
    }

    setError();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    image = new Image();
    image.onload = () => {
      ratio = image.width / image.height;
      widthInput.value = image.width;
      heightInput.value = image.height;
      originalSize.textContent = `${image.width} × ${image.height}`;
      editorPreview.src = objectUrl;
      showScreen("editor");
      window.Nexauren?.trackTool?.("tool_start", tool, { title: "Image selected" });
    };
    image.onerror = () => setError("This image could not be loaded in your browser.");
    image.src = objectUrl;
  };

  input?.addEventListener("change", () => loadImage(input.files?.[0]));
  document.querySelector(".upload-area")?.addEventListener("dragover", (event) => { event.preventDefault(); });
  document.querySelector(".upload-area")?.addEventListener("drop", (event) => { event.preventDefault(); loadImage(event.dataTransfer.files?.[0]); });

  widthInput?.addEventListener("input", () => {
    if (lockRatio.checked && widthInput.value) heightInput.value = Math.max(1, Math.round(Number(widthInput.value) / ratio));
  });
  heightInput?.addEventListener("input", () => {
    if (lockRatio.checked && heightInput.value) widthInput.value = Math.max(1, Math.round(Number(heightInput.value) * ratio));
  });

  const buildResult = () => {
    if (!image) return;
    const width = Math.max(1, Number.parseInt(widthInput.value, 10) || image.width);
    const height = Math.max(1, Number.parseInt(heightInput.value, 10) || image.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) { setError("Your browser could not prepare the image."); return; }
    if (formatSelect.value === "image/jpeg") { context.fillStyle = "#ffffff"; context.fillRect(0, 0, width, height); }
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) { setError("The image could not be processed."); return; }
      outputBlob = blob;
      if (resultObjectUrl) URL.revokeObjectURL(resultObjectUrl);
      resultObjectUrl = URL.createObjectURL(blob);
      resultPreview.src = resultObjectUrl;
      resultSize.textContent = `${width} × ${height}`;
      resultFormat.textContent = formatSelect.selectedOptions[0].textContent;
      showScreen("result");
      window.Nexauren?.trackTool?.("tool_process", tool, { title: "Image resized" });
    }, formatSelect.value, formatSelect.value === "image/jpeg" ? 0.92 : undefined);
  };

  const download = () => {
    if (!outputBlob) return;
    const extension = formatSelect.value === "image/jpeg" ? "jpg" : formatSelect.value.split("/")[1];
    const url = URL.createObjectURL(outputBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nexauren-resized-image.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    window.Nexauren?.trackTool?.("tool_download", tool, { title: "Image downloaded" });
    closeModal();
  };

  const openModal = () => { modal.hidden = false; modal.setAttribute("aria-hidden", "false"); modal.querySelector("button, a")?.focus(); };
  const closeModal = () => { modal.hidden = true; modal.setAttribute("aria-hidden", "true"); };

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "back-upload") showScreen("upload");
    if (action === "preview") buildResult();
    if (action === "back-editor") showScreen("editor");
    if (action === "download") openModal();
    if (action === "close-modal") closeModal();
    if (action === "confirm-download") download();
  });

  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeModal(); });

  window.addEventListener("beforeunload", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (resultObjectUrl) URL.revokeObjectURL(resultObjectUrl);
  });

  window.Nexauren?.loadTools?.().then(tools => {
    const found = tools.find(item => item.id === "image-resizer");
    if (found) tool = found;
    window.Nexauren?.trackTool?.("tool_open", tool);
  }).catch(() => window.Nexauren?.trackTool?.("tool_open", tool));
})();
