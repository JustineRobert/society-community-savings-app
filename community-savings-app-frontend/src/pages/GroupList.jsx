import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const GroupList = () => {
  const [groups, setGroups] = useState([]);
  const [joining, setJoining] = useState(null); // Tracking which group the user is joining
  const { user } = useAuth();

  // Fetch groups data
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const api = (await import('../services/api')).default;
        const res = await api.get('/api/groups');
        // backend returns { message, data, pagination }
        setGroups(res?.data?.data || []);
      } catch (err) {
        toast.error(`Error: ${err.message}`);
      }
    };

    fetchGroups();
  }, []);

  // Join group handler with optimistic UI
  const joinGroup = async (groupId) => {
    setJoining(groupId);
    const prevGroups = groups;
    // optimistic update: mark group as joined and increment member count
    const optimistic = groups.map((g) => {
      if (g._id !== groupId) return g;
      const members = Array.isArray(g.members) ? [...g.members] : [];
      const userId = user?._id || user?.id || user?.userId;
      // avoid duplicate
      if (!members.find((m) => (m._id || m) === userId)) members.push({ _id: userId, name: user?.name || user?.email });
      return { ...g, members, __joinedOptimistic: true };
    });
    setGroups(optimistic);

    try {
      const api = (await import('../services/api')).default;
      await api.post(`/api/groups/join/${groupId}`);
      toast.success('Successfully joined the group!');
      // refresh list from server to ensure canonical state
      const fresh = await api.get('/api/groups');
      setGroups(fresh?.data?.data || fresh?.data || []);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
      // rollback optimistic update
      setGroups(prevGroups);
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="group-list-container">
      <h2 className="text-2xl font-bold mb-4">Available Groups</h2>
      {groups.length === 0 ? (
        <p>No groups available. Check back later!</p>
      ) : (
        <ul className="space-y-4">
          {groups.map((group) => (
            <li
              key={group._id}
              className="group-item p-4 border border-gray-300 rounded-lg shadow-md hover:shadow-lg transition duration-200"
            >
              <h4 className="text-xl font-semibold">{group.name}</h4>
              <p className="text-gray-700 mb-2">{group.description}</p>
              <button
                onClick={() => joinGroup(group._id)}
                disabled={joining === group._id}
                className={`join-btn w-full py-2 mt-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition duration-200 ${
                  joining === group._id ? 'cursor-wait' : ''
                }`}
              >
                {joining === group._id ? 'Joining...' : 'Join Group'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GroupList;
