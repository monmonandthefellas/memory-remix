import { onReady } from "./dom.js";

let micModalShown = false;
let micPermissionGranted = false;

async function checkMicPermission() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return "prompt";
    const result = await navigator.permissions.query({ name: "microphone" });
    return result.state;
  } catch (e) {
    console.warn("Permission query not supported", e);
    return "prompt";
  }
}

function showMicModal() {
  const modal = document.getElementById("mic-permission-modal");
  const errorDiv = document.getElementById("mic-modal-error");
  if (!modal) return false;
  errorDiv.classList.remove("visible");
  modal.classList.add("active");
  micModalShown = true;
  return true;
}

function hideMicModal() {
  const modal = document.getElementById("mic-permission-modal");
  if (modal) modal.classList.remove("active");
}

function showMicModalError() {
  const errorDiv = document.getElementById("mic-modal-error");
  if (errorDiv) errorDiv.classList.add("visible");
}

onReady(() => {
  const modalBtn = document.getElementById("mic-modal-btn");
  if (modalBtn) {
    modalBtn.addEventListener("click", () => {
      hideMicModal();
    });
  }
});

window.showMicPermissionModal = showMicModal;
window.hideMicPermissionModal = hideMicModal;
window.showMicPermissionModalError = showMicModalError;
window.checkMicPermission = checkMicPermission;
window.isMicPermissionGranted = () => micPermissionGranted;
window.setMicPermissionGranted = (granted) => {
  micPermissionGranted = granted;
};
