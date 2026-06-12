import { LineChart, Line, XAxis, YAxis } from 'recharts';

export default function TransactionsChart({ data }) {
  return (
    <LineChart width={500} height={300} data={data}>
      <XAxis dataKey="date" />
      <YAxis />
      <Line type="monotone" dataKey="amount" stroke="#8884d8" />
    </LineChart>
  );
}
``