import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings } from 'lucide-react';

const MasterSettings = () => (
  <div className="space-y-6">
    <div>
      <h1 className="page-header">Settings</h1>
      <p className="page-description">Global platform configuration</p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Plans & Pricing</CardTitle>
        <CardDescription>Active subscription plan configuration</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Basic', price: '$199/mo', users: '1 user', trucks: '5 trucks' },
            { name: 'Intermediate', price: '$399/mo', users: '2 users', trucks: '15 trucks' },
            { name: 'Pro', price: '$799/mo', users: '20 users', trucks: '100 trucks' },
          ].map(p => (
            <div key={p.name} className="border rounded-lg p-4">
              <h3 className="font-bold text-lg mb-1">{p.name}</h3>
              <p className="text-2xl font-bold text-primary">{p.price}</p>
              <ul className="mt-3 text-sm text-muted-foreground space-y-1">
                <li>• {p.users}</li>
                <li>• {p.trucks}</li>
                <li>• Unlimited loads</li>
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export default MasterSettings;
