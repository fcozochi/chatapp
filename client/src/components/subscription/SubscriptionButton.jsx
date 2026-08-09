/**
 * Subscription Status Button - Shows premium status
 */

import React, { useState, useEffect } from 'react';

const SubscriptionButton = ({ onPress }) => {
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const response = await fetch('/api/subscription/current');
            const data = await response.json();
            setStatus(data.subscription.isPremium ? 'premium' : 'free');
        } catch (error) {
            setStatus('error');
        }
    };

    if (status === 'premium') {
        return (
            <button className="subscription-btn premium" onClick={onPress}>
                <span className="btn-icon">⭐</span>
                <span>Premium</span>
            </button>
        );
    }

    if (status === 'loading') {
        return (
            <button className="subscription-btn loading" disabled>
                <span className="spinner-small"></span>
                <span>Loading...</span>
            </button>
        );
    }

    return (
        <button className="subscription-btn upgrade" onClick={onPress}>
            <span className="btn-icon">🔓</span>
            <span>Upgrade</span>
            <span className="trial-badge-small">14-day trial</span>
        </button>
    );
};

export default SubscriptionButton;