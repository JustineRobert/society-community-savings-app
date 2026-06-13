import React, { useEffect, useState } from "react"
import axios from "axios"
import { Line, Bar, Pie } from "react-chartjs-2"

const API = process.env.REACT_APP_API_URL

export default function AdminRiskDashboard() {
  const [riskData, setRiskData] = useState([])
  const [fraudData, setFraudData] = useState([])
  const [portfolio, setPortfolio] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const risk = await axios.get(`${API}/api/risk/profiles`)
      const fraud = await axios.get(`${API}/api/fraud/logs`)
      const portfolio = await axios.get(`${API}/api/admin/portfolio`)

      setRiskData(risk.data)
      setFraudData(fraud.data)
      setPortfolio(portfolio.data)
    } catch (err) {
      console.error(err)
    }
  }

  const scoreDistribution = {
    labels: ["Low Risk", "Medium Risk", "High Risk"],
    datasets: [
      {
        data: [
          riskData.filter(r => r.riskLevel === "APPROVE").length,
          riskData.filter(r => r.riskLevel === "REVIEW").length,
          riskData.filter(r => r.riskLevel === "REJECT").length
        ],
        backgroundColor: ["#4CAF50", "#FFC107", "#F44336"]
      }
    ]
  }

  const fraudMetrics = {
    labels: fraudData.map(f => new Date(f.createdAt).toLocaleDateString()),
    datasets: [
      {
        label: "Fraud Score",
        data: fraudData.map(f => f.fraudScore),
        borderColor: "#FF5722",
        fill: false
      }
    ]
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Risk Intelligence Dashboard</h2>

      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ width: "50%" }}>
          <h4>Credit Risk Distribution</h4>
          <Pie data={scoreDistribution} />
        </div>

        <div style={{ width: "50%" }}>
          <h4>Fraud Trends</h4>
          <Line data={fraudMetrics} />
        </div>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h4>Portfolio Overview</h4>
        <Bar
          data={{
            labels: ["Loans Issued", "Defaults", "Active"],
            datasets: [
              {
                data: [
                  portfolio.totalLoans,
                  portfolio.defaults,
                  portfolio.activeLoans
                ],
                backgroundColor: ["#2196F3", "#F44336", "#4CAF50"]
              }
            ]
          }}
        />
      </div>
    </div>
  )
}