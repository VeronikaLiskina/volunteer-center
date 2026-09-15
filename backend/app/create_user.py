"""Создание учётной записи, смена пароля и настройка телефона/ФИО."""
import argparse
import asyncio
from getpass import getpass

from app.db.session import get_session, engine
from app.models.user import UserRole
from app.services.auth import AuthService


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phone", help="Номер телефона, например +79991234567")
    parser.add_argument("--full-name", help="ФИО с сохранением регистра")
    parser.add_argument("--role", choices=list(UserRole))
    parser.add_argument("--volunteer-id", type=int)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--reset-password", action="store_true", help="Задать новый пароль существующему пользователю и завершить его сессии")
    action.add_argument("--update-user", type=int, metavar="ID", help="Изменить телефон и ФИО существующей записи, сохранив пароль и роль")
    args = parser.parse_args()
    if not args.reset_password and not args.full_name:
        parser.error("Укажите --full-name с ФИО пользователя")
    if not args.reset_password and args.update_user is None and args.role is None:
        parser.error("Для создания пользователя укажите --role")
    if (args.reset_password or args.update_user is not None) and (args.role is not None or args.volunteer_id is not None):
        parser.error("При изменении существующей записи не указывайте --role и --volunteer-id")
    if args.reset_password and args.full_name is not None:
        parser.error("При смене пароля ФИО не изменяется; не указывайте --full-name")
    if args.update_user is not None and args.update_user <= 0:
        parser.error("ID пользователя должен быть положительным")
    password = ""
    if args.update_user is None:
        password = getpass("Пароль (минимум 12 символов): ")
        if password != getpass("Повторите пароль: "):
            raise ValueError("Пароли не совпадают")
    try:
        async for session in get_session():
            service = AuthService(session)
            if args.update_user is not None:
                user = await service.update_profile(args.update_user, args.phone, args.full_name)
                print(f"Учётная запись {user.id} обновлена: {user.full_name}. Вход по телефону {user.phone}, пароль прежний.")
            elif args.reset_password:
                user = await service.reset_password(args.phone, password)
                print(f"Пароль обновлён для {user.phone}. Войдите с новым паролем.")
            else:
                user = await service.create_user(args.phone, password, UserRole(args.role), args.volunteer_id, full_name=args.full_name)
                print(f"Создан пользователь {user.id}: {user.full_name}, телефон {user.phone} ({user.role})")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ValueError as error:
        raise SystemExit(str(error)) from None
