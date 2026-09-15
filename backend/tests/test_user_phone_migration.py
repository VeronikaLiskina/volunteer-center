from alembic import command
from alembic.config import Config
from sqlalchemy import text


async def test_phone_migration_keeps_existing_accounts_and_supports_duplicate_names(db_connection):
    def cycle(connection):
        config = Config("alembic.ini")
        config.attributes["connection"] = connection
        command.downgrade(config, "0007_report_snapshots")
        connection.execute(text("INSERT INTO users (id,login,password_hash,role) VALUES (900,'Старое ФИО','unchanged','COORDINATOR')"))
        command.upgrade(config, "head")
        record = connection.execute(text("SELECT id, full_name, phone, password_hash, role FROM users WHERE id=900")).one()
        assert tuple(record) == (900, "Старое ФИО", None, "unchanged", "COORDINATOR")
        connection.execute(text("INSERT INTO users (id,full_name,phone,password_hash,role) VALUES (901,'Старое ФИО','+79990000901','unchanged','COORDINATOR')"))
        command.downgrade(config, "0007_report_snapshots")
        assert connection.scalar(text("SELECT count(DISTINCT login) FROM users WHERE id IN (900,901)")) == 2
        command.upgrade(config, "head")
        assert connection.scalar(text("SELECT count(*) FROM users WHERE password_hash='unchanged'")) == 2
    await db_connection.run_sync(cycle)
