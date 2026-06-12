import { useEffect, useState } from 'react';
import axios from 'axios';

export default function FraudMonitor() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    axios.get('/api/fraud/alerts').then(res => setAlerts(res.data));
  }, []);

  return (
    <div>
      <h2>Fraud Monitoring</h2>
      {alerts.map(a => (
        <div key={a.id} style={{ color: 'red' }}>
          🚨 {a.message}
        </div>
      ))}
    </div>
  );
}