// src/pages/GroupDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

const GroupDetails = () => {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributing, setContributing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch group data
  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        const response = await fetch(`/api/groups/${groupId}`);
        if (!response.ok) throw new Error('Failed to fetch group details');
        const data = await response.json();
        setGroup(data);
      } catch (err) {
        setError('Error: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchGroupData();
  }, [groupId]);

  // Handle contribution
  const handleContribute = async (e) => {
    e.preventDefault();
    setContributing(true);
    setSuccessMessage('');
    setError(null); // Clear previous errors

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No token found. Please log in.');
        return;
      }

      const response = await fetch(`/api/groups/${groupId}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: contributionAmount }),
      });

      if (!response.ok) throw new Error('Contribution failed');

      const updatedGroup = await response.json();
      setGroup(updatedGroup); // Update group data with new contribution
      setContributionAmount('');
      setSuccessMessage('Contribution successful!');
      toast.success('Contribution successful!');
    } catch (err) {
      setError('Error: ' + err.message);
      toast.error('Contribution failed. Please try again.');
    } finally {
      setContributing(false);
    }
  };

  if (loading) return <p>Loading group details...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="p-4 max-w-xl mx-auto bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-2 text-center">Group: {group.name}</h2>
      <p className="mb-2">Description: {group.description}</p>
      <p className="mb-4">Total Members: {group.members.length}</p>
      <p className="mb-4 font-semibold">
        Total Contributions: ${Number(group.totalContributions).toLocaleString()}
      </p>

      <form onSubmit={handleContribute} className="mb-4">
        <label className="block mb-2 font-medium">Contribute Amount:</label>
        <input
          type="number"
          value={contributionAmount}
          onChange={(e) => setContributionAmount(e.target.value)}
          className="border p-2 rounded w-full mb-2"
          required
          min="1"
          placeholder="Enter amount"
        />
        <button
          type="submit"
          disabled={contributing || !contributionAmount || Number(contributionAmount) < 1}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {contributing ? 'Contributing...' : 'Contribute'}
        </button>
      </form>

      {successMessage && <p className="text-green-600">{successMessage}</p>}
    </div>
  );
};

export default GroupDetails;
