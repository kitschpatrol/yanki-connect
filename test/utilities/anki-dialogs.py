"""Dismiss native dialogs in the disposable E2E profile without replacing API handlers."""

import aqt
import aqt.addons
import json
import sys
import time
import weakref
from functools import wraps
from html import unescape
from pathlib import Path
from aqt.qt import QDialog, QMessageBox, QTimer

Path(__file__).with_name("anki-version.txt").write_text(aqt.appVersion)
dialog_log = Path(__file__).with_name("dialogs.log")
addon_error = Path(__file__).with_name("addon-error.txt")
state_file = Path(__file__).with_name("gui-state.json")
state_log = Path(__file__).with_name("gui-state.log")
control_file = Path(__file__).with_name("gui-control.json")
diagnostic_file = Path(__file__).with_name("diagnostic.json")
focus_log = Path(__file__).with_name("focus.log")
addon_dialogs = weakref.WeakSet()
webviews = weakref.WeakKeyDictionary()
last_state = None


def native_class(cls):
    unwrap = getattr(cls, "_without_compat_wrapper", None)
    return unwrap() if callable(unwrap) else cls


def flush_output():
    # Bundled Python can ignore PYTHONUNBUFFERED. Flush before the runner kills
    # the process so printed loader tracebacks survive even without a dialog.
    for stream in (sys.stdout, sys.stderr):
        # Anki's stderr ErrorHandler implements write(), but not flush().
        flush = getattr(stream, "flush", None)
        if callable(flush):
            flush()


def record_addon_error(text):
    text = unescape(text)
    if "2055492159" in text and "Traceback" in text:
        addon_error.write_text(text, encoding="utf8")


def observe_addon_message(function):
    @wraps(function)
    def observed(*args, **kwargs):
        text = args[0] if args else kwargs.get("txt", kwargs.get("text", ""))
        if isinstance(text, str):
            record("Add-on loader", text)
        flush_output()
        result = function(*args, **kwargs)
        # Since Anki 23.10, showText(run=False) returns a non-modal dialog.
        # Track only the loader's dialogs; other non-modal windows are probes.
        if isinstance(result, tuple) and result and isinstance(result[0], native_class(QDialog)):
            addon_dialogs.add(result[0])
        return result

    return observed


# Add-on errors may be shown as HTML in a webview, not a QMessageBox. Observe
# the loader's existing notification functions before its dialog is dismissed.
for name in ("showText", "showWarning"):
    original = getattr(aqt.addons, name, None)
    if callable(original):
        setattr(aqt.addons, name, observe_addon_message(original))


def record(label, text):
    record_addon_error(text)
    with dialog_log.open("a", encoding="utf8") as log:
        log.write(f"{label}: {text}\n")


def dialog_text(widget):
    parts = [widget.windowTitle()]
    for name in ("text", "informativeText", "detailedText"):
        getter = getattr(widget, name, None)
        if callable(getter):
            text = getter()
            if isinstance(text, str) and text:
                parts.append(text)
    return "\n".join(parts)


class WebReadiness:
    def __init__(self, web, functions):
        self.web = weakref.ref(web)
        self.functions = functions
        self.generation = 0
        self.pending = False
        self.ready = False
        self.checked_at = 0
        self.error = None
        self.renderer_failure = None
        web.loadStarted.connect(self.invalidate)
        web.loadFinished.connect(self.invalidate)
        terminated = getattr(web.page(), "renderProcessTerminated", None)
        if terminated is not None:
            terminated.connect(self.renderer_terminated)

    def renderer_terminated(self, status, exit_code):
        # Qt 5 exposes integer enums; Qt 6 enums carry their integer in value.
        status = int(getattr(status, "value", status))
        if status != 0:
            self.renderer_failure = {
                "status": status, "exitCode": int(exit_code),
                "recordedAt": int(time.time() * 1000),
            }
            self.invalidate()

    def invalidate(self, *args):
        self.generation += 1
        self.pending = False
        self.ready = False
        self.checked_at = 0

    def snapshot(self):
        web = self.web()
        dom_done = getattr(web, "_domDone", False) is True
        queued = len(getattr(web, "_pendingActions", []))
        if not dom_done or queued:
            self.invalidate()
        elif not self.pending:
            generation = self.generation
            self.pending = True

            def observed(result):
                if generation == self.generation:
                    self.pending = False
                    self.ready = result is True
                    self.checked_at = time.time()

            checks = " && ".join("typeof " + name + " === 'function'" for name in self.functions)
            try:
                # Query the actual page instead of adding to Anki's queued UI
                # commands. This only reads state and never advances review.
                web.page().runJavaScript("document.readyState === 'complete' && " + checks, observed)
                self.error = None
            except Exception as error:
                self.pending = False
                self.ready = False
                self.error = str(error)
        return {
            "domDone": dom_done,
            "pendingActions": queued,
            "ready": dom_done and not queued and self.ready and time.time() - self.checked_at < 1,
            "error": self.error,
        }


def observe_webview(web, functions):
    if web is None:
        return None
    if web not in webviews:
        webviews[web] = WebReadiness(web, functions)
    return webviews[web]


def observe_reviewer_webviews():
    reviewer = getattr(aqt.mw, "reviewer", None)
    return {
        "card": observe_webview(getattr(reviewer, "web", None), ("_showQuestion", "_showAnswer")),
        "buttons": observe_webview(getattr(getattr(reviewer, "bottom", None), "web", None),
                                   ("showQuestion", "showAnswer")),
    }


def main_focused():
    focused = aqt.mw.app.focusWidget()
    return focused is not None and focused.window() == aqt.mw


def record_focus(event, mode):
    if mode is not None:
        # Close the file before the next native call so a crash preserves its boundary.
        with focus_log.open("a", encoding="utf8") as log:
            log.write(json.dumps({"recordedAt": int(time.time() * 1000),
                                  "event": event, "mode": mode}) + "\n")


def focus_main_window():
    # The runner enables this only for main-window probes, before opening
    # browser/editor windows. Normal Qt focus events let Anki process refreshes;
    # never call reviewer internals or repair the action being tested.
    if not control_file.exists():
        return
    control = json.loads(control_file.read_text(encoding="utf8"))
    if not control.get("focusMain"):
        return
    mode = json.loads(diagnostic_file.read_text(encoding="utf8"))["focus"] if diagnostic_file.exists() else None
    record_focus("requested", mode)
    if mode == "disabled":
        record_focus("disabled", mode)
        return
    if (not main_focused()
            and aqt.mw.app.activeModalWidget() is None
            and not aqt.mw.progress.busy()):
        record_focus("activateWindow", mode)
        aqt.mw.activateWindow()
        record_focus("raise", mode)
        aqt.mw.raise_()
        record_focus("setFocus", mode)
        aqt.mw.web.setFocus()
        record_focus("complete", mode)


def publish_state():
    global last_state
    mw = aqt.mw
    reviewer = getattr(mw, "reviewer", None)
    card = getattr(reviewer, "card", None)
    server = getattr(mw, "mediaServer", None)
    server_alive = getattr(server, "is_alive", None)
    # Watch the shared main-window pages before review starts. A renderer may
    # fail during startup while the Python process and media server stay alive.
    observed_webviews = observe_reviewer_webviews()
    state = {
        "recordedAt": int(time.time() * 1000),
        "busy": bool(mw.progress.busy() or getattr(mw, "_background_op_count", 0)),
        "mainFocused": main_focused(),
        "mediaServerAlive": server_alive() if callable(server_alive) else None,
        "reviewing": getattr(mw, "state", "") == "review" and card is not None,
        "cardId": card.id if card is not None else None,
        "side": getattr(reviewer, "state", ""),
        "refreshPending": bool(getattr(reviewer, "_refresh_needed", None)),
        "rendererFailures": {
            name: observer.renderer_failure for name, observer in observed_webviews.items()
            if observer is not None and observer.renderer_failure is not None
        },
    }
    if state["reviewing"]:
        state["webviews"] = {
            name: observer.snapshot() if observer is not None else
                  {"ready": False, "error": "Webview unavailable"}
            for name, observer in observed_webviews.items()
        }
        state["webReady"] = all(web["ready"] for web in state["webviews"].values())
    else:
        state["webReady"] = False
    temporary = state_file.with_suffix(".tmp")
    temporary.write_text(json.dumps(state), encoding="utf8")
    temporary.replace(state_file)
    signature = {key: value for key, value in state.items() if key != "recordedAt"}
    if signature != last_state:
        with state_log.open("a", encoding="utf8") as log:
            log.write(json.dumps(state) + "\n")
        last_state = signature


def dismiss_dialogs():
    for widget in aqt.mw.app.topLevelWidgets():
        if not widget.isVisible():
            continue
        if isinstance(widget, native_class(QMessageBox)):
            record(type(widget).__name__, dialog_text(widget))
            for choice in ("Discard", "Ok", "Yes", "Close", "Cancel"):
                button = widget.button(getattr(QMessageBox.StandardButton, choice))
                if button is not None:
                    button.click()
                    break
        elif isinstance(widget, native_class(QDialog)) and (widget.isModal() or widget in addon_dialogs):
            # Import and database-result dialogs need a user to close them.
            record(type(widget).__name__, dialog_text(widget))
            widget.reject()
            addon_dialogs.discard(widget)

    focus_main_window()
    publish_state()
    flush_output()


# Attach while add-ons load, before the event loop can deliver renderer exits.
# The timer also discovers pages created later during startup.
observe_reviewer_webviews()
timer = QTimer(aqt.mw)
timer.timeout.connect(dismiss_dialogs)
timer.start(250)
