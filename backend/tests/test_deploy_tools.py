import logging
from contextlib import closing
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import config as app_config
from app.core.config import Settings
from app.core.security import verify_password
from app.database import migrate as migrate_module
from app.database.base import Base
from app.models.user import User
from app.scripts import create_admin

HEAD_REVISION = ScriptDirectory.from_config(migrate_module._alembic_config()).get_current_head()


def sqlite_settings(path: Path) -> Settings:
    return Settings(_env_file=None, DATABASE_URL=f"sqlite:///{path.as_posix()}")


class MigrateTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp.name) / "ak.db"
        patcher = mock.patch.object(app_config, "settings", sqlite_settings(self.db_path))
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self) -> None:
        # alembic's env.py runs logging.fileConfig, which disables loggers created by the app.
        for logger in logging.Logger.manager.loggerDict.values():
            if isinstance(logger, logging.Logger):
                logger.disabled = False
        self.tmp.cleanup()

    def query(self, sql: str) -> list:
        with closing(sqlite3.connect(self.db_path)) as connection:
            return connection.execute(sql).fetchall()

    def columns(self, table: str) -> set[str]:
        return {row[1] for row in self.query(f"pragma table_info({table})")}

    def test_empty_database_is_created_and_stamped_at_head(self) -> None:
        self.assertEqual(migrate_module.migrate(), "created")

        tables = {row[0] for row in self.query("select name from sqlite_master where type='table'")}
        self.assertTrue({"users", "companies", "candidates", "jobs", "applications", "screening_questions"} <= tables)
        self.assertIn("privacy_accepted_at", self.columns("users"))
        self.assertEqual(self.query("select version_num from alembic_version"), [(HEAD_REVISION,)])

    def test_running_again_is_a_safe_noop_upgrade(self) -> None:
        migrate_module.migrate()
        self.assertEqual(migrate_module.migrate(), "upgraded")
        self.assertEqual(self.query("select version_num from alembic_version"), [(HEAD_REVISION,)])

    def test_existing_database_is_upgraded(self) -> None:
        # Simulate a database created before migration 0007.
        engine = create_engine(f"sqlite:///{self.db_path.as_posix()}")
        Base.metadata.create_all(bind=engine)
        engine.dispose()
        with closing(sqlite3.connect(self.db_path)) as connection:
            for table, column in [("users", "privacy_accepted_at"), ("users", "privacy_policy_version"), ("applications", "privacy_policy_version")]:
                connection.execute(f"alter table {table} drop column {column}")
            connection.execute("create table alembic_version (version_num varchar(32) not null primary key)")
            connection.execute("insert into alembic_version values ('0006_appintelli_ref')")
            connection.commit()

        self.assertEqual(migrate_module.migrate(), "upgraded")
        self.assertIn("privacy_accepted_at", self.columns("users"))
        self.assertIn("privacy_policy_version", self.columns("applications"))
        self.assertEqual(self.query("select version_num from alembic_version"), [(HEAD_REVISION,)])


class CreateAdminTestCase(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

    def test_creates_active_admin_with_hashed_password(self) -> None:
        with self.SessionLocal() as db:
            user = create_admin.create_admin_user(db, " Ana Admin ", " Ana@AKTalent.com.br ", "senha-bem-longa-123")

        self.assertEqual(user.role, "admin")
        self.assertTrue(user.is_active)
        self.assertEqual(user.email, "ana@aktalent.com.br")
        self.assertEqual(user.name, "Ana Admin")
        self.assertNotEqual(user.hashed_password, "senha-bem-longa-123")
        self.assertTrue(verify_password("senha-bem-longa-123", user.hashed_password))

    def test_rejects_invalid_input(self) -> None:
        cases = [
            ("A", "ana@example.com", "senha-bem-longa-123", "nome"),
            ("Ana", "nao-e-email", "senha-bem-longa-123", "E-mail inválido"),
            ("Ana", "ana@example.com", "curta123", "pelo menos 12"),
        ]
        with self.SessionLocal() as db:
            for name, email, password, expected in cases:
                with self.assertRaises(create_admin.AdminCreationError) as ctx:
                    create_admin.create_admin_user(db, name, email, password)
                self.assertIn(expected, str(ctx.exception))
            self.assertEqual(db.query(User).count(), 0)

    def test_rejects_existing_email(self) -> None:
        with self.SessionLocal() as db:
            create_admin.create_admin_user(db, "Ana", "ana@example.com", "senha-bem-longa-123")
            with self.assertRaises(create_admin.AdminCreationError):
                create_admin.create_admin_user(db, "Ana 2", "ANA@example.com", "outra-senha-longa-456")

    def _run_main(self, inputs: list[str], passwords: list[str]) -> int:
        with mock.patch("builtins.input", side_effect=inputs), mock.patch.object(
            create_admin, "getpass", side_effect=passwords
        ), mock.patch("app.database.session.SessionLocal", self.SessionLocal), mock.patch("builtins.print"):
            return create_admin.main()

    def test_cli_creates_admin_after_confirmation(self) -> None:
        code = self._run_main(["Ana", "ana@example.com", "s"], ["senha-bem-longa-123", "senha-bem-longa-123"])
        self.assertEqual(code, 0)
        with self.SessionLocal() as db:
            self.assertEqual(db.query(User).filter(User.role == "admin").count(), 1)

    def test_cli_creates_nothing_on_mismatch_or_cancel(self) -> None:
        self.assertEqual(self._run_main(["Ana", "ana@example.com"], ["senha-bem-longa-123", "diferente-123456"]), 1)
        self.assertEqual(self._run_main(["Ana", "ana@example.com", "n"], ["senha-bem-longa-123", "senha-bem-longa-123"]), 1)
        with self.SessionLocal() as db:
            self.assertEqual(db.query(User).count(), 0)


if __name__ == "__main__":
    unittest.main()
