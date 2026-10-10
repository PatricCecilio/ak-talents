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


class TempSqliteDatabaseTestCase(unittest.TestCase):
    """Points settings at a throwaway SQLite file (no tests of its own)."""

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


class MigrateTestCase(TempSqliteDatabaseTestCase):

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


class JobDetailsMigrationTestCase(TempSqliteDatabaseTestCase):
    def test_database_at_0010_gets_the_new_job_columns_without_touching_jobs(self) -> None:
        # Production before this change: at 0010, with jobs already published.
        engine = create_engine(f"sqlite:///{self.db_path.as_posix()}")
        Base.metadata.create_all(bind=engine)
        engine.dispose()
        with closing(sqlite3.connect(self.db_path)) as connection:
            for column in ("schedule", "benefits", "contract_type", "openings"):
                connection.execute(f"alter table jobs drop column {column}")
            connection.execute("insert into users (id, name, email, hashed_password, role, is_active, created_at) values (1, 'E', 'e@x.com', 'x', 'company', 1, '2026-09-01 10:00:00')")
            connection.execute("insert into companies (id, user_id, company_name, status, created_at) values (1, 1, 'E', 'approved', '2026-09-01 10:00:00')")
            connection.execute("insert into jobs (id, company_id, title, slug, description, status, is_active, show_company_to_candidates, created_at) values (1, 1, 'Atendente', 'atendente', 'Descrição', 'approved', 1, 0, '2026-09-01 10:00:00')")
            connection.execute("create table alembic_version (version_num varchar(32) not null primary key)")
            connection.execute("insert into alembic_version values ('0010_job_company_visibility')")
            connection.commit()

        self.assertEqual(migrate_module.migrate(), "upgraded")
        self.assertTrue({"schedule", "benefits", "contract_type", "openings"} <= self.columns("jobs"))
        self.assertEqual(
            self.query("select title, status, schedule, benefits, contract_type, openings from jobs"),
            [("Atendente", "approved", None, None, None, None)],
        )
        self.assertEqual(self.query("select version_num from alembic_version"), [("0011_job_details",)])
        self.assertEqual(HEAD_REVISION, "0011_job_details")


class PipelineMigrationTestCase(TempSqliteDatabaseTestCase):
    def test_existing_applications_get_a_stage_and_initial_history(self) -> None:
        # A database at 0008: no pipeline columns or tables yet.
        engine = create_engine(f"sqlite:///{self.db_path.as_posix()}")
        Base.metadata.create_all(bind=engine)
        engine.dispose()
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute("drop table application_notes")
            connection.execute("drop table application_stage_history")
            connection.execute("drop index ix_applications_stage")
            for column in ("stage", "stage_updated_at", "finalist_summary", "is_hidden"):
                connection.execute(f"alter table applications drop column {column}")
            connection.execute("alter table jobs drop column show_company_to_candidates")  # added in 0010
            connection.execute("insert into users (id, name, email, hashed_password, role, is_active, created_at) values (1, 'E', 'e@x.com', 'x', 'company', 1, '2026-09-01 10:00:00')")
            connection.execute("insert into companies (id, user_id, company_name, status, created_at) values (1, 1, 'E', 'approved', '2026-09-01 10:00:00')")
            connection.execute("insert into jobs (id, company_id, title, slug, description, status, is_active, created_at) values (1, 1, 'V', 'v', 'Descrição', 'approved', 1, '2026-09-01 10:00:00')")
            for candidate_id in (1, 2):
                connection.execute(f"insert into candidates (id, full_name, created_at) values ({candidate_id}, 'C{candidate_id}', '2026-09-01 10:00:00')")
            connection.execute(
                "insert into applications (id, candidate_id, job_id, status, appintelli_reference, screening_status, screening_completed_at, created_at) "
                "values (1, 1, 1, 'pending_screening', 'ref-1', 'QUALIFIED', '2026-09-03 12:00:00', '2026-09-02 09:00:00')"
            )
            connection.execute(
                "insert into applications (id, candidate_id, job_id, status, appintelli_reference, screening_status, created_at) "
                "values (2, 2, 1, 'submitted', 'ref-2', 'pending_screening', '2026-09-02 09:00:00')"
            )
            connection.execute("create table alembic_version (version_num varchar(32) not null primary key)")
            connection.execute("insert into alembic_version values ('0008_job_recruiter')")
            connection.commit()

        self.assertEqual(migrate_module.migrate(), "upgraded")

        rows = self.query("select id, stage, stage_updated_at, is_hidden from applications order by id")
        self.assertEqual([(row[0], row[1], row[3]) for row in rows], [(1, "screening", 0), (2, "new", 0)])
        self.assertTrue(rows[0][2].startswith("2026-09-03 12:00:00"))
        self.assertTrue(rows[1][2].startswith("2026-09-02 09:00:00"))
        history = self.query("select application_id, from_stage, to_stage, changed_by_role, note from application_stage_history order by application_id")
        self.assertEqual(
            history,
            [
                (1, None, "screening", "system", "Etapa inicial definida na migração."),
                (2, None, "new", "system", "Etapa inicial definida na migração."),
            ],
        )


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
