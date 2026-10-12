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
        self.assertEqual(self.query("select version_num from alembic_version"), [(HEAD_REVISION,)])


class GoogleSignInMigrationTestCase(TempSqliteDatabaseTestCase):
    def test_database_at_0011_gets_google_columns_and_keeps_accounts(self) -> None:
        # Production before Google sign-in: at 0011, password required, accounts already there.
        engine = create_engine(f"sqlite:///{self.db_path.as_posix()}")
        Base.metadata.create_all(bind=engine)
        engine.dispose()
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute("drop index ix_users_google_sub")
            for column in ("email_verified_at", "google_sub", "sessions_valid_after"):
                connection.execute(f"alter table users drop column {column}")
            connection.execute("insert into users (id, name, email, hashed_password, role, is_active, created_at) values (1, 'Ana', 'ana@x.com', 'hash-antigo', 'candidate', 1, '2026-09-01 10:00:00')")
            connection.execute("create table alembic_version (version_num varchar(32) not null primary key)")
            connection.execute("insert into alembic_version values ('0011_job_details')")
            connection.commit()

        self.assertEqual(migrate_module.migrate(), "upgraded")
        self.assertTrue({"email_verified_at", "google_sub", "sessions_valid_after"} <= self.columns("users"))
        not_null = {row[1]: row[3] for row in self.query("pragma table_info(users)")}
        self.assertEqual(not_null["hashed_password"], 0, "hashed_password passa a aceitar vazio")
        self.assertIn("ix_users_google_sub", {row[1] for row in self.query("pragma index_list(users)")})
        self.assertEqual(self.query("select email, hashed_password, google_sub from users"), [("ana@x.com", "hash-antigo", None)])
        self.assertEqual(self.query("select version_num from alembic_version"), [(HEAD_REVISION,)])


class LoginCodesMigrationTestCase(TempSqliteDatabaseTestCase):
    def test_database_at_0012_gets_the_login_codes_table(self) -> None:
        engine = create_engine(f"sqlite:///{self.db_path.as_posix()}")
        Base.metadata.create_all(bind=engine)
        engine.dispose()
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute("drop table login_codes")
            connection.execute("insert into users (id, name, email, hashed_password, role, is_active, created_at) values (1, 'Ana', 'ana@x.com', 'h', 'candidate', 1, '2026-09-01 10:00:00')")
            connection.execute("create table alembic_version (version_num varchar(32) not null primary key)")
            connection.execute("insert into alembic_version values ('0012_google_sign_in')")
            connection.commit()

        self.assertEqual(migrate_module.migrate(), "upgraded")
        self.assertTrue({"code_hash", "purpose", "door", "user_id", "expires_at", "used_at"} <= self.columns("login_codes"))
        self.assertIn("ix_login_codes_code_hash", {row[1] for row in self.query("pragma index_list(login_codes)")})
        self.assertEqual(self.query("select email from users"), [("ana@x.com",)])
        self.assertEqual(self.query("select version_num from alembic_version"), [(HEAD_REVISION,)])


class InternalCompaniesMigrationTestCase(TempSqliteDatabaseTestCase):
    OLD_COMPANIES = (
        "create table companies (id integer primary key, user_id integer not null unique references users(id) on delete cascade, "
        "company_name varchar(180) not null, responsible_name varchar(180), phone varchar(40), city varchar(180), state varchar(80), "
        "industry varchar(180), company_size varchar(80), status varchar(40) not null, website varchar(500), description text, "
        "created_at datetime not null)"
    )

    def test_database_at_0013_gets_internal_companies_and_new_job_statuses(self) -> None:
        engine = create_engine(f"sqlite:///{self.db_path.as_posix()}")
        Base.metadata.create_all(bind=engine)
        engine.dispose()
        with closing(sqlite3.connect(self.db_path)) as connection:
            # companies as it was at 0013: login required, no internal fields.
            connection.execute("drop table companies")
            connection.execute(self.OLD_COMPANIES)
            connection.execute("insert into users (id, name, email, hashed_password, role, is_active, created_at) values (1, 'A', 'a@x.com', 'x', 'company', 1, '2026-09-01 10:00:00')")
            connection.execute("insert into users (id, name, email, hashed_password, role, is_active, created_at) values (2, 'B', 'b@x.com', 'x', 'company', 0, '2026-09-01 10:00:00')")
            connection.execute("insert into companies (id, user_id, company_name, phone, status, created_at) values (1, 1, 'Ativa', '41999990000', 'approved', '2026-09-01 10:00:00')")
            connection.execute("insert into companies (id, user_id, company_name, status, created_at) values (2, 2, 'Desativada', 'approved', '2026-09-01 10:00:00')")
            for job_id, status, active in ((1, "pending", 1), (2, "approved", 1), (3, "hidden", 0), (4, "closed", 0)):
                connection.execute(
                    "insert into jobs (id, company_id, title, slug, description, status, is_active, created_at) "
                    f"values ({job_id}, 1, 'V{job_id}', 'v{job_id}', 'Descrição', '{status}', {active}, '2026-09-01 10:00:00')"
                )
            connection.execute("create table alembic_version (version_num varchar(32) not null primary key)")
            connection.execute("insert into alembic_version values ('0013_login_codes')")
            connection.commit()

        self.assertEqual(migrate_module.migrate(), "upgraded")
        self.assertTrue({"cnpj", "contact_email", "notes", "is_active"} <= self.columns("companies"))
        not_null = {row[1]: row[3] for row in self.query("pragma table_info(companies)")}
        self.assertEqual(not_null["user_id"], 0, "user_id passa a aceitar vazio")
        # Nothing lost; "deactivated" comes from the company's account.
        self.assertEqual(
            self.query("select id, user_id, company_name, phone, is_active from companies order by id"),
            [(1, 1, "Ativa", "41999990000", 1), (2, 2, "Desativada", None, 0)],
        )
        self.assertEqual(
            self.query("select id, status, is_active from jobs order by id"),
            [(1, "draft", 1), (2, "approved", 1), (3, "closed", 0), (4, "closed", 0)],
        )
        # A company without login can be stored now.
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute("insert into companies (company_name, status, is_active, created_at) values ('Interna', 'approved', 1, '2026-10-11 10:00:00')")
            connection.commit()
        self.assertEqual(self.query("select version_num from alembic_version"), [(HEAD_REVISION,)])


class PanelDataMigrationTestCase(TempSqliteDatabaseTestCase):
    def test_database_at_0014_gets_note_kinds_job_dates_and_erasure_log(self) -> None:
        engine = create_engine(f"sqlite:///{self.db_path.as_posix()}")
        Base.metadata.create_all(bind=engine)
        engine.dispose()
        with closing(sqlite3.connect(self.db_path)) as connection:
            # Tables as they were at 0014.
            connection.execute("drop table data_deletion_log")
            connection.execute("alter table application_notes drop column kind")
            for column in ("published_at", "closed_at"):
                connection.execute(f"alter table jobs drop column {column}")
            connection.execute("drop table candidates")
            connection.execute(
                "create table candidates (id integer primary key, user_id integer references users(id), full_name varchar(180), "
                "email varchar(255), phone varchar(40), state varchar(80), desired_role varchar(180), headline varchar(180), bio text, "
                "skills text, city varchar(180), neighborhood varchar(180), work_mode varchar(80), salary_expectation float, "
                "experience_years float, linkedin_url varchar(500), portfolio_url varchar(500), resume_url varchar(500), created_at datetime not null)"
            )
            connection.execute("insert into users (id, name, email, hashed_password, role, is_active, created_at) values (1, 'Rita', 'rita@x.com', 'x', 'recruiter', 1, '2026-09-01 10:00:00')")
            connection.execute("insert into users (id, name, email, hashed_password, role, is_active, created_at) values (2, 'Ana', 'ana@x.com', 'x', 'candidate', 1, '2026-09-01 10:00:00')")
            connection.execute("insert into companies (id, company_name, status, is_active, created_at) values (1, 'Cliente', 'approved', 1, '2026-09-01 10:00:00')")
            for job_id, status in ((1, "approved"), (2, "draft"), (3, "closed")):
                connection.execute(
                    "insert into jobs (id, company_id, title, slug, description, status, is_active, created_at) "
                    f"values ({job_id}, 1, 'V{job_id}', 'v{job_id}', 'Descrição', '{status}', 1, '2026-09-0{job_id} 10:00:00')"
                )
            connection.execute("insert into candidates (id, user_id, full_name, created_at) values (1, 2, 'Ana', '2026-09-01 10:00:00')")
            connection.execute("insert into candidates (id, full_name, created_at) values (2, 'Bruno', '2026-09-01 10:00:00')")
            for app_id, candidate_id, stage, summary in ((1, 1, "finalist", "'Ótima comunicação.'"), (2, 2, "client_approved", "'Experiente.'")):
                connection.execute(
                    "insert into applications (id, candidate_id, job_id, status, appintelli_reference, screening_status, stage, stage_updated_at, finalist_summary, is_hidden, created_at) "
                    f"values ({app_id}, {candidate_id}, 1, 'submitted', 'ref-{app_id}', 'REVIEW', '{stage}', '2026-09-05 10:00:00', {summary}, 0, '2026-09-02 10:00:00')"
                )
            for app_id in (1, 2):
                connection.execute(
                    "insert into application_stage_history (application_id, from_stage, to_stage, changed_by_user_id, changed_by_role, created_at) "
                    f"values ({app_id}, 'ak_interview', 'finalist', 1, 'recruiter', '2026-09-04 09:00:00')"
                )
            connection.execute(
                "insert into application_stage_history (application_id, from_stage, to_stage, changed_by_user_id, changed_by_role, note, created_at) "
                "values (2, 'finalist', 'client_approved', 1, 'recruiter', 'Resposta do cliente: aprovou. Começa dia 20.', '2026-09-06 15:00:00')"
            )
            connection.execute("insert into application_notes (application_id, author_user_id, body, created_at) values (1, 1, 'Nota antiga.', '2026-09-03 08:00:00')")
            connection.execute("create table alembic_version (version_num varchar(32) not null primary key)")
            connection.execute("insert into alembic_version values ('0014_internal_companies')")
            connection.commit()

        self.assertEqual(migrate_module.migrate(), "upgraded")
        notes = self.query("select application_id, author_user_id, kind, body, created_at from application_notes order by application_id, created_at")
        self.assertEqual(
            [(row[0], row[1], row[2], row[3]) for row in notes],
            [
                (1, 1, "anotacao", "Nota antiga."),
                (1, 1, "parecer", "Ótima comunicação."),
                (2, 1, "parecer", "Experiente."),
                (2, 1, "retorno_cliente", "Resposta do cliente: aprovou. Começa dia 20."),
            ],
        )
        self.assertTrue(notes[1][4].startswith("2026-09-04 09:00:00"))
        # Only published (or once published) jobs get a publish date.
        self.assertEqual(
            [(row[0], (row[1] or "")[:10]) for row in self.query("select id, published_at from jobs order by id")],
            [(1, "2026-09-01"), (2, ""), (3, "2026-09-03")],
        )
        self.assertEqual(self.query("select id, source from candidates order by id"), [(1, "conta"), (2, "site")])
        self.assertTrue({"created_by_user_id", "authorization_recorded_at", "anonymized_at"} <= self.columns("candidates"))
        self.assertEqual(self.query("select count(*) from data_deletion_log"), [(0,)])
        self.assertEqual(self.query("select version_num from alembic_version"), [(HEAD_REVISION,)])
        self.assertEqual(HEAD_REVISION, "0015_panel_data")


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
