UPDATE auth.users
SET encrypted_password = crypt('CBMaq2026++', gen_salt('bf')),
    updated_at = now()
WHERE email IN ('posvendasdf5@cbmaq.com.br','posvendasdf1@cbmaq.com.br','posvendasdf3@cbmaq.com.br','coordenacaoservicos@cbmaq.com.br');