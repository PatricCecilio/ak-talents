import re
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent
SCRIPTS_DIR = BACKEND_DIR / "scripts"

# A plain Read-Host echoes what is pasted: a connection string (with the database password) once leaked in a screenshot.
PLAIN_READ_HOST = re.compile(
    r"Read-Host\s+[\"'$](?![^\r\n]*-AsSecureString)[^\r\n]*(connection string|DATABASE_URL|SECRET|senha)", re.IGNORECASE
)


class SecretPromptsTestCase(unittest.TestCase):
    def test_scripts_read_the_connection_string_hidden(self) -> None:
        common = (SCRIPTS_DIR / "neon-common.ps1").read_text(encoding="utf-8-sig")
        self.assertIn("Read-Host $Prompt -AsSecureString", common)
        self.assertIn("ZeroFreeBSTR", common)
        for script in ("criar-admin.ps1", "migrar-producao.ps1"):
            source = (SCRIPTS_DIR / script).read_text(encoding="utf-8-sig")
            self.assertIn("neon-common.ps1", source, script)
            self.assertIn("Read-NeonTarget", source, script)

    def test_no_script_or_guide_uses_a_visible_prompt_for_secrets(self) -> None:
        files = [*SCRIPTS_DIR.glob("*.ps1"), REPO_DIR / "DEPLOY.md"]
        for path in files:
            text = path.read_text(encoding="utf-8-sig")
            self.assertIsNone(PLAIN_READ_HOST.search(text), f"{path.name}: Read-Host sem -AsSecureString para segredo")
            self.assertNotIn("$env:DATABASE_URL = Read-Host", text, path.name)

    def test_only_host_and_database_are_shown(self) -> None:
        common = (SCRIPTS_DIR / "neon-common.ps1").read_text(encoding="utf-8-sig")
        self.assertIn('Write-Host "Destino: $($target.Host) / $($target.Database)"', common)
        # The URL itself is never written out.
        self.assertNotRegex(common, r"Write-Host[^\r\n]*\$(url|raw)\b")

    def test_scripts_keep_utf8_bom_for_windows_powershell(self) -> None:
        for path in SCRIPTS_DIR.glob("*.ps1"):
            self.assertTrue(path.read_bytes().startswith(b"\xef\xbb\xbf"), path.name)


if __name__ == "__main__":
    unittest.main()
