import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AdminDashboard = () => {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/dashboard");
    } else {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    try {
      const [userRes, requestRes] = await Promise.all([
        axios.get("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("/api/admin/group-requests", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setUsers(userRes.data);
      setRequests(requestRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Admin fetch error", err);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {loading ? (
        <p>Loading data...</p>
      ) : (
        <>
          {/* User Summary */}
          <div className="bg-white rounded-xl shadow p-4 mb-6">
            <h2 className="text-xl font-semibold mb-2">All Users</h2>
            <p>Total: {users.length}</p>
            <ul className="mt-4 space-y-2">
              {users.map((u) => (
                <li key={u._id} className="flex justify-between">
                  <span>{u.name}</span>
                  <span className="text-sm text-gray-500">{u.role}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Group Approval Requests */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-xl font-semibold mb-2">Group Approval Requests</h2>
            <ul className="space-y-2">
              {requests.length === 0 && (
                <p className="text-gray-500">No pending requests</p>
              )}
              {requests.map((req) => (
                <li
                  key={req._id}
                  className="p-3 border rounded-md flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold">{req.name}</p>
                    <p className="text-sm text-gray-500">
                      Requested by: {req.owner?.name}
                    </p>
                  </div>
                  <button className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700">
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
