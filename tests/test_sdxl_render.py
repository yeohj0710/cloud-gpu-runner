import ast
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RENDER_SOURCE = ROOT / "examples" / "sdxl-lora-playground" / "render_comparison.py"


def load_checkpoint_directories():
    tree = ast.parse(RENDER_SOURCE.read_text(encoding="utf-8"), filename=str(RENDER_SOURCE))
    function = next(
        (node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "checkpoint_directories"),
        None,
    )
    if function is None:
        raise AssertionError("render_comparison.py must define checkpoint_directories")
    module = ast.Module(body=[function], type_ignores=[])
    namespace = {"Path": Path}
    exec(compile(module, str(RENDER_SOURCE), "exec"), namespace)
    return namespace["checkpoint_directories"]


class SdxlRenderTest(unittest.TestCase):
    def test_checkpoint_discovery_ignores_manifest_and_invalid_names(self):
        discover = load_checkpoint_directories()
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            (output / "checkpoint-100").mkdir()
            (output / "checkpoint-400").mkdir()
            (output / "checkpoint-invalid").mkdir()
            (output / "checkpoint-manifest.json").write_text("{}", encoding="utf-8")
            self.assertEqual([path.name for path in discover(output)], ["checkpoint-100", "checkpoint-400"])


if __name__ == "__main__":
    unittest.main()
