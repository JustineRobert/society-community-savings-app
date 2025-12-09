// src/pages/CreateGroup.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';

const CreateGroup = () => {
  const [groupName, setGroupName] = useState('');
  const [memberEmails, setMemberEmails] = useState(['']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAddEmailField = () => {
    setMemberEmails([...memberEmails, '']);
  };

  const handleEmailChange = (index, value) => {
    const newEmails = [...memberEmails];
    newEmails[index] = value;
    setMemberEmails(newEmails);
  };

  const validateEmails = () => {
    return memberEmails.every(email => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim()));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateEmails()) {
      setError('Please enter valid email addresses.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/groups', {
        name: groupName,
        members: memberEmails.filter(email => email.trim() !== ''),
      });
      toast.success('Group created successfully!');
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Failed to create group. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-group-container">
      <h2>Create New Group</h2>
      {error && <p className="error-message">{error}</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Group Name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          required
          className="input-field"
        />

        <h4>Invite Members (Emails)</h4>
        {memberEmails.map((email, index) => (
          <input
            key={index}
            type="email"
            placeholder={`Member ${index + 1} Email`}
            value={email}
            onChange={(e) => handleEmailChange(index, e.target.value)}
            className="input-field"
          />
        ))}
        <button type="button" onClick={handleAddEmailField} className="add-email-btn">
          + Add Another
        </button>

        <button type="submit" disabled={loading} className={`submit-btn ${loading ? 'loading' : ''}`}>
          {loading ? 'Creating...' : 'Create Group'}
        </button>
      </form>
    </div>
  );
};

export default CreateGroup;
