import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings } from 'lucide-react';

const MasterSettings = () => (
  <div className="space-y-6">
    <div>
      <h1 className="page-header">Configuración</h1>
      <p className="page-description">Configuración global de la plataforma</p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Planes y Precios</CardTitle>
        <CardDescription>Configuración de planes de suscripción activos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Básico', price: '$199/mes', users: '1 usuario', trucks: '5 camiones' },
            { name: 'Intermedio', price: '$399/mes', users: '2 usuarios', trucks: '15 camiones' },
            { name: 'Pro', price: '$799/mes', users: '20 usuarios', trucks: '100 camiones' },
          ].map(p => (
            <div key={p.name} className="border rounded-lg p-4">
              <h3 className="font-bold text-lg mb-1">{p.name}</h3>
              <p className="text-2xl font-bold text-primary">{p.price}</p>
              <ul className="mt-3 text-sm text-muted-foreground space-y-1">
                <li>• {p.users}</li>
                <li>• {p.trucks}</li>
                <li>• Cargas ilimitadas</li>
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export default MasterSettings;
