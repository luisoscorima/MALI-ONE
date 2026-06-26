import { useEffect } from 'react';

const VAULT_URL = 'https://vault.mali.pe/';

export function PasswordVaultPage() {
  useEffect(() => {
    window.location.replace(VAULT_URL);
  }, []);

  return (
    <p className="text-sm text-muted">Redirigiendo a la bóveda de contraseñas…</p>
  );
}
