import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	const handleLogout = async () => {
		await logout();
		navigate('/login');
	};

	return (
		<nav style={{ padding: '12px 20px', background: '#0b2447', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
			<div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
				<Link to="/" style={{ color: 'white', fontWeight: 700, textDecoration: 'none' }}>
					Community Savings
				</Link>
				<Link to="/dashboard" style={{ color: 'white', textDecoration: 'none' }}>Dashboard</Link>
				<Link to="/groups" style={{ color: 'white', textDecoration: 'none' }}>Groups</Link>
			</div>

			<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
				{user ? (
					<>
						<span style={{ opacity: 0.9 }}>{user.name || user.email}</span>
						<button onClick={handleLogout} style={{ background: '#f5b642', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
							Logout
						</button>
					</>
				) : (
					<>
						<Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>Login</Link>
						<Link to="/register" style={{ color: 'white', textDecoration: 'none' }}>Register</Link>
					</>
				)}
			</div>
		</nav>
	);
};

export default Navbar;
