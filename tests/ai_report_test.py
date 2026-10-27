import importlib.util
import json
import pathlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('ai_report', pathlib.Path(__file__).resolve().parents[1] / 'scripts' / 'ai-report.py')
report_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report_module)


class AIReportTest(unittest.TestCase):
    def report(self, count=20, review_run='current', reviewed=True, control=False):
        with tempfile.TemporaryDirectory(prefix='alabuga-ai-report-') as directory:
            parent = pathlib.Path(directory)
            root = parent / 'run'
            root.mkdir()
            if control:
                (parent / 'holdout-input.json').write_text('{}', encoding='utf-8')
                (parent / 'rubric.json').write_text('{}', encoding='utf-8')
            cases = [{'index': i, 'prompt': '<script>alert(1)</script>', 'success': True, 'elapsedMs': 1000} for i in range(1, count + 1)]
            (root / 'acceptance.json').write_text(json.dumps({'finished': 'current', 'cases': cases, 'expectedCases': count, 'sourceSet': 'heldout-notes' if control else 'original-acceptance', 'selection': 'complete-set'}), encoding='utf-8')
            if reviewed:
                review = {'_runFinished': review_run, **{str(i): {'usable': i <= 18, 'note': 'Проверено'} for i in range(1, count + 1)}}
                (root / 'review.json').write_text(json.dumps(review), encoding='utf-8')
            summary, assessment = report_module.render(root)
            return summary, assessment, (root / 'report.html').read_text(encoding='utf-8')

    def test_current_complete_review_is_scored_and_untrusted_text_is_escaped(self):
        _, assessment, text = self.report()
        self.assertIn('18 / 20 пригодных', assessment)
        self.assertIn('Критерий 18 / 20 достигнут', assessment)
        self.assertNotIn('<script>', text)
        self.assertIn('&lt;script&gt;', text)
        self.assertNotIn('153 / 153', text)
        self.assertNotIn('href="landing.html"', text)

    def test_review_from_another_run_is_ignored(self):
        _, assessment, text = self.report(review_run='previous')
        self.assertIn('ещё не зафиксирована', assessment)
        self.assertNotIn('Проверено', text)

    def test_eighteen_cases_are_not_a_completed_twenty_case_acceptance(self):
        _, assessment, _ = self.report(count=18)
        self.assertIn('неполный', assessment)
        self.assertNotIn('достигнут', assessment)

    def test_no_review_does_not_turn_technical_success_into_editorial_acceptance(self):
        summary, assessment, _ = self.report(reviewed=False)
        self.assertIn('20 / 20 технических', summary)
        self.assertIn('ещё не зафиксирована', assessment)
        self.assertNotIn('достигнут', assessment)

    def test_custom_control_is_reported_separately_from_the_twenty_case_target(self):
        _, assessment, text = self.report(count=6, control=True)
        self.assertIn('Контрольная выборка: 6 / 6', assessment)
        self.assertNotIn('достигнут', assessment)
        self.assertIn('href="../holdout-input.json"', text)
        self.assertNotIn('href="../rubric.json"', text)
