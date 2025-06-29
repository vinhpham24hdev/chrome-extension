// public/screenshot-preview.js - Separate JS file for popup window
let isUploading = false;

// Auto-detect current page URL
function initializeURL() {
  if (window.opener && !window.opener.closed) {
    try {
      document.getElementById("urlInput").value = window.opener.location.href;
    } catch (error) {
      console.log("Could not access opener URL");
    }
  }
}

function handleCancel() {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ action: "cancel" }, "*");
  }
  window.close();
}

function handleAddToCase() {
  if (isUploading) return;

  const name = document.getElementById("nameInput").value.trim();
  const description = document.getElementById("descriptionInput").value.trim();
  const url = document.getElementById("urlInput").value.trim();
  const selectedCase = document.getElementById("caseSelect").value;

  if (!name) {
    alert("Please enter a name for the screenshot");
    return;
  }

  // Show upload progress
  isUploading = true;
  document.getElementById("uploadSection").style.display = "block";
  document.getElementById("cancelBtn").disabled = true;
  document.getElementById("addBtn").disabled = true;
  document.getElementById("addBtn").innerHTML =
    '<div class="loading"></div> Adding...';

  // Simulate upload progress
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 100) progress = 100;

    document.getElementById("progressBar").style.width = progress + "%";
    document.getElementById("uploadPercent").textContent =
      Math.round(progress) + "%";

    if (progress >= 100) {
      clearInterval(interval);
      document.getElementById("uploadStatus").textContent = "Upload completed!";
      document.getElementById("successMessage").style.display = "block";

      setTimeout(() => {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              action: "addedToCase",
              data: { name, description, url, selectedCase },
            },
            "*"
          );
        }
        window.close();
      }, 1500);
    }
  }, 100);
}

// Setup event listeners when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize URL
  initializeURL();

  // Close button
  document.getElementById("closeBtn").addEventListener("click", function () {
    window.close();
  });

  // Cancel button
  document.getElementById("cancelBtn").addEventListener("click", handleCancel);

  // Add to case button
  document.getElementById("addBtn").addEventListener("click", handleAddToCase);

  // Auto-focus on name input
  document.getElementById("nameInput").focus();
});

// Listen for messages from parent
window.addEventListener("message", function (event) {
  // Handle any messages if needed
});
