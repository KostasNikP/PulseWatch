
import ctypes
from ctypes import wintypes


MUTEX_NAME = r"Local\PulseWatchDesktop"
ERROR_ALREADY_EXISTS = 183


def acquire_single_instance():
    """Prevent multiple desktop instances on Windows."""

    kernel32 = ctypes.WinDLL(
        "kernel32",
        use_last_error=True
    )

    kernel32.CreateMutexW.argtypes = [
        wintypes.LPVOID,
        wintypes.BOOL,
        wintypes.LPCWSTR
    ]
    kernel32.CreateMutexW.restype = wintypes.HANDLE

    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL

    handle = kernel32.CreateMutexW(
        None,
        False,
        MUTEX_NAME
    )

    error = ctypes.get_last_error()

    if not handle:
        raise ctypes.WinError(error)

    if error == ERROR_ALREADY_EXISTS:
        kernel32.CloseHandle(handle)

        ctypes.windll.user32.MessageBoxW(
            None,
            "PulseWatch is already running.",
            "PulseWatch",
            0x40
        )

        return None

    return handle


def release_single_instance(handle):
    """Release the instance handle on shutdown."""

    if handle:
        ctypes.windll.kernel32.CloseHandle(handle)
