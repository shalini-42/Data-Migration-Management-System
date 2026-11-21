import {
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

export default function DashboardCharts({ dist, wk, colors }) {
  return (
    <div className="grid2">
      <div className="card">
        <h4>Weekly activity</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={wk}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="d" />
            <YAxis />
            <Tooltip />
            <Line dataKey="ok" stroke="#2563eb" />
            <Line dataKey="fail" stroke="#dc2626" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h4>Status distribution</h4>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={dist}
              dataKey="value"
              nameKey="name"
              outerRadius={80}
              label
            >
              {dist.map((_, i) => (
                <Cell key={i} fill={colors[i]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
