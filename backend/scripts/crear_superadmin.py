import sys
from getpass import getpass
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from app.core.database import engine
from app.models.usuario import RolesValidos, Usuario
import bcrypt

nombre = input("Ingresa tu nombre: ").strip()
apellido = input("Ingresa tu apellido: ").strip()
correo = input("Ingresa correo electrónico: ").strip().lower()
password = getpass("Ingresa contraseña: ").strip()
confirm_password = getpass("Confirma la contraseña: ").strip()

if not nombre or not apellido or not correo or not password or not confirm_password:
    print("Error: No puedes dejar campos vacíos.")
    sys.exit(1)

if password != confirm_password:
    print("Error: Las contraseñas no coinciden.")
    sys.exit(1)

if len(password) < 8:
    print("Error: La contraseña debe tener al menos 8 caracteres.")
    sys.exit(1)

password_bytes = password.encode("utf-8")[:72]
password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")

with Session(engine) as session:
    usuario_existente = session.exec(
        select(Usuario)
        .where(Usuario.correo == correo)
    ).first()

    if usuario_existente:
        print(f"Error: Ya existe un usuario registrado con el correo '{correo}'.")
        sys.exit(1)

    nuevo_superadmin = Usuario(
        nombres=nombre,
        apellidos=apellido,
        correo=correo,
        rol=RolesValidos.SUPERADMIN,
        hashed_password=password_hash,
        restaurante_id=None,
    )

    try:
        session.add(nuevo_superadmin)
        session.commit()
        session.refresh(nuevo_superadmin)

        assert nuevo_superadmin.id is not None

        print(f"\nSuperAdmin '{nombre} {apellido}' creado exitosamente (ID: {nuevo_superadmin.id}).")
    except SQLAlchemyError as err:
        session.rollback()
        print(f"Error en la base de datos al guardar: {err}")
        sys.exit(1)