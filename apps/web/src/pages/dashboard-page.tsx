import { Link } from 'react-router-dom';
import { Link2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui';

export function DashboardPage() {
  const { user } = useAuth();

  const cards = [
    {
      to: '/links',
      title: 'Enlaces y QR',
      description: 'Acorta URLs, genera códigos QR y sube archivos a S3.',
      icon: Link2,
      show: true,
    },
    {
      to: '/admin/users',
      title: 'Usuarios Workspace',
      description: 'Gestiona cuentas de Google Workspace desde el panel.',
      icon: Users,
      show: user?.role === 'admin',
    },
  ];

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">Hola, {user?.name?.split(' ')[0]}</h2>
      <p className="mb-8 text-muted">Panel de operaciones internas MALI ONE</p>

      <div className="grid gap-4 md:grid-cols-2">
        {cards
          .filter((c) => c.show)
          .map((card) => (
            <Link key={card.to} to={card.to}>
              <Card className="transition-colors hover:border-primary">
                <div className="mb-3 flex items-center gap-3">
                  <card.icon className="text-primary" />
                  <h3 className="font-semibold">{card.title}</h3>
                </div>
                <p className="text-sm text-muted">{card.description}</p>
              </Card>
            </Link>
          ))}
      </div>
    </div>
  );
}
