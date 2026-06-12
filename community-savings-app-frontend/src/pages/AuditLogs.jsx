export default function AuditLogs({ logs }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>User</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(log => (
          <tr key={log.id}>
            <td>{log.event}</td>
            <td>{log.user}</td>
            <td>{log.timestamp}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}