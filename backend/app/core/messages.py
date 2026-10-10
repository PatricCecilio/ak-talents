"""Every message the API sends to people, in plain Portuguese, in one place.

`translate_validation_error` and `translate_default_detail` also cover what FastAPI/Pydantic would otherwise answer
in English (missing fields, too short, invalid e-mail, "Not authenticated", "Not Found"...).
"""

from typing import Any

# Applications
APPLICATION_ALREADY_EXISTS = (
    "Você já se candidatou a esta vaga. Fique tranquilo: a equipe AK Talent vai entrar em contato."
)
INVALID_PHONE = "Confira o telefone: informe o DDD e o número."
IDENTITY_NOT_CONFIRMED = "Não foi possível confirmar sua identidade com os dados informados."
CANDIDATES_ONLY = "Esta área é só para candidatos."
COMPANIES_ONLY = "Esta área é só para empresas."
ADMIN_ONLY = "Esta área é só para a administração da AK Talent."
UNSUPPORTED_ROLE = "Este tipo de conta não tem acesso a esta área."

# Not found
JOB_NOT_FOUND = "Vaga não encontrada."
COMPANY_NOT_FOUND = "Empresa não encontrada."
COMPANY_PROFILE_NOT_FOUND = "Perfil da empresa não encontrado."
CANDIDATE_PROFILE_NOT_FOUND = "Perfil de candidato não encontrado."
SCREENING_NOT_FOUND = "Triagem não encontrada. Confira o link recebido."

# Accounts and companies
EMAIL_ALREADY_REGISTERED = "Este e-mail já tem cadastro. Entre com sua senha."
BLOCKED_COMPANY = "Sua empresa está bloqueada para publicar vagas. Fale com a equipe AK Talent."

# Screening answers and configuration
INVALID_ANSWER = "Resposta inválida para uma das perguntas. Confira e envie de novo."
INVALID_OPTION = "Escolha uma das opções da pergunta."
INVALID_QUESTION = "Uma das perguntas não pertence a esta vaga."
DUPLICATE_QUESTION = "Há perguntas repetidas na triagem."
INVALID_SCREENING_CONFIGURATION = "A triagem desta vaga está com um problema de configuração. Fale com a equipe AK Talent."
RULE_EQUALS_NEEDS_VALUE = "A regra 'igual a' precisa de um valor."
RULE_IN_NEEDS_VALUES = "A regra 'uma das opções' precisa de valores."
SINGLE_SELECT_NEEDS_OPTIONS = "Perguntas de escolha única precisam de opções."
ONLY_SINGLE_SELECT_HAS_OPTIONS = "Só perguntas de escolha única têm opções."
TEXT_RULES_NOT_SUPPORTED = "Perguntas de texto livre não aceitam regra automática."

# Server-to-server integration (not shown to candidates, but kept in Portuguese too)
UNAUTHORIZED = "Não autorizado."

GENERIC_INVALID_FIELD = "Confira os dados informados."

# FastAPI/Starlette defaults that would otherwise reach the screen in English.
DEFAULT_DETAILS = {
    "Not authenticated": "Entre na sua conta para continuar.",
    "Not Found": "Página ou recurso não encontrado.",
    "Method Not Allowed": "Ação não permitida.",
    "Unauthorized": UNAUTHORIZED,
    "Forbidden": "Você não tem acesso a esta área.",
    "Internal Server Error": "Algo deu errado do nosso lado. Tente novamente em instantes.",
}

FIELD_LABELS = {
    "answer": "Resposta",
    "answers": "Respostas",
    "body": "Texto",
    "city": "Cidade",
    "company_name": "Nome da empresa",
    "company_size": "Tamanho da empresa",
    "cover_letter": "Apresentação",
    "decision": "Decisão",
    "description": "Descrição",
    "desired_role": "Cargo desejado",
    "email": "E-mail",
    "experience": "Experiência",
    "experience_years": "Anos de experiência",
    "finalist_summary": "Parecer",
    "full_name": "Nome completo",
    "industry": "Segmento",
    "job_description": "Descrição da vaga",
    "label": "Pergunta",
    "linkedin_url": "LinkedIn",
    "location": "Cidade da vaga",
    "name": "Nome",
    "neighborhood": "Bairro",
    "note": "Observação",
    "options": "Opções",
    "password": "Senha",
    "phone": "Telefone",
    "portfolio_url": "Portfólio",
    "privacy_accepted": "Aceite da Política de Privacidade",
    "professional_summary": "Resumo profissional",
    "question_type": "Tipo de pergunta",
    "reason": "Motivo",
    "recruiter_id": "Recrutador",
    "requirements": "Requisitos",
    "responsible_name": "Responsável",
    "role": "Tipo de conta",
    "salary_expectation": "Pretensão salarial",
    "salary_max": "Salário máximo",
    "salary_min": "Salário mínimo",
    "skills": "Habilidades",
    "state": "Estado",
    "title": "Título da vaga",
    "to_stage": "Etapa",
    "value": "Resposta",
    "website_url": "Site",
    "work_mode": "Modelo de trabalho",
    "schedule": "Horário ou escala",
    "benefits": "Benefícios",
    "contract_type": "Tipo de contrato",
    "openings": "Quantidade de vagas",
}

VALUE_ERROR_PREFIX = "Value error, "


def field_label(loc: tuple | list) -> str:
    """Last named part of the error location (skips 'body' and list indexes)."""
    for part in reversed(list(loc)):
        if isinstance(part, str) and part != "body":
            return FIELD_LABELS.get(part, part.replace("_", " ").capitalize())
    return "Campo"


def translate_validation_error(error: dict[str, Any]) -> str:
    kind = error.get("type", "")
    ctx = error.get("ctx") or {}
    label = field_label(error.get("loc", ()))
    msg = str(error.get("msg", ""))

    if kind == "missing":
        return f"Preencha o campo {label}."
    if kind == "string_too_short":
        minimum = ctx.get("min_length")
        return f"{label}: escreva pelo menos {minimum} caracteres." if minimum and minimum > 1 else f"Preencha o campo {label}."
    if kind == "string_too_long":
        return f"{label}: use no máximo {ctx.get('max_length')} caracteres."
    if kind in ("too_short", "too_long"):
        return f"Confira o campo {label}."
    if kind in ("greater_than_equal", "greater_than"):
        limit = ctx.get("ge", ctx.get("gt"))
        return f"{label}: o valor não pode ser menor que {limit}." if kind == "greater_than_equal" else f"{label}: o valor precisa ser maior que {limit}."
    if kind in ("less_than_equal", "less_than"):
        return f"{label}: o valor está acima do permitido."
    if kind in ("int_parsing", "float_parsing", "int_type", "float_type", "int_from_float", "decimal_parsing"):
        return f"{label}: informe um número."
    if kind in ("bool_parsing", "bool_type"):
        return f"{label}: escolha sim ou não."
    if kind in ("literal_error", "enum"):
        return f"{label}: escolha uma das opções."
    if kind in ("url_parsing", "url_type", "url_scheme"):
        return f"{label}: informe um endereço completo, começando com https://."
    if kind == "value_error":
        if "email address" in msg.lower():
            return "Informe um e-mail válido."
        # Our own validators already raise Portuguese messages.
        return msg.removeprefix(VALUE_ERROR_PREFIX) or GENERIC_INVALID_FIELD
    if kind in ("string_type", "dict_type", "list_type", "model_type", "json_invalid", "model_attributes_type"):
        return f"Confira o campo {label}."
    return f"Confira o campo {label}."


def translate_default_detail(detail: Any) -> Any:
    if isinstance(detail, str):
        return DEFAULT_DETAILS.get(detail, detail)
    return detail
