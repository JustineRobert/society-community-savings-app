import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

const GroupList = () => {
  const [groups, setGroups] = useState([]);
  const [joining, setJoining] = useState(null); // Tracking which group the user is joining

  // Fetch groups data
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/groups', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!res.ok) throw new Error('Failed to fetch groups');
        const data = await res.json();
        setGroups(data);
      } catch (err) {
        toast.error(`Error: ${err.message}`);
      }
    };

    fetchGroups();
  }, []);

  // Join group handler
  const joinGroup = async (groupId) => {
    setJoining(groupId); // Set the group being joined to prevent multiple actions
    try {
      const res = await fetch(`/api/groups/join/${groupId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!res.ok) throw new Error('Failed to join group');
      toast.success('Successfully joined the group!');
      setJoining(null); // Reset joining state after success
    } catch (err) {
      toast.error(`Error: ${err.message}`);
      setJoining(null); // Reset joining state in case of error
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
