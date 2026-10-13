"""Dismiss native dialogs in the disposable E2E profile without replacing API handlers."""

import aqt
from pathlib import Path
from aqt.qt import QDialog, QMessageBox, QTimer

Path(__file__).with_name("anki-version.txt").write_text(aqt.appVersion)
dialog_log = Path(__file__).with_name("dialogs.log")


def record(widget, text):
    with dialog_log.open("a", encoding="utf8") as log:
        log.write(f"{type(widget).__name__}: {text}\n")


def dismiss_dialogs():
    for widget in aqt.mw.app.topLevelWidgets():
        if not widget.isVisible():
            continue
        if isinstance(widget, QMessageBox):
            record(widget, widget.text())
            for choice in ("Discard", "Ok", "Yes", "Close", "Cancel"):
                button = widget.button(getattr(QMessageBox.StandardButton, choice))
                if button is not None:
                    button.click()
                    break
        elif isinstance(widget, QDialog) and widget.isModal():
            # Import and database-result dialogs need a user to close them.
            record(widget, widget.windowTitle())
            widget.reject()


timer = QTimer(aqt.mw)
timer.timeout.connect(dismiss_dialogs)
timer.start(250)
