"""Exercise the diagnostic add-on without installing Anki or Qt."""

import json
import io
import runpy
import shutil
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


class Dialog:
    def isVisible(self):
        return True

    def isModal(self):
        return True

    def windowTitle(self):
        return "Anki"

    def reject(self):
        self.rejected = True


class MessageBox(Dialog):
    StandardButton = types.SimpleNamespace(
        Discard="discard", Ok="ok", Yes="yes", Close="close", Cancel="cancel"
    )

    def text(self):
        return "An add-on failed to load"

    def detailedText(self):
        return "Traceback: addons21/2055492159/__init__.py: unsupported version"

    def button(self, choice):
        return types.SimpleNamespace(click=self.reject)


class Timer:
    def __init__(self, parent):
        self.timeout = types.SimpleNamespace(connect=lambda callback: None)

    def start(self, interval):
        pass


class Signal:
    def __init__(self):
        self.callbacks = []

    def connect(self, callback):
        self.callbacks.append(callback)

    def emit(self, *args):
        for callback in self.callbacks:
            callback(*args)


class WebView:
    def __init__(self):
        self._domDone = True
        self._pendingActions = []
        self.loadStarted = Signal()
        self.loadFinished = Signal()
        self.renderProcessTerminated = Signal()
        self.queries = []

    def page(self):
        return self

    def runJavaScript(self, script, callback):
        self.queries.append((script, callback))

    def complete_query(self, result=True):
        self.queries.pop(0)[1](result)


class DiagnosticsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        helper = self.directory / "__init__.py"
        shutil.copyfile("test/utilities/anki-dialogs.py", helper)
        self.widgets = []
        self.calls = []
        self.return_value = object()

        def show_text(*args, **kwargs):
            self.calls.append((args, kwargs))
            return self.return_value

        self.aqt = types.ModuleType("aqt")
        self.aqt.appVersion = "2.1.55"
        self.aqt.mw = types.SimpleNamespace(
            app=types.SimpleNamespace(topLevelWidgets=lambda: self.widgets,
                                      focusWidget=lambda: None, activeModalWidget=lambda: None),
            progress=types.SimpleNamespace(busy=lambda: False),
            state="review",
            reviewer=types.SimpleNamespace(card=types.SimpleNamespace(id=123), state="question"),
            _background_op_count=0,
        )
        self.aqt.addons = types.ModuleType("aqt.addons")
        self.aqt.addons.showText = show_text
        self.aqt.addons.showWarning = show_text
        self.aqt.qt = types.ModuleType("aqt.qt")
        self.aqt.qt.QDialog = Dialog
        self.aqt.qt.QMessageBox = MessageBox
        self.aqt.qt.QTimer = Timer
        modules = {"aqt": self.aqt, "aqt.addons": self.aqt.addons, "aqt.qt": self.aqt.qt}
        self.module_patch = patch.dict("sys.modules", modules)
        self.module_patch.start()
        self.addCleanup(self.module_patch.stop)
        self.helper = runpy.run_path(str(helper))

    def state(self):
        self.helper["publish_state"]()
        return json.loads((self.directory / "gui-state.json").read_text())

    def test_captures_html_load_error_without_changing_the_dialog_call(self):
        text = "<div>Traceback: &#50;055492159 unsupported &lt;26.8.0</div>"
        result = self.aqt.addons.showText(text, type="html", copyBtn=True)
        self.assertIs(result, self.return_value)
        self.assertEqual(self.calls, [((text,), {"type": "html", "copyBtn": True})])
        self.assertIn("2055492159 unsupported <26.8.0", (self.directory / "addon-error.txt").read_text())

    def test_ignores_update_prompts_and_other_addon_errors(self):
        self.aqt.addons.showText("Update add-on 2055492159")
        self.aqt.addons.showWarning(text="Traceback: other-addon failed")
        self.assertFalse((self.directory / "addon-error.txt").exists())
        self.assertEqual(len(self.calls), 2)

    def test_flushes_hidden_tracebacks_and_dismisses_only_loader_non_modal_dialogs(self):
        class NonModal(Dialog):
            def isModal(self):
                return False

        loader_dialog, unrelated_dialog = NonModal(), NonModal()
        self.return_value = (loader_dialog, object())
        text = '<h1>Add-on startup failed</h1><a href="https://ankiweb.net/shared/info/2055492159">AnkiConnect</a>'
        output = io.BytesIO()
        with io.TextIOWrapper(output, encoding="utf8") as stdout:
            with patch("sys.stdout", stdout):
                # Anki 23.10 prints details separately from its visible HTML.
                print("Traceback: addons21/2055492159/__init__.py: Minimum Anki version supported: 26.8")
                self.assertEqual(output.getvalue(), b"")
                result = self.aqt.addons.showText(txt=text, type="html", run=False)
                self.assertIs(result, self.return_value)
                self.assertIn(b"Minimum Anki version", output.getvalue())
                self.widgets.extend((loader_dialog, unrelated_dialog))
                self.helper["dismiss_dialogs"]()
        self.assertTrue(loader_dialog.rejected)
        self.assertFalse(hasattr(unrelated_dialog, "rejected"))
        self.assertIn(text, (self.directory / "dialogs.log").read_text())
        self.assertFalse((self.directory / "addon-error.txt").exists())

    def test_timer_flushes_output_without_a_dialog(self):
        output = io.BytesIO()
        with io.TextIOWrapper(output, encoding="utf8") as stdout:
            with patch("sys.stdout", stdout):
                print("startup diagnostic")
                self.assertEqual(output.getvalue(), b"")
                self.helper["dismiss_dialogs"]()
                self.assertIn(b"startup diagnostic", output.getvalue())

    def test_accepts_anki_stderr_handler_without_flush(self):
        class ErrorHandler:
            def write(self, text):
                pass

        with patch("sys.stderr", ErrorHandler()):
            self.aqt.addons.showText("Add-on startup failed", run=False)
            self.helper["dismiss_dialogs"]()
        self.assertTrue((self.directory / "gui-state.json").exists())

    def test_focuses_only_when_requested_and_leaves_modal_dialogs_in_control(self):
        focused = []
        mw = self.aqt.mw
        mw.activateWindow = lambda: focused.append("activate")
        mw.raise_ = lambda: focused.append("raise")
        mw.web = types.SimpleNamespace(setFocus=lambda: focused.append("focus"))
        focus = self.helper["focus_main_window"]
        focus()
        self.assertEqual(focused, [])
        control = self.directory / "gui-control.json"
        control.write_text(json.dumps({"focusMain": True}))
        mw.app.activeModalWidget = lambda: object()
        focus()
        self.assertEqual(focused, [])
        mw.app.activeModalWidget = lambda: None
        focus()
        self.assertEqual(focused, ["activate", "raise", "focus"])
        focused.clear()
        mw.app.focusWidget = lambda: types.SimpleNamespace(window=lambda: mw)
        focus()
        self.assertEqual(focused, [])
        self.assertTrue(self.state()["mainFocused"])
        mw.app.focusWidget = lambda: None
        control.write_text(json.dumps({"focusMain": False}))
        focus()
        self.assertEqual(focused, [])

    def test_observes_a_dead_media_server_without_restarting_it(self):
        self.assertIsNone(self.state()["mediaServerAlive"])
        self.aqt.mw.mediaServer = types.SimpleNamespace(is_alive=lambda: False)
        self.assertFalse(self.state()["mediaServerAlive"])
        self.aqt.mw.mediaServer.is_alive = lambda: True
        self.assertTrue(self.state()["mediaServerAlive"])

    def test_diagnostic_focus_modes_change_only_focus_calls_and_record_the_native_boundary(self):
        focused = []
        mw = self.aqt.mw
        mw.activateWindow = lambda: focused.append("activate")
        mw.raise_ = lambda: focused.append("raise")
        mw.web = types.SimpleNamespace(setFocus=lambda: focused.append("focus"))
        (self.directory / "gui-control.json").write_text(json.dumps({"focusMain": True}))
        diagnostic = self.directory / "diagnostic.json"
        diagnostic.write_text(json.dumps({"focus": "disabled"}))
        self.helper["dismiss_dialogs"]()
        self.assertEqual(focused, [])
        self.assertTrue((self.directory / "gui-state.json").exists())
        diagnostic.write_text(json.dumps({"focus": "enabled"}))
        self.helper["dismiss_dialogs"]()
        self.assertEqual(focused, ["activate", "raise", "focus"])
        events = [json.loads(line)["event"] for line in (self.directory / "focus.log").read_text().splitlines()]
        self.assertEqual(events, ["requested", "disabled", "requested", "activateWindow", "raise", "setFocus", "complete"])

    def test_focus_trace_survives_a_failure_inside_a_native_call(self):
        (self.directory / "gui-control.json").write_text(json.dumps({"focusMain": True}))
        (self.directory / "diagnostic.json").write_text(json.dumps({"focus": "enabled"}))

        def fail():
            raise RuntimeError("native focus failed")

        self.aqt.mw.activateWindow = fail
        with self.assertRaisesRegex(RuntimeError, "native focus failed"):
            self.helper["focus_main_window"]()
        events = [json.loads(line)["event"] for line in (self.directory / "focus.log").read_text().splitlines()]
        self.assertEqual(events, ["requested", "activateWindow"])

    def test_captures_message_box_details_before_dismissal(self):
        widget = MessageBox()
        self.widgets.append(widget)
        self.helper["dismiss_dialogs"]()
        self.assertTrue(widget.rejected)
        self.assertIn("unsupported version", (self.directory / "addon-error.txt").read_text())

    def test_captures_details_on_a_qt_compatibility_proxy(self):
        # Qt compatibility proxies need not satisfy isinstance(QMessageBox).
        class Proxy(Dialog):
            def detailedText(self):
                return "Traceback: addons21/2055492159/__init__.py: import failed"

        widget = Proxy()
        self.widgets.append(widget)
        self.helper["dismiss_dialogs"]()
        self.assertTrue(widget.rejected)
        self.assertIn("import failed", (self.directory / "addon-error.txt").read_text())

    def test_unwraps_qt_classes_for_native_instances(self):
        class Proxy(MessageBox):
            @staticmethod
            def _without_compat_wrapper():
                return MessageBox

        self.helper["dismiss_dialogs"].__globals__["QMessageBox"] = Proxy
        widget = MessageBox()
        self.assertNotIsInstance(widget, Proxy)
        self.widgets.append(widget)
        self.helper["dismiss_dialogs"]()
        self.assertTrue(widget.rejected)

    def test_requires_both_reviewer_pages_to_finish_loading(self):
        card, buttons = WebView(), WebView()
        self.aqt.mw.reviewer.web = card
        self.aqt.mw.reviewer.bottom = types.SimpleNamespace(web=buttons)
        self.assertFalse(self.state()["webReady"])
        self.assertIn("typeof _showAnswer === 'function'", card.queries[0][0])
        self.assertIn("typeof showAnswer === 'function'", buttons.queries[0][0])
        card.complete_query()
        buttons.complete_query(False)
        self.assertFalse(self.state()["webReady"])
        card.complete_query()
        buttons.complete_query()
        self.assertTrue(self.state()["webReady"])
        card._pendingActions.append(("eval", "showQuestion()"))
        self.assertFalse(self.state()["webReady"])
        self.aqt.mw.reviewer._refresh_needed = "queues"
        self.assertTrue(self.state()["refreshPending"])

    def test_observes_renderer_crashes_before_review_and_retains_them_across_navigation(self):
        card, buttons = WebView(), WebView()
        self.aqt.mw.reviewer.web = card
        self.aqt.mw.reviewer.bottom = types.SimpleNamespace(web=buttons)
        self.aqt.mw.state = "deckBrowser"
        self.assertEqual(self.state()["rendererFailures"], {})
        self.assertEqual(card.queries, [])
        card.renderProcessTerminated.emit(2, 31)
        buttons.renderProcessTerminated.emit(types.SimpleNamespace(value=3), 9)
        failures = self.state()["rendererFailures"]
        self.assertEqual(failures["card"]["status"], 2)
        self.assertEqual(failures["card"]["exitCode"], 31)
        self.assertEqual(failures["buttons"]["status"], 3)
        self.assertEqual(failures["buttons"]["exitCode"], 9)
        card.loadStarted.emit()
        card.loadFinished.emit(True)
        self.aqt.mw.state = "review"
        self.assertEqual(self.state()["rendererFailures"], failures)

    def test_normal_renderer_shutdown_does_not_become_an_infrastructure_failure(self):
        web = WebView()
        self.aqt.mw.reviewer.web = web
        self.state()
        web.renderProcessTerminated.emit(0, 0)
        self.assertEqual(self.state()["rendererFailures"], {})

    def test_attaches_renderer_observers_before_the_first_timer_tick(self):
        web = WebView()
        self.aqt.mw.reviewer.web = web
        helper = runpy.run_path(str(self.directory / "__init__.py"))
        web.renderProcessTerminated.emit(2, 31)
        helper["publish_state"]()
        state = json.loads((self.directory / "gui-state.json").read_text())
        self.assertEqual(state["rendererFailures"]["card"]["exitCode"], 31)

    def test_rejects_web_callbacks_from_a_previous_document(self):
        web = WebView()
        self.aqt.mw.reviewer.web = web
        self.aqt.mw.reviewer.bottom = types.SimpleNamespace(web=WebView())
        self.state()
        old_callback = web.queries.pop(0)[1]
        web.loadStarted.emit()
        web._domDone = False
        self.state()
        web._domDone = True
        web.loadFinished.emit(True)
        self.state()
        old_callback(True)
        self.assertFalse(self.state()["webviews"]["card"]["ready"])
        web.complete_query()
        self.assertTrue(self.state()["webviews"]["card"]["ready"])

    def test_logs_state_transitions_without_repeating_identical_observations(self):
        self.state()
        self.state()
        self.aqt.mw.reviewer.state = "answer"
        self.state()
        observations = [json.loads(line) for line in (self.directory / "gui-state.log").read_text().splitlines()]
        self.assertEqual([entry["side"] for entry in observations], ["question", "answer"])

    def test_observes_busy_and_reviewer_state_without_changing_it(self):
        self.aqt.mw._background_op_count = 1
        self.helper["publish_state"]()
        state = json.loads((self.directory / "gui-state.json").read_text())
        self.assertTrue(state["busy"])
        self.assertTrue(state["reviewing"])
        self.assertEqual(state["side"], "question")
        self.assertEqual(state["cardId"], 123)
        self.aqt.mw._background_op_count = 0
        self.aqt.mw.reviewer.state = "answer"
        self.helper["publish_state"]()
        state = json.loads((self.directory / "gui-state.json").read_text())
        self.assertFalse(state["busy"])
        self.assertEqual(state["side"], "answer")
        self.assertEqual(self.aqt.mw.reviewer.card.id, 123)


if __name__ == "__main__":
    unittest.main()
