"""Create the identity-root users table and restricted provisioning functions."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from largent.db.rls import enable_user_self_rls

revision = "0001_users"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("auth_provider", sa.String(length=50), nullable=False),
        sa.Column("auth_subject", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("display_name", sa.String(length=100), nullable=True),
        sa.Column("timezone", sa.String(length=100), server_default="Africa/Accra", nullable=False),
        sa.Column("currency", sa.CHAR(length=3), server_default="GHS", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("currency = 'GHS'", name="users_currency_ghs_only"),
        sa.UniqueConstraint("auth_provider", "auth_subject", name="uq_users_provider_subject"),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    enable_user_self_rls(op)
    op.execute(
        """
        CREATE FUNCTION public.resolve_user(p_provider text, p_subject text)
        RETURNS uuid
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $function$
            SELECT u.id
            FROM public.users AS u
            WHERE u.auth_provider = p_provider AND u.auth_subject = p_subject
        $function$
        """
    )
    op.execute(
        """
        CREATE FUNCTION public.provision_user(
            p_provider text, p_subject text, p_email text, p_display_name text
        ) RETURNS uuid
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $function$
        DECLARE
            v_random_hex text;
            v_timestamp_hex text;
            v_variant_hex text;
            v_variant_value integer;
            v_user_id uuid;
        BEGIN
            v_random_hex := replace(gen_random_uuid()::text, '-', '');
            v_timestamp_hex := lpad(
                to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0'
            );
            v_variant_value := strpos('0123456789abcdef', substr(v_random_hex, 17, 1)) - 1;
            v_variant_hex := substr('0123456789abcdef', (v_variant_value & 3) + 9, 1);
            v_user_id := (
                substr(v_timestamp_hex, 1, 8) || '-' ||
                substr(v_timestamp_hex, 9, 4) || '-7' ||
                substr(v_random_hex, 14, 3) || '-' || v_variant_hex ||
                substr(v_random_hex, 18, 3) || '-' || substr(v_random_hex, 21, 12)
            )::uuid;

            INSERT INTO public.users (id, auth_provider, auth_subject, email, display_name)
            VALUES (v_user_id, p_provider, p_subject, p_email, p_display_name)
            ON CONFLICT (auth_provider, auth_subject) DO NOTHING;

            SELECT u.id INTO v_user_id
            FROM public.users AS u
            WHERE u.auth_provider = p_provider AND u.auth_subject = p_subject;
            RETURN v_user_id;
        END
        $function$
        """
    )
    op.execute("ALTER FUNCTION public.resolve_user(text, text) OWNER TO largent_migrator")
    op.execute(
        "ALTER FUNCTION public.provision_user(text, text, text, text) OWNER TO largent_migrator"
    )
    op.execute("REVOKE ALL ON FUNCTION public.resolve_user(text, text) FROM PUBLIC")
    op.execute("REVOKE ALL ON FUNCTION public.provision_user(text, text, text, text) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION public.resolve_user(text, text) TO largent_app")
    op.execute(
        "GRANT EXECUTE ON FUNCTION public.provision_user(text, text, text, text) TO largent_app"
    )


def downgrade() -> None:
    op.execute("REVOKE EXECUTE ON FUNCTION public.resolve_user(text, text) FROM largent_app")
    op.execute(
        "REVOKE EXECUTE ON FUNCTION public.provision_user(text, text, text, text) FROM largent_app"
    )
    op.execute("DROP FUNCTION public.provision_user(text, text, text, text)")
    op.execute("DROP FUNCTION public.resolve_user(text, text)")
    op.drop_table("users")
