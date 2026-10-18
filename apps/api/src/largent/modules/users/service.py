"""User provisioning and profile use cases."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from largent.core.security import VerifiedIdentity
from largent.modules.users import repository
from largent.modules.users.models import User


async def get_or_provision_user_id(
    identity: VerifiedIdentity,
    session_factory: async_sessionmaker[AsyncSession],
) -> UUID:
    from largent.core.tenancy import system_session

    async with system_session(session_factory) as session:
        user_id = await session.scalar(
            text("SELECT public.resolve_user(:provider, :subject)"),
            {"provider": identity.provider, "subject": identity.subject},
        )
        if user_id is None:
            user_id = await session.scalar(
                text("SELECT public.provision_user(:provider, :subject, :email, :display_name)"),
                {
                    "provider": identity.provider,
                    "subject": identity.subject,
                    "email": identity.email,
                    "display_name": identity.display_name,
                },
            )
    if not isinstance(user_id, UUID):
        raise RuntimeError("User provisioning did not return a UUID")
    return user_id


async def read_profile(session: AsyncSession, user_id: UUID) -> User | None:
    return await repository.get_user(session, user_id)


async def read_timezone(session: AsyncSession, user_id: UUID) -> str:
    return await repository.get_timezone(session, user_id)


async def update_profile(
    session: AsyncSession,
    user_id: UUID,
    changes: dict[str, str],
) -> User | None:
    return await repository.update_user(session, user_id, changes)
