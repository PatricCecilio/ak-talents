"""Create an AK Talent recruiter account interactively (same flow as create_admin).

Usage, from backend/:  python -m app.scripts.create_recruiter
Admins can also create recruiters in the /admin screen.
"""

from app.models.user import UserRole
from app.scripts.create_admin import run_interactive


def main() -> int:
    return run_interactive(UserRole.recruiter)


if __name__ == "__main__":
    raise SystemExit(main())
