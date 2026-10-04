"""Application pipeline: stages, who may move between them, and the labels each audience sees.

This module is the single source of truth. The API returns `allowed_next_stages` so the frontend
never re-implements these rules.
"""

from enum import Enum


class Stage(str, Enum):
    new = "new"
    screening = "screening"
    ak_interview = "ak_interview"
    finalist = "finalist"
    client_approved = "client_approved"
    hired = "hired"
    rejected = "rejected"
    withdrawn = "withdrawn"


# Stages where the person is still in the running (used for counts and the "vaga preenchida" bulk close).
ACTIVE_STAGES = (Stage.new, Stage.screening, Stage.ak_interview, Stage.finalist, Stage.client_approved)

# AK Talent team (admin/recruiter). Finalist -> client decision is NOT here: that belongs to the company.
AK_TRANSITIONS: dict[Stage, tuple[Stage, ...]] = {
    Stage.new: (Stage.screening, Stage.ak_interview, Stage.rejected, Stage.withdrawn),
    Stage.screening: (Stage.ak_interview, Stage.rejected, Stage.withdrawn),
    Stage.ak_interview: (Stage.finalist, Stage.screening, Stage.rejected, Stage.withdrawn),
    Stage.finalist: (Stage.ak_interview, Stage.withdrawn),
    Stage.client_approved: (Stage.hired, Stage.rejected, Stage.withdrawn),
    Stage.hired: (),
    Stage.rejected: (Stage.screening,),
    Stage.withdrawn: (Stage.screening,),
}

# The client company only decides on finalists of its own jobs.
COMPANY_TRANSITIONS: dict[Stage, tuple[Stage, ...]] = {
    Stage.finalist: (Stage.client_approved, Stage.rejected),
}

# Labels for the AK team (and history entries).
STAGE_LABELS: dict[Stage, str] = {
    Stage.new: "Nova",
    Stage.screening: "Em triagem",
    Stage.ak_interview: "Entrevista com a AK",
    Stage.finalist: "Finalista (enviado ao cliente)",
    Stage.client_approved: "Aprovado pelo cliente",
    Stage.hired: "Contratado",
    Stage.rejected: "Reprovado",
    Stage.withdrawn: "Desistiu",
}

FILLED_JOB_NOTE = "Vaga preenchida"

SYSTEM_ROLE = "system"


def parse_stage(value: str) -> Stage | None:
    try:
        return Stage(value)
    except ValueError:
        return None
