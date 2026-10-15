// ==========================================
// PULSEWATCH - CONNECTION NOTIFICATIONS
// ==========================================

(() => {
    const connectionStatus =
        document.getElementById("connectionStatus");

    const toast =
        document.getElementById("connectionToast");

    if (!connectionStatus || !toast) {
        console.warn("Connection notification elements not found.");
        return;
    }

    let previousState =
        connectionStatus.dataset.state || "connecting";

    let hideTimeout = null;

    // Display a temporary notification
    function showNotification(message, type = "success") {
        clearTimeout(hideTimeout);

        toast.textContent = message;

        toast.classList.toggle(
            "error",
            type === "error"
        );

        toast.classList.add("show");

        hideTimeout = setTimeout(() => {
            toast.classList.remove("show");
        }, 3500);
    }

    // Watch for connection state changes
    const observer = new MutationObserver(() => {
        const currentState = connectionStatus.dataset.state;

        if (!currentState || currentState === previousState) {
            return;
        }

        // Connection restored
        if (
            currentState === "online" &&
            (previousState === "offline" ||
                previousState === "stale")
        ) {
            showNotification(
                "✓ Connection restored — Live monitoring resumed"
            );
        }

        // Connection lost
        if (
            currentState === "offline" &&
            (previousState === "online" ||
                previousState === "stale")
        ) {
            showNotification(
                "Connection lost — Attempting to reconnect...",
                "error"
            );
        }

        previousState = currentState;
    });

    observer.observe(connectionStatus, {
        attributes: true,
        attributeFilter: ["data-state"]
    });
})();