from app.database.base import Base
from app.database.guards import ensure_local_database
from app.database.session import engine


def reset_database() -> None:
    ensure_local_database()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("AK Talent development database reset completed.")


if __name__ == "__main__":
    reset_database()
