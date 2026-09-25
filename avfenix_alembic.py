"""
AVFenix Alembic Migration Helper for MariaDB (v2.0 - with Rollback Support)
Automatiza la inicialización, generación de migraciones autogeneradas, actualización y reversión (rollback/downgrade) de esquemas MariaDB usando Alembic y AVFenix Types.
"""

import os
import sys
import subprocess
import json

ALEMBIC_INI_TEMPLATE = """[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os
sqlalchemy.url = %(db_url)s

[post_write_hooks]

[logging]
default_level = INFO
"""

ENV_PY_TEMPLATE = """import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Añadir ruta del proyecto al sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Importar la Base declarativa generada por AVFenix MariaDB
try:
    from models_mariadb import Base
    target_metadata = Base.metadata
except ImportError:
    target_metadata = None

config = context.config

if config.config_file_name:
    fileConfig(config.config_file_name)

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
"""

class AVFenixAlembicManager:
    def __init__(self, db_url="mysql+pymysql://root:password@localhost:3306/avfenix_db"):
        self.db_url = db_url

    def init_alembic(self):
        """Inicializa la carpeta y configuración de Alembic"""
        if not os.path.exists("alembic"):
            os.makedirs("alembic/versions", exist_ok=True)
            
        with open("alembic.ini", "w", encoding="utf-8") as f:
            f.write(ALEMBIC_INI_TEMPLATE % {"db_url": self.db_url})
            
        with open("alembic/env.py", "w", encoding="utf-8") as f:
            f.write(ENV_PY_TEMPLATE)
            
        print("[AVFenix Alembic] Entorno de migraciones inicializado exitosamente.")

    def create_migration(self, message="auto_migration"):
        """Genera una nueva migración automática comparando los modelos .avf con MariaDB"""
        print(f"[AVFenix Alembic] Generando migración: '{message}'...")
        cmd = ["alembic", "revision", "--autogenerate", "-m", message]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print("[AVFenix Alembic] Migración creada con éxito.")
            print(res.stdout)
        else:
            print("[AVFenix Alembic Error] Falló la creación de la migración:")
            print(res.stderr)

    def upgrade_db(self, target="head"):
        """Aplica las migraciones pendientes a MariaDB (por defecto hasta 'head')"""
        print(f"[AVFenix Alembic] Aplicando migraciones a MariaDB ({target})...")
        cmd = ["alembic", "upgrade", target]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print("[AVFenix Alembic] Base de datos actualizada exitosamente.")
            print(res.stdout)
        else:
            print("[AVFenix Alembic Error] Falló la actualización de la base de datos:")
            print(res.stderr)

    def downgrade_db(self, target="-1"):
        """Revierte (rollback) las migraciones en MariaDB (por defecto 1 paso atrás)"""
        print(f"[AVFenix Alembic] Revertiendo (rollback) migración en MariaDB ({target})...")
        cmd = ["alembic", "downgrade", target]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"[AVFenix Alembic] Rollback realizado con éxito hacia '{target}'.")
            print(res.stdout)
        else:
            print("[AVFenix Alembic Error] Falló la reversión de la migración:")
            print(res.stderr)

if __name__ == "__main__":
    manager = AVFenixAlembicManager()
    manager.init_alembic()
