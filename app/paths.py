
import os
import sys

from pathlib import Path


IS_FROZEN = bool(getattr(sys, "frozen", False))

PROJECT_ROOT = Path(__file__).resolve().parents[1]

BUNDLE_DIR = Path(
    getattr(sys, "_MEIPASS", PROJECT_ROOT)
)


if IS_FROZEN:
    # Persistent application data for Windows users.
    local_app_data = os.environ.get("LOCALAPPDATA")

    if local_app_data:
        DATA_DIR = (
            Path(local_app_data)
            / "PulseWatch"
            / "data"
        )
    else:
        DATA_DIR = (
            Path.home()
            / "AppData"
            / "Local"
            / "PulseWatch"
            / "data"
        )

else:
    # Keep the existing development data directory.
    DATA_DIR = PROJECT_ROOT / "data"
